import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, Calendar, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { dataStore } from '../../core/data/dataStore';
import { type EvoTransaction } from '../../core/domain/evo-transaction';
import type { ToolDefinition } from '../shared/types';
import { TaxProfileForm } from './components/TaxProfileForm';
import { getCalculatorForRegimen } from './calculators/factory';


export const TaxCalculationModule: React.FC = () => {
    const [transactions, setTransactions] = useState<EvoTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const records = await dataStore.listRecords<{ transactions: EvoTransaction[] }>('evo-transactions');
                if (records.length > 0) {
                    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    setTransactions(records[0].payload.transactions || []);
                }
            } catch (e) {
                console.error("Failed to load transactions", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const [profile, setProfile] = useState<any>(null);

    // Load profile to know which calculator to use
    useEffect(() => {
        const loadProfile = async () => {
            const p = await import('./store/taxProfileStore').then(m => m.taxProfileStore.getTaxProfile());
            setProfile(p);
        };
        loadProfile();
    }, [loading]); // Reload when loading finishes (or maybe listen to store changes?)
    // Ideally we should lift state or use a context, but for now let's just reload.
    // Actually, TaxProfileForm updates the store. We might not see the update immediately here unless we trigger a reload.
    // Let's add a simple event listener or just reload on focus? 
    // For Phase 2, let's just rely on the user refreshing or us passing a callback.
    // Better yet: pass a callback to TaxProfileForm to notify parent?
    // Or just re-fetch profile every time we render? No.

    // Let's add a refresh trigger.
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const load = async () => {
            const p = await import('./store/taxProfileStore').then(m => m.taxProfileStore.getTaxProfile());
            setProfile(p);
        };
        load();
    }, [refreshTrigger]);

    const stats = useMemo(() => {
        const periodTransactions = transactions.filter(t => t.date.startsWith(month));

        let income = 0;
        let expenses = 0;
        let taxPaid = 0;

        periodTransactions.forEach(t => {
            if (t.type === 'ingreso') income += t.amount;
            else if (t.type === 'gasto') expenses += t.amount;
            else if (t.type === 'impuesto') taxPaid += t.amount;
        });

        // Use Calculator Strategy
        // We need to use the imported factory. Since it's a synchronous helper, we can just import it at top level.
        // But to avoid circular deps or just for cleanliness, let's import it at top level.
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
    }, [transactions, month, profile]);

    const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

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
                    <TaxProfileForm onProfileSaved={() => setRefreshTrigger(prev => prev + 1)} />
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
