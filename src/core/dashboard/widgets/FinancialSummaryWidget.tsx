import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, ArrowRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { evoStore } from '../../evoappDataStore';
import { evoEvents } from '../../events';

interface IncomeStats {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    movementsCount: number;
}

export function FinancialSummaryWidget() {
    const [stats, setStats] = useState<IncomeStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            try {
                const movements = await evoStore.registrosFinancieros.getAll();
                if (!isMounted) return;

                if (movements.length === 0) {
                    setStats(null);
                    setLoading(false);
                    return;
                }

                // Filter and calculate strictly based on 'ingreso' and 'gasto'
                let totalIncome = 0;
                let totalExpense = 0;
                let count = 0;

                movements.forEach(m => {
                    // Ensure we handle amounts as numbers
                    const amt = Number(m.monto) || 0;

                    if (m.tipo === 'ingreso') {
                        totalIncome += amt;
                        count++;
                    } else if (m.tipo === 'gasto') {
                        totalExpense += amt;
                        count++;
                    }
                    // Explicitly ignore other types
                });

                setStats({
                    totalIncome,
                    totalExpense,
                    netBalance: totalIncome - totalExpense,
                    movementsCount: count,
                });
                setLoading(false);
            } catch (e) {
                console.error('Failed to load financial summary:', e);
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

    const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    if (loading) {
        return (
            <div className="h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 animate-pulse">
                <div className="flex gap-4">
                    <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mt-2"></div>
                </div>
                <div className="mt-8 space-y-3">
                    <div className="h-8 w-2/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900/30 dark:bg-red-900/10 flex flex-col items-center justify-center text-center">
                <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                <p className="text-sm font-medium text-red-800 dark:text-red-300">No fue posible cargar el resumen financiero.</p>
            </div>
        );
    }

    return (
        <div className="group relative h-full flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                        <DollarSign className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Resumen financiero</h3>
                </div>

                {!stats || stats.movementsCount === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sin movimientos registrados en Gestor de Ingresos.</p>
                        <Link to="/tools/ingresos" className="mt-2 inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                            Ir a registrar <ArrowRight size={12} className="ml-1" />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Net Balance - Primary */}
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Saldo Neto</p>
                            <p className={`text-4xl font-bold tracking-tight ${stats.netBalance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                {formatCurrency(stats.netBalance)}
                            </p>
                        </div>

                        {/* Breakdown */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 rounded bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        <TrendingUp size={14} />
                                    </div>
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Ingresos</span>
                                </div>
                                <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                                    {formatCurrency(stats.totalIncome)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                        <TrendingDown size={14} />
                                    </div>
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Gastos</span>
                                </div>
                                <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                                    {formatCurrency(stats.totalExpense)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer info */}
            {stats && stats.movementsCount > 0 && (
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
                    <span className="text-xs text-gray-400">
                        {stats.movementsCount} movimientos
                    </span>
                    <Link
                        to="/tools/ingresos"
                        className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 transition-colors"
                    >
                        Ver detalle <ArrowRight size={12} className="ml-1" />
                    </Link>
                </div>
            )}
        </div>
    );
}

