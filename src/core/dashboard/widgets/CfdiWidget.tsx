import { useEffect, useState } from 'react';
import { FileCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { evoStore } from '../../evoappDataStore';
import { dataStore } from '../../data/dataStore';
import { WidgetSkeleton, WidgetError, WidgetCard } from './WidgetCommon';
import { evoEvents } from '../../events';
import { STORAGE_KEYS } from '../../data/storageKeys';

interface CfdiStats {
    totalRecords: number;
    totalIncome: number;
    totalExpense: number;
    lastRun?: string;
}

export function CfdiWidget() {
    const [stats, setStats] = useState<CfdiStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            try {
                // 1. Load Canonical Financial Records (Source of Truth for impact)
                const allFinancials = await evoStore.registrosFinancieros.getAll();
                const cfdiRecords = allFinancials.filter(r => r.source === 'cfdi');

                // Calculate totals
                const totalIncome = cfdiRecords
                    .filter(r => r.type === 'ingreso')
                    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

                const totalExpense = cfdiRecords
                    .filter(r => r.type === 'gasto')
                    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

                // 2. Load Legacy Last Run Info (for logs display only)
                let lastRunDate: string | undefined;
                try {
                    const latest = await dataStore.getSnapshot<any>(STORAGE_KEYS.LEGACY.CFDI_VALIDATOR);
                    if (latest) {
                        lastRunDate = latest.timestamp || (latest.createdAt /* if available in payload */);
                        // If we stored timestamp in payload in handleProcess, use it.
                    }
                } catch (e) {
                    console.warn('Could not load legacy CFDI logs', e);
                }

                setStats({
                    totalRecords: cfdiRecords.length,
                    totalIncome,
                    totalExpense,
                    lastRun: lastRunDate
                });
                setLoading(false);
            } catch (e) {
                console.error(e);
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        }
        void load();

        const handleReload = () => void load();
        evoEvents.on('finance:updated', handleReload);

        return () => {
            isMounted = false;
            evoEvents.off('finance:updated', handleReload);
        };
    }, []);

    if (loading) return <WidgetSkeleton />;
    if (error) return <WidgetError message="No fue posible cargar el resumen de CFDI." />;

    return (
        <WidgetCard>
            <div>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                            <FileCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Validación de CFDI</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Basado en la última validación de CFDI.
                            </p>
                        </div>
                    </div>
                </div>

                {!stats || stats.totalRecords === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sin movimientos CFDI registrados.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Main Metric: Total Impact Count */}
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                CFDI Impactando Finanzas
                            </p>
                            <p className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                                {stats.totalRecords}
                            </p>
                        </div>

                        {/* Financial Breakdown */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800">
                                <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <ArrowUpRight size={12} /> Ingresos (CFDI)
                                </p>
                                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                    {stats.totalIncome.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800">
                                <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <ArrowDownRight size={12} /> Gastos (CFDI)
                                </p>
                                <p className="text-lg font-bold text-rose-700 dark:text-rose-300">
                                    {stats.totalExpense.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {stats && stats.lastRun && (
                <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-400">
                        Última ejecución: {new Date(stats.lastRun).toLocaleDateString('es-MX')} {new Date(stats.lastRun).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            )}
        </WidgetCard>
    );
}
