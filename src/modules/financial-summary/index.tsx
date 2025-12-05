import React, { useState } from 'react';
import { PieChart, ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, Activity, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { useFinancialData, type NormalizedMovement } from './hooks/useFinancialData';
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
    const { loading, summary, filter, setFilter } = useFinancialData();
    const [showDetails, setShowDetails] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const formatCurrency = (value: number) =>
        value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    const handlePresetChange = (preset: 'all' | 'month' | 'year' | 'custom') => {
        if (preset === 'all') setFilter({ mode: 'historico' });
        else if (preset === 'month') setFilter({ mode: 'mesActual' });
        else if (preset === 'year') setFilter({ mode: 'esteAnio' });
        else if (preset === 'custom') {
            // Initialize with today if empty
            const today = new Date().toISOString().split('T')[0];
            setCustomStart(today);
            setCustomEnd(today);
            setFilter({ mode: 'rango', from: today, to: today });
        }
    };

    const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
        if (type === 'start') {
            setCustomStart(value);
            if (filter.mode === 'rango') {
                setFilter({ ...filter, from: value });
            }
        } else {
            setCustomEnd(value);
            if (filter.mode === 'rango') {
                setFilter({ ...filter, to: value });
            }
        }
    };

    // Group movements by Month for the details view
    const groupedMovements = React.useMemo(() => {
        const groups: Record<string, NormalizedMovement[]> = {};
        summary.detailedMovements.forEach(m => {
            const month = m.date.substring(0, 7); // YYYY-MM
            if (!groups[month]) groups[month] = [];
            groups[month].push(m);
        });
        // Sort months descending
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [summary.detailedMovements]);

    const currentPreset = filter.mode === 'historico' ? 'all' :
        filter.mode === 'mesActual' ? 'month' :
            filter.mode === 'esteAnio' ? 'year' : 'custom';

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
                                onClick={() => handlePresetChange(p)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${currentPreset === p
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

                    {currentPreset === 'custom' && (
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">De:</span>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={e => handleCustomDateChange('start', e.target.value)}
                                    className="text-xs border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">A:</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={e => handleCustomDateChange('end', e.target.value)}
                                    className="text-xs border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Cargando datos financieros...</div>
            ) : summary.detailedMovements.length === 0 && filter.mode === 'historico' ? (
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
                            value={summary.totalIncome}
                            color="border-green-200 text-green-600"
                            icon={<ArrowUpCircle size={24} className="text-green-600" />}
                        />
                        <KPICard
                            title="Gastos Totales"
                            value={summary.totalExpenses}
                            color="border-red-200 text-red-600"
                            icon={<ArrowDownCircle size={24} className="text-red-600" />}
                        />
                        <KPICard
                            title="Impuestos Totales"
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
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tendencia Mensual</h3>
                            </div>
                            <TrendChart data={summary.monthlySeries} />
                        </div>

                        {/* Projections Panel */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-xl shadow-lg flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                                    <Activity size={20} className="text-blue-400" />
                                    Promedios del periodo
                                </h3>
                                <p className="text-slate-400 text-xs mb-6">
                                    Basado en los datos seleccionados ({Math.max(summary.monthlySeries.length, 1)} meses).
                                </p>

                                <div className="space-y-4">
                                    <div className="p-3 bg-white/10 rounded-lg">
                                        <div className="text-xs text-slate-300 uppercase mb-1">Ingreso promedio mensual</div>
                                        <div className="text-xl font-bold text-green-300">{formatCurrency(summary.avgIncome)}</div>
                                    </div>
                                    <div className="p-3 bg-white/10 rounded-lg">
                                        <div className="text-xs text-slate-300 uppercase mb-1">Gasto promedio mensual</div>
                                        <div className="text-xl font-bold text-red-300">{formatCurrency(summary.avgExpenses)}</div>
                                    </div>
                                    <div className="p-3 bg-white/10 rounded-lg">
                                        <div className="text-xs text-slate-300 uppercase mb-1">Utilidad promedio mensual</div>
                                        <div className={`text-xl font-bold ${summary.avgProfit >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>
                                            {formatCurrency(summary.avgProfit)}
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
                                                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No hay movimientos en este periodo.</td>
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

