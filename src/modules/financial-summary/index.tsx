import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { dataStore } from '../../core/data/dataStore';
import type { Movement as IngresosMovement } from '../ingresos-manager/index';
import type { TaxPayment } from '../tax-tracker/types';

// --- Types ---

type MovementKind = 'income' | 'expense' | 'tax';

interface NormalizedMovement {
    id: string;
    date: string;       // ISO date
    concept: string;
    amount: number;     // positive value
    kind: MovementKind; // 'income' | 'expense' | 'tax'
    sourceTool: string; // 'ingresos-manager' | 'bank-reconciler' | 'tax-tracker'
}

type PeriodPreset = 'all' | 'month' | 'year' | 'last12';

// --- Helpers ---

const formatCurrency = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const getPeriodDates = (preset: PeriodPreset): { start: string | null, end: string | null } => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (preset) {
        case 'month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            return { start, end: today };
        }
        case 'year': {
            const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
            return { start, end: today };
        }
        case 'last12': {
            const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
            return { start, end: today };
        }
        case 'all':
        default:
            return { start: null, end: null };
    }
};

// --- Components ---

const KPICard: React.FC<{ title: string; value: number; color: string; icon: React.ReactNode }> = ({ title, value, color, icon }) => (
    <div className={`p-4 rounded-xl border ${color} bg-white dark:bg-gray-800 shadow-sm`}>
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

const SimpleBarChart: React.FC<{ data: { month: string; income: number; expense: number; tax: number }[] }> = ({ data }) => {
    if (data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">No data for chart</div>;

    const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense, d.tax)));

    return (
        <div className="h-64 flex items-end gap-4 overflow-x-auto pb-2 pt-8 px-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {data.map((d) => (
                <div key={d.month} className="flex flex-col items-center gap-1 min-w-[80px]">
                    <div className="flex gap-1 items-end h-full w-full justify-center px-1">
                        {/* Income */}
                        <div
                            className="w-4 bg-green-500 rounded-t-sm hover:opacity-80 transition-opacity relative group"
                            style={{ height: `${maxVal > 0 ? (d.income / maxVal) * 100 : 0}%` }}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs p-1 rounded whitespace-nowrap z-10 shadow-lg">
                                Income: {formatCurrency(d.income)}
                            </div>
                        </div>
                        {/* Expense */}
                        <div
                            className="w-4 bg-red-500 rounded-t-sm hover:opacity-80 transition-opacity relative group"
                            style={{ height: `${maxVal > 0 ? (d.expense / maxVal) * 100 : 0}%` }}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs p-1 rounded whitespace-nowrap z-10 shadow-lg">
                                Expense: {formatCurrency(d.expense)}
                            </div>
                        </div>
                        {/* Tax */}
                        <div
                            className="w-4 bg-orange-500 rounded-t-sm hover:opacity-80 transition-opacity relative group"
                            style={{ height: `${maxVal > 0 ? (d.tax / maxVal) * 100 : 0}%` }}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs p-1 rounded whitespace-nowrap z-10 shadow-lg">
                                Tax: {formatCurrency(d.tax)}
                            </div>
                        </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{d.month}</span>
                </div>
            ))}
        </div>
    );
};

export const FinancialSummary: React.FC = () => {
    const [movements, setMovements] = useState<NormalizedMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<PeriodPreset>(() => {
        return (localStorage.getItem('evorix-financial-summary-range') as PeriodPreset) || 'year';
    });

    useEffect(() => {
        localStorage.setItem('evorix-financial-summary-range', period);
    }, [period]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const allMovements: NormalizedMovement[] = [];

                // 1. Load Ingresos Manager (Income/Expense)
                const ingresosRecords = await dataStore.listRecords<{ movements: IngresosMovement[] }>('ingresos-manager');
                if (ingresosRecords.length > 0) {
                    // Sort by createdAt desc to get latest snapshot
                    ingresosRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    const latest = ingresosRecords[0].payload.movements || [];

                    latest.forEach(m => {
                        allMovements.push({
                            id: m.id,
                            date: m.date,
                            concept: m.concept,
                            amount: Math.abs(m.amount),
                            kind: m.amount >= 0 ? 'income' : 'expense',
                            sourceTool: 'ingresos-manager'
                        });
                    });
                }

                // 2. Load Tax Tracker (Tax)
                const taxRecords = await dataStore.listRecords<TaxPayment>('tax-tracker');
                taxRecords.forEach(r => {
                    const p = r.payload;
                    allMovements.push({
                        id: p.id,
                        date: p.date,
                        concept: p.concept,
                        amount: p.amount,
                        kind: 'tax',
                        sourceTool: 'tax-tracker'
                    });
                });

                // Sort by date desc
                allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setMovements(allMovements);

            } catch (e) {
                console.error("Failed to load financial data", e);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Filter
    const filteredMovements = useMemo(() => {
        const { start, end } = getPeriodDates(period);
        if (!start || !end) return movements;

        return movements.filter(m => m.date >= start && m.date <= end);
    }, [movements, period]);

    // Stats
    const stats = useMemo(() => {
        let totalIncome = 0;
        let totalExpense = 0;
        let totalTax = 0;

        filteredMovements.forEach(m => {
            if (m.kind === 'income') totalIncome += m.amount;
            else if (m.kind === 'expense') totalExpense += m.amount;
            else if (m.kind === 'tax') totalTax += m.amount;
        });

        return {
            totalIncome,
            totalExpense,
            totalTax,
            netProfit: totalIncome - totalExpense - totalTax,
            count: filteredMovements.length
        };
    }, [filteredMovements]);

    // Chart Data
    const chartData = useMemo(() => {
        const groups: Record<string, { income: number; expense: number; tax: number }> = {};

        filteredMovements.forEach(m => {
            const month = m.date.substring(0, 7); // YYYY-MM
            if (!groups[month]) groups[month] = { income: 0, expense: 0, tax: 0 };

            if (m.kind === 'income') groups[month].income += m.amount;
            else if (m.kind === 'expense') groups[month].expense += m.amount;
            else if (m.kind === 'tax') groups[month].tax += m.amount;
        });

        return Object.entries(groups)
            .map(([month, vals]) => ({ month, ...vals }))
            .sort((a, b) => a.month.localeCompare(b.month)); // Ascending for chart
    }, [filteredMovements]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PieChart className="text-indigo-600" /> Financial Summary
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">Automatic income statement generated from your recorded movements.</p>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {(['all', 'month', 'year', 'last12'] as PeriodPreset[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${period === p
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            {p === 'all' ? 'Full History' :
                                p === 'month' ? 'This Month' :
                                    p === 'year' ? 'This Year' : 'Last 12M'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading financial data...</div>
            ) : movements.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <Activity className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">No data available</h3>
                    <p className="text-gray-500 dark:text-gray-400">Record some income, expenses, or tax payments to see your summary.</p>
                </div>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <KPICard
                            title="Total Income"
                            value={stats.totalIncome}
                            color="border-green-200 text-green-600"
                            icon={<ArrowUpCircle size={24} className="text-green-600" />}
                        />
                        <KPICard
                            title="Total Expenses"
                            value={stats.totalExpense}
                            color="border-red-200 text-red-600"
                            icon={<ArrowDownCircle size={24} className="text-red-600" />}
                        />
                        <KPICard
                            title="Total Taxes"
                            value={stats.totalTax}
                            color="border-orange-200 text-orange-600"
                            icon={<DollarSign size={24} className="text-orange-600" />}
                        />
                        <KPICard
                            title="Net Profit"
                            value={stats.netProfit}
                            color={stats.netProfit >= 0 ? "border-indigo-200 text-indigo-600" : "border-red-200 text-red-600"}
                            icon={<TrendingUp size={24} className={stats.netProfit >= 0 ? "text-indigo-600" : "text-red-600"} />}
                        />
                    </div>

                    {/* Chart */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Breakdown</h3>
                        <SimpleBarChart data={chartData} />
                        <div className="mt-4 flex justify-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-green-500 rounded-sm"></span>
                                <span className="text-gray-600 dark:text-gray-300">Income</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                                <span className="text-gray-600 dark:text-gray-300">Expenses</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-orange-500 rounded-sm"></span>
                                <span className="text-gray-600 dark:text-gray-300">Taxes</span>
                            </div>
                        </div>
                    </div>

                    {/* Detail Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Detailed Movements</h3>
                        </div>
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Concept</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredMovements.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No movements in this period.</td>
                                        </tr>
                                    ) : (
                                        filteredMovements.map((m) => (
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
                                                        {m.kind === 'income' ? 'Income' : m.kind === 'expense' ? 'Expense' : 'Tax'}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium ${m.kind === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {m.kind !== 'income' && '-'} {formatCurrency(m.amount)}
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
