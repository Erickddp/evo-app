import React, { useState, useMemo } from 'react';
import { PieChart, ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, Activity, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { useFinancialData } from './hooks/useFinancialData';
import { buildFinancialSummary, type NormalizedMovement, type PeriodFilter } from './helpers';
import { TrendChart } from './components/TrendChart';

// --- Components ---

const KPICard: React.FC<{ title: string; value: number; color: string; icon: React.ReactNode }> = ({ title, value, color, icon }) => {
    const formatCurrency = (val: number) =>
        val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    return (
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
};

const MovementRow: React.FC<{ movement: NormalizedMovement }> = ({ movement }) => {
    const formatCurrency = (val: number) =>
        val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    return (
        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{movement.date}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{movement.concept}</td>
            <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-gray-500 dark:text-gray-400">
                {movement.sourceTool === 'ingresos-manager' ? 'Ingresos Mgr' :
                    movement.sourceTool === 'tax-tracker' ? 'Tax Tracker' : movement.sourceTool}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${movement.kind === 'income' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    movement.kind === 'expense' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                    }`}>
                    {movement.kind === 'income' ? 'Ingreso' : movement.kind === 'expense' ? 'Gasto' : 'Impuesto'}
                </span>
            </td>
            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium ${movement.kind === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                {formatCurrency(movement.amount)}
            </td>
        </tr>
    );
};

export const FinancialSummary: React.FC = () => {
    const { loading, allMovements } = useFinancialData();
    const [filter, setFilter] = useState<PeriodFilter>({ type: 'currentMonth' });
    const [showDetails, setShowDetails] = useState(false);

    // Derived state: Summary
    const summary = useMemo(() => {
        return buildFinancialSummary(allMovements, filter);
    }, [allMovements, filter]);

    // Derived state: Available months for the buttons (Current Year)
    const availableMonths = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const months = new Set<string>(); // "YYYY-MM"

        allMovements.forEach(m => {
            if (m.date.startsWith(`${currentYear}-`)) {
                months.add(m.date.substring(0, 7));
            }
        });

        // Convert to array and sort desc
        return Array.from(months)
            .sort((a, b) => b.localeCompare(a))
            .map(ym => {
                const [y, m] = ym.split('-');
                return {
                    year: parseInt(y),
                    month: parseInt(m),
                    label: m // "01", "02", etc
                };
            })
            .slice(0, 8); // Last 8 months max
    }, [allMovements]);

    // Helpers
    const formatCurrency = (value: number) =>
        value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    // Group movements for table
    const groupedMovements = React.useMemo(() => {
        const groups: Record<string, NormalizedMovement[]> = {};
        summary.detailedMovements.forEach(m => {
            const month = m.date.substring(0, 7);
            if (!groups[month]) groups[month] = [];
            groups[month].push(m);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [summary.detailedMovements]);

    // Custom date handlers
    const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
        if (filter.type !== 'custom') {
            // Initialize custom range if switching to it
            const today = new Date().toISOString().split('T')[0];
            setFilter({
                type: 'custom',
                start: type === 'start' ? value : today,
                end: type === 'end' ? value : today
            });
        } else {
            setFilter({
                ...filter,
                [type]: value
            });
        }
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header & Filters */}
            <div className="flex flex-col gap-6 border-b border-gray-200 dark:border-gray-700 pb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <PieChart className="text-indigo-600" /> Estado de resultados
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Resumen financiero automático.
                        </p>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Main Modes */}
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button
                            onClick={() => setFilter({ type: 'all' })}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filter.type === 'all'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Histórico
                        </button>
                        <button
                            onClick={() => setFilter({ type: 'currentMonth' })}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filter.type === 'currentMonth'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Mes actual
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2 hidden sm:block"></div>

                    {/* Month Buttons */}
                    <div className="flex flex-wrap gap-1">
                        {availableMonths.map((m) => {
                            const isActive = filter.type === 'month' && filter.month === m.month && filter.year === m.year;
                            return (
                                <button
                                    key={`${m.year}-${m.month}`}
                                    onClick={() => setFilter({ type: 'month', year: m.year, month: m.month })}
                                    className={`w-10 py-1.5 text-sm font-medium rounded-md transition-all border ${isActive
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                                        }`}
                                    title={`${m.year}-${m.label}`}
                                >
                                    {m.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2 hidden sm:block"></div>

                    {/* Custom Range */}
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => {
                                const today = new Date().toISOString().split('T')[0];
                                setFilter({ type: 'custom', start: today, end: today });
                            }}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filter.type === 'custom'
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400'
                                }`}
                        >
                            Personalizado
                        </button>

                        {filter.type === 'custom' && (
                            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-left-2">
                                <input
                                    type="date"
                                    value={filter.start}
                                    onChange={e => handleCustomDateChange('start', e.target.value)}
                                    className="text-xs border-none bg-transparent p-0 focus:ring-0 text-gray-600 dark:text-gray-300 w-24"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    value={filter.end}
                                    onChange={e => handleCustomDateChange('end', e.target.value)}
                                    className="text-xs border-none bg-transparent p-0 focus:ring-0 text-gray-600 dark:text-gray-300 w-24"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500 animate-pulse">Cargando datos financieros...</div>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <KPICard
                            title="Ingresos"
                            value={summary.totalIncome}
                            color="border-green-200 text-green-600"
                            icon={<ArrowUpCircle size={24} className="text-green-600" />}
                        />
                        <KPICard
                            title="Gastos"
                            value={summary.totalExpenses}
                            color="border-red-200 text-red-600"
                            icon={<ArrowDownCircle size={24} className="text-red-600" />}
                        />
                        <KPICard
                            title="Impuestos"
                            value={summary.totalTaxes}
                            color="border-orange-200 text-orange-600"
                            icon={<DollarSign size={24} className="text-orange-600" />}
                        />
                        <KPICard
                            title="Utilidad Neta"
                            value={summary.netProfit}
                            color={summary.netProfit >= 0 ? "border-indigo-200 text-indigo-600" : "border-red-200 text-red-600"}
                            icon={<TrendingUp size={24} className={summary.netProfit >= 0 ? "text-indigo-600" : "text-red-600"} />}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Chart */}
                        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tendencia</h3>
                            </div>
                            <TrendChart series={{
                                labels: summary.monthlySeries.map(d => d.month),
                                incomes: summary.monthlySeries.map(d => d.income),
                                expenses: summary.monthlySeries.map(d => d.expenses),
                                taxes: summary.monthlySeries.map(d => d.taxes),
                            }} />
                        </div>

                        {/* Projections / Stats Panel */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-xl shadow-lg flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                                    <Activity size={20} className="text-blue-400" />
                                    Promedios
                                </h3>
                                <p className="text-slate-400 text-xs mb-6">
                                    Basado en {Math.max(summary.monthlySeries.length, 1)} meses del periodo seleccionado.
                                </p>

                                <div className="space-y-4">
                                    <div className="p-3 bg-white/10 rounded-lg">
                                        <div className="text-xs text-slate-300 uppercase mb-1">Ingreso promedio</div>
                                        <div className="text-xl font-bold text-green-300">{formatCurrency(summary.avgIncome)}</div>
                                    </div>
                                    <div className="p-3 bg-white/10 rounded-lg">
                                        <div className="text-xs text-slate-300 uppercase mb-1">Gasto promedio</div>
                                        <div className="text-xl font-bold text-red-300">{formatCurrency(summary.avgExpenses)}</div>
                                    </div>
                                    <div className="p-3 bg-white/10 rounded-lg">
                                        <div className="text-xs text-slate-300 uppercase mb-1">Utilidad promedio</div>
                                        <div className={`text-xl font-bold ${summary.avgProfit >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>
                                            {formatCurrency(summary.avgProfit)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-white/10 text-xs text-slate-500 text-center">
                                * Datos filtrados según selección.
                            </div>
                        </div>
                    </div>

                    {/* Detail Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div
                            className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Detalle de movimientos</h3>
                                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                                    {summary.detailedMovements.length} registros
                                </span>
                            </div>
                            <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                {showDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                        </div>

                        {showDetails && (
                            <div className="overflow-x-auto max-h-[600px] animate-in fade-in slide-in-from-top-2">
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
                                        {summary.detailedMovements.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                                                    No hay movimientos en este periodo.
                                                </td>
                                            </tr>
                                        ) : (
                                            groupedMovements.map(([month, movements]) => (
                                                <React.Fragment key={month}>
                                                    <tr className="bg-gray-50 dark:bg-gray-900/30">
                                                        <td colSpan={5} className="px-6 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                            <Calendar size={14} />
                                                            {month}
                                                        </td>
                                                    </tr>
                                                    {movements.map((m) => (
                                                        <MovementRow key={m.id} movement={m} />
                                                    ))}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

