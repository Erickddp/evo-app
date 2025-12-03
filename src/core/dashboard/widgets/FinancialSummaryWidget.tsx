import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { dataStore } from '../../data/dataStore';
import type { Movement as IngresosMovement } from '../../../modules/ingresos-manager/index';

interface IncomeStats {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    movementsCount: number;
}

export function FinancialSummaryWidget() {
    const [stats, setStats] = useState<IncomeStats | null>(null);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            try {
                const records = await dataStore.listRecords<{ movements: IngresosMovement[] }>('ingresos-manager');
                if (!isMounted || records.length === 0) return;

                const last = records[records.length - 1];
                const payload = (last.payload || {}) as any;

                setStats({
                    totalIncome: Number(payload.stats?.totalIncome) || 0,
                    totalExpense: Number(payload.stats?.totalExpense) || 0,
                    netBalance: Number(payload.stats?.netBalance) || 0,
                    movementsCount: Number(payload.movementsCount) || 0,
                });
            } catch (e) {
                console.error(e);
            }
        }
        void load();
        return () => { isMounted = false; };
    }, []);

    const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    return (
        <div className="group h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <DollarSign className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Resumen financiero</h3>
            </div>

            {!stats ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos financieros disponibles.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Saldo Neto</p>
                        <p className={`text-2xl font-bold ${stats.netBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(stats.netBalance)}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">{stats.movementsCount} movimientos</p>
                    </div>

                    <div className="md:col-span-2 flex flex-col justify-center space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium"><TrendingUp size={14} /> Ingresos</span>
                                <span className="font-mono text-gray-900 dark:text-white">{formatCurrency(stats.totalIncome)}</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${stats.totalIncome + stats.totalExpense > 0 ? (stats.totalIncome / (stats.totalIncome + stats.totalExpense)) * 100 : 0}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium"><TrendingDown size={14} /> Gastos</span>
                                <span className="font-mono text-gray-900 dark:text-white">{formatCurrency(stats.totalExpense)}</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${stats.totalIncome + stats.totalExpense > 0 ? (stats.totalExpense / (stats.totalIncome + stats.totalExpense)) * 100 : 0}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
