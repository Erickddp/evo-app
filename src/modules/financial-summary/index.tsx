import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, Activity, Calendar, Filter } from 'lucide-react';
import { dataStore } from '../../core/data/dataStore';
import { type EvoTransaction } from '../../core/domain/evo-transaction';
import {
    normalizeMovements,
    calculateFinancialSummary,
    getPeriodDates,
    type NormalizedMovement,
    type FinancialSummaryState
} from './helpers';

// --- Helpers ---

const formatCurrency = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// --- Components ---

const KPICard: React.FC<{ title: string; value: number; color: string; icon: React.ReactNode }> = ({ title, value, color, icon }) => (
    <div className={`p-4 rounded-xl border ${color} bg-white dark:bg-gray-800 shadow-sm transition-all hover:shadow-md`}>
        <div className="flex justify-between items-start">
            <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(value)}</h3>
            </div>
            <div className={`p-2 rounded-lg ${color.replace('border-', 'bg-').replace('200', '100')} dark:bg-opacity-20`}>
                {icon}
            </div>
        </div>
    </div>
);

const SimpleBarChart: React.FC<{ data: { month: string; income: number; expenses: number; taxes: number }[] }> = ({ data }) => {
    if (data.length === 0) return (
        <div className="h-64 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <Activity className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No hay datos para mostrar en este periodo</p>
        </div>
    );

    const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expenses, d.taxes)), 1);

    return (
        <div className="h-64 flex items-end gap-4 overflow-x-auto pb-2 pt-8 px-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {data.map((d) => (
                <div key={d.month} className="flex flex-col items-center gap-1 min-w-[80px] flex-1">
                    <div className="flex gap-1 items-end h-full w-full justify-center px-1">
                        {/* Income */}
                        <div
                            className="w-3 md:w-6 bg-green-500 rounded-t-sm hover:opacity-80 transition-opacity relative group"
                            style={{ height: `${(d.income / maxVal) * 100}%` }}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs p-1 rounded whitespace-nowrap z-10 shadow-lg">
                                Ingresos: {formatCurrency(d.income)}
                            </div>
                        </div>
                        {/* Expense */}
                        <div
                            className="w-3 md:w-6 bg-red-500 rounded-t-sm hover:opacity-80 transition-opacity relative group"
                            style={{ height: `${(d.expenses / maxVal) * 100}%` }}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs p-1 rounded whitespace-nowrap z-10 shadow-lg">
                                Gastos: {formatCurrency(d.expenses)}
                            </div>
                        </div>
                        {/* Tax */}
                        <div
                            className="w-3 md:w-6 bg-orange-500 rounded-t-sm hover:opacity-80 transition-opacity relative group"
                            style={{ height: `${(d.taxes / maxVal) * 100}%` }}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs p-1 rounded whitespace-nowrap z-10 shadow-lg">
                                Impuestos: {formatCurrency(d.taxes)}
                            </div>
                        </div>
                    </div>
                    <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{d.month}</span>
                </div>
            ))}
        </div>
    );
};

export const FinancialSummary: React.FC = () => {
    const [allMovements, setAllMovements] = useState<NormalizedMovement[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [periodPreset, setPeriodPreset] = useState<'all' | 'month' | 'year' | 'custom'>(() => {
        return (localStorage.getItem('evorix-financial-summary-range') as any) || 'all';
    });
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useEffect(() => {
        localStorage.setItem('evorix-financial-summary-range', periodPreset);
    }, [periodPreset]);

    // Load Data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Load Unified Transactions
                const records = await dataStore.listRecords<{ transactions: EvoTransaction[] }>('evo-transactions');
                let transactions: EvoTransaction[] = [];
                if (records.length > 0) {
                    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    transactions = records[0].payload.transactions || [];
                }

                // Normalize
                const normalized = normalizeMovements(transactions);
                setAllMovements(normalized);

            } catch (e) {
                console.error("Failed to load financial data", e);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Derived State
    const summaryState = useMemo<FinancialSummaryState>(() => {
        const { start, end } = getPeriodDates(periodPreset, customStart, customEnd);
        return calculateFinancialSummary(allMovements, start, end);
    }, [allMovements, periodPreset, customStart, customEnd]);

    const hasData = allMovements.length > 0;

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PieChart className="text-indigo-600" /> Estado de resultados
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Estado de resultados automático generado con los movimientos registrados en EVOAPP.
                    </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        {(['all', 'month', 'year', 'custom'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriodPreset(p)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${periodPreset === p
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {p === 'all' ? 'Histórico' :
                                    p === 'month' ? 'Este mes' :
                                        p === 'year' ? 'Este año' : 'Rango personalizado'}
                            </button>
                        ))}
                    </div>

                    {periodPreset === 'custom' && (
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">De:</span>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={e => setCustomStart(e.target.value)}
                                    className="text-xs border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">A:</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={e => setCustomEnd(e.target.value)}
                                    className="text-xs border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Cargando datos financieros...</div>
            ) : !hasData ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <Activity className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Aún no hay movimientos suficientes</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2">
                        Para generar un estado de resultados, necesitas registrar ingresos o gastos en el módulo de Ingresos, o pagos de impuestos en Tax Tracker.
                    </p>
                </div>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <KPICard
                            title="Ingresos Totales"
                            value={summaryState.totalIncome}
                            color="border-green-200 text-green-600"
                            icon={<ArrowUpCircle size={24} className="text-green-600" />}
                        />
                        <KPICard
                            title="Gastos Totales"
                            value={summaryState.totalExpenses}
                            color="border-red-200 text-red-600"
                            icon={<ArrowDownCircle size={24} className="text-red-600" />}
                        />
                        <KPICard
                            title="Impuestos Totales"
                            value={summaryState.totalTaxes}
                            color="border-orange-200 text-orange-600"
                            icon={<DollarSign size={24} className="text-orange-600" />}
                        />
                        <KPICard
                            title="Utilidad Neta"
                            value={summaryState.netProfit}
                            color={summaryState.netProfit >= 0 ? "border-indigo-200 text-indigo-600" : "border-red-200 text-red-600"}
                            icon={<TrendingUp size={24} className={summaryState.netProfit >= 0 ? "text-indigo-600" : "text-red-600"} />}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Chart */}
                        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tendencia Mensual</h3>
                                <div className="flex gap-4 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 bg-green-500 rounded-sm"></span>
                                        <span className="text-gray-600 dark:text-gray-300">Ingresos</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                                        <span className="text-gray-600 dark:text-gray-300">Gastos</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 bg-orange-500 rounded-sm"></span>
                                        <span className="text-gray-600 dark:text-gray-300">Impuestos</span>
                                    </div>
                                </div>
                            </div>
                            <SimpleBarChart data={summaryState.monthlySeries} />
                        </div>

                        {/* Projections Panel */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-xl shadow-lg flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                                    <Activity size={20} className="text-blue-400" />
                                    Promedios del periodo
                                </h3>
                                <p className="text-slate-400 text-xs mb-6">
                                    Basado en los datos seleccionados ({summaryState.monthlySeries.length} meses).
                                </p>

                                <div className="space-y-4">
                                    <div className="p-3 bg-white/10 rounded-lg">
                                        <div className="text-xs text-slate-300 uppercase mb-1">Ingreso promedio mensual</div>
                                        <div className="text-xl font-bold text-green-300">{formatCurrency(summaryState.avgIncome)}</div>
                                    </div>
                                    <div className="p-3 bg-white/10 rounded-lg">
                                        <div className="text-xs text-slate-300 uppercase mb-1">Gasto promedio mensual</div>
                                        <div className="text-xl font-bold text-red-300">{formatCurrency(summaryState.avgExpenses)}</div>
                                    </div>
                                    <div className="p-3 bg-white/10 rounded-lg">
                                        <div className="text-xs text-slate-300 uppercase mb-1">Utilidad promedio mensual</div>
                                        <div className={`text-xl font-bold ${summaryState.avgProfit >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>
                                            {formatCurrency(summaryState.avgProfit)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-white/10 text-xs text-slate-500 text-center">
                                * Proyección aritmética simple. No representa asesoría fiscal.
                            </div>
                        </div>
                    </div>

                    {/* Detail Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Detalle de movimientos</h3>
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                                {summaryState.detailedMovements.length} registros
                            </span>
                        </div>
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Concepto</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origen</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {summaryState.detailedMovements.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No hay movimientos en este periodo.</td>
                                        </tr>
                                    ) : (
                                        summaryState.detailedMovements.map((m) => (
                                            <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{m.date}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{m.concept}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-gray-500 dark:text-gray-400">
                                                    {m.sourceTool === 'ingresos-manager' ? 'Ingresos Mgr' : 'Tax Tracker'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.kind === 'income' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                        m.kind === 'expense' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                            'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                                        }`}>
                                                        {m.kind === 'income' ? 'Ingreso' : m.kind === 'expense' ? 'Gasto' : 'Impuesto'}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium ${m.kind === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {formatCurrency(m.amount)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
