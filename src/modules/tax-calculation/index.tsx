import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, Calendar, TrendingUp, TrendingDown, AlertCircle, Save, CheckCircle, User, Edit2 } from 'lucide-react';
import { evoStore } from '../../core/evoappDataStore';
import { ingresosMapper } from '../../core/mappers/ingresosMapper';
import { readLegacyEvoTransactions } from '../../core/data/legacyEvoTransactions';
import { taxPaymentMapper } from '../../core/mappers/taxPaymentMapper';
import { taxCalcMapper } from '../../core/mappers/taxCalcMapper';
import type { RegistroFinanciero, PagoImpuesto } from '../../core/evoappDataModel';
import { type EvoTransaction } from '../../core/domain/evo-transaction';
import type { ToolDefinition } from '../shared/types';
import { TaxProfileForm } from './components/TaxProfileForm';
import { getCalculatorForRegimen } from './calculators/factory';


export const TaxCalculationModule: React.FC = () => {
    const [registros, setRegistros] = useState<RegistroFinanciero[]>([]);
    const [pagos, setPagos] = useState<PagoImpuesto[]>([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // 1. Load Registros Financieros (Income/Expenses)
                const canonicalRegistros = await evoStore.registrosFinancieros.getAll();
                let loadedRegistros = canonicalRegistros;

                if (loadedRegistros.length === 0) {
                    // Fallback/Migration check (lazy)
                    const records = await readLegacyEvoTransactions<{ transactions: EvoTransaction[] }>();
                    if (records.length > 0) {
                        const transactions = records[0].transactions || [];
                        // We don't migrate here to avoid duplication if other modules did it.
                        // Just map for display/calc
                        loadedRegistros = transactions
                            .filter((t: any) => t.type === 'ingreso' || t.type === 'gasto')
                            .map(ingresosMapper.toCanonical);
                    }
                }
                setRegistros(loadedRegistros);

                // 2. Load Tax Payments
                const canonicalPagos = await evoStore.pagosImpuestos.getAll();
                let loadedPagos = canonicalPagos;

                if (loadedPagos.length === 0) {
                    // Fallback
                    const records = await readLegacyEvoTransactions<{ transactions: EvoTransaction[] }>();
                    if (records.length > 0) {
                        const transactions = records[0].transactions || [];
                        loadedPagos = transactions
                            .filter((t: any) => t.type === 'impuesto')
                            .map((t: any) => ({
                                id: t.id,
                                date: t.date,
                                concept: t.concept,
                                amount: t.amount,
                                type: (t.metadata?.taxType as any) || 'Other',
                                status: 'Paid' as 'Paid',
                                metadata: t.metadata
                            }))
                            .map(taxPaymentMapper.toCanonical);
                    }
                }
                setPagos(loadedPagos);

            } catch (e) {
                console.error("Failed to load data", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const [profile, setProfile] = useState<any>(null);
    const [profileCollapsed, setProfileCollapsed] = useState(false);

    // Load profile to know which calculator to use
    useEffect(() => {
        const loadProfile = async () => {
            const p = await import('./store/taxProfileStore').then(m => m.taxProfileStore.getTaxProfile());
            setProfile(p);
            // Si ya existe un perfil, colapsar automáticamente
            if (p) {
                setProfileCollapsed(true);
            }
        };
        loadProfile();
    }, [loading]);

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const load = async () => {
            const p = await import('./store/taxProfileStore').then(m => m.taxProfileStore.getTaxProfile());
            setProfile(p);
            // Nota: Aquí no forzamos el colapso para permitir que el usuario vea cambios si acaba de editar,
            // pero el callback onProfileSaved ya se encargará de colapsarlo.
        };
        load();
    }, [refreshTrigger]);

    const stats = useMemo(() => {
        // Filter by month
        const periodRegistros = registros.filter(r => r.fecha.startsWith(month));
        const periodPagos = pagos.filter(p => p.fechaPago.startsWith(month));

        let income = 0;
        let expenses = 0;
        let taxPaid = 0;

        periodRegistros.forEach(r => {
            if (r.tipo === 'ingreso') income += r.monto;
            else if (r.tipo === 'gasto') expenses += r.monto;
        });

        periodPagos.forEach(p => {
            taxPaid += p.monto;
        });

        // Use Calculator Strategy
        // RESICO (Persona Física) logic is handled here by selecting the appropriate calculator
        const calculator = getCalculatorForRegimen(profile?.regimenFiscal);

        const baseResult = calculator.calculateBase({ income, expenses });
        const taxResult = calculator.calculateTaxes({
            taxableBase: baseResult.taxableBase,
            ivaBase: baseResult.ivaBase,
            income,
            expenses
        });

        const netPayable = Math.max(0, taxResult.total - taxPaid);

        return {
            income,
            expenses,
            taxBase: baseResult.taxableBase,
            estimatedIva: taxResult.iva,
            estimatedIsr: taxResult.isr,
            totalEstimatedTax: taxResult.total,
            taxPaid,
            netPayable
        };
    }, [registros, pagos, month, profile]);

    const handleSaveSnapshot = async () => {
        setSaveStatus('saving');
        try {
            const year = parseInt(month.split('-')[0]);
            const monthNum = parseInt(month.split('-')[1]);

            const calculation = taxCalcMapper.createCalculation(
                monthNum,
                year,
                stats.income,
                stats.expenses,
                stats.estimatedIsr,
                stats.estimatedIva
            );

            await evoStore.calculosImpuestos.add(calculation);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) {
            console.error('Failed to save calculation', e);
            setSaveStatus('error');
        }
    };

    const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    const getRegimenLabel = (regimen: string) => {
        switch (regimen) {
            case 'PF_RESICO': return 'Persona Física - RESICO';
            case 'PF_ACT_EMPRESARIAL': return 'Persona Física - Actividad Empresarial';
            case 'PM_RESICO': return 'Persona Moral - RESICO';
            case 'PM_GENERAL': return 'Persona Moral - Régimen General';
            default: return regimen;
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando datos fiscales...</div>;

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Calculator className="text-indigo-600" /> Cálculo de Impuestos
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">Estimación fiscal basada en movimientos registrados.</p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <Calendar size={16} className="text-gray-500" />
                    <input
                        type="month"
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className="border-none bg-transparent text-sm focus:ring-0 text-gray-700 dark:text-gray-200"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3">
                    {profileCollapsed && profile ? (
                        // Vista colapsada (Resumen)
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Perfil fiscal confirmado
                                    </h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                        <span>{profile.tipoPersona === 'PF' ? 'Persona Física' : 'Persona Moral'}</span>
                                        <span>•</span>
                                        <span className="font-medium text-indigo-600 dark:text-indigo-400">{getRegimenLabel(profile.regimenFiscal)}</span>
                                        <span>•</span>
                                        <span>RFC {profile.rfc}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setProfileCollapsed(false)}
                                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                            >
                                <Edit2 size={16} />
                                Hacer cambios
                            </button>
                        </div>
                    ) : (
                        // Vista expandida (Formulario)
                        <TaxProfileForm
                            onProfileSaved={() => {
                                setRefreshTrigger(prev => prev + 1);
                                setProfileCollapsed(true);
                            }}
                            onCancel={() => {
                                if (profile) setProfileCollapsed(true);
                            }}
                            showCancel={!!profile}
                        />
                    )}
                </div>

                {/* Base Calculation */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Base Gravable</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <TrendingUp size={16} className="text-green-500" /> Ingresos
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(stats.income)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <TrendingDown size={16} className="text-red-500" /> Gastos Deducibles
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(stats.expenses)}</span>
                        </div>
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <span className="font-semibold text-gray-900 dark:text-white">Utilidad Fiscal</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(stats.taxBase)}</span>
                        </div>
                    </div>
                </div>

                {/* Tax Estimation */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Estimación de Impuestos</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400">IVA Trasladado (16%)</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(stats.estimatedIva)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400">ISR Estimado (30%)</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(stats.estimatedIsr)}</span>
                        </div>
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <span className="font-semibold text-gray-900 dark:text-white">Total a Cargo</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(stats.totalEstimatedTax)}</span>
                        </div>
                    </div>
                </div>

                {/* Final Payable */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <DollarSign size={20} className="text-green-400" /> Resultado Final
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-slate-300">
                            <span>Impuesto a Cargo</span>
                            <span>{formatCurrency(stats.totalEstimatedTax)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                            <span>Pagos Anticipados</span>
                            <span className="text-green-400">- {formatCurrency(stats.taxPaid)}</span>
                        </div>
                        <div className="pt-4 border-t border-white/10">
                            <div className="text-xs text-slate-400 uppercase mb-1">Neto a Pagar</div>
                            <div className="text-3xl font-bold text-white">{formatCurrency(stats.netPayable)}</div>
                        </div>
                    </div>
                    <div className="mt-6 flex items-start gap-2 text-xs text-slate-400 bg-white/5 p-3 rounded-lg">
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        <p>Esta es una estimación preliminar. Consulta a tu contador para la declaración oficial.</p>
                    </div>

                    <div className="mt-4">
                        <button
                            onClick={handleSaveSnapshot}
                            disabled={saveStatus === 'saving' || saveStatus === 'success'}
                            className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                        >
                            {saveStatus === 'success' ? (
                                <>
                                    <CheckCircle size={16} className="text-green-400" /> Guardado
                                </>
                            ) : saveStatus === 'saving' ? (
                                'Guardando...'
                            ) : (
                                <>
                                    <Save size={16} /> Guardar Estimación
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const taxCalculationDefinition: ToolDefinition = {
    meta: {
        id: 'tax-calculation',
        name: 'Cálculo de Impuestos',
        description: 'Estimación de impuestos (IVA e ISR) basada en flujo de efectivo.',
        icon: Calculator,
        version: '1.0.0',
    },
    component: TaxCalculationModule,
};
