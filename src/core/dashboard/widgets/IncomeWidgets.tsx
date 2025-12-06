import { useEffect, useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, type ChartData, type ChartOptions } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { loadMovementsFromStore } from '../../../modules/ingresos-manager/utils';
import { buildIncomeDashboardMetrics, type IncomeDashboardMetrics } from '../../../modules/ingresos-manager/metrics';
import { WidgetSkeleton, WidgetCard, WidgetError } from './WidgetCommon';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const MONTH_NAMES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function getMonthName(ym: string) {
    // ym format is YYYY-MM
    const part = ym.split('-')[1];
    const monthIndex = parseInt(part, 10) - 1;
    return MONTH_NAMES[monthIndex] || ym;
}

export function IncomeBalanceWidget() {
    const [metrics, setMetrics] = useState<IncomeDashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        loadMovementsFromStore().then(movements => {
            if (isMounted) {
                setMetrics(buildIncomeDashboardMetrics(movements));
                setLoading(false);
            }
        });
        return () => { isMounted = false; };
    }, []);

    if (loading) return <WidgetSkeleton />;

    if (!metrics) {
        return (
            <WidgetCard>
                <div className="flex-1 flex items-center justify-center text-gray-400">No hay datos disponibles</div>
            </WidgetCard>
        );
    }

    const { currentMonth, previousMonth } = metrics;
    const incomeDiff = currentMonth.income - previousMonth.income;
    const expenseDiff = currentMonth.expense - previousMonth.expense;
    const netDiff = currentMonth.net - previousMonth.net;

    return (
        <WidgetCard>
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <DollarSign className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Balance Mensual</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Este mes vs mes anterior</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ingresos</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(currentMonth.income)}</p>
                    <div className={`flex items-center text-xs ${incomeDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {incomeDiff >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        <span className="ml-1">{formatCurrency(Math.abs(incomeDiff))}</span>
                    </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gastos</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(currentMonth.expense)}</p>
                    <div className={`flex items-center text-xs ${expenseDiff <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {expenseDiff > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        <span className="ml-1">{formatCurrency(Math.abs(expenseDiff))}</span>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance Neto</p>
                        <p className={`text-2xl font-bold ${currentMonth.net >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(currentMonth.net)}
                        </p>
                    </div>
                    <div className={`flex items-center text-sm font-medium ${netDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {netDiff >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                        {formatCurrency(Math.abs(netDiff))}
                    </div>
                </div>
            </div>
        </WidgetCard>
    );
}

export function IncomeTrendWidget() {
    const [metrics, setMetrics] = useState<IncomeDashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        loadMovementsFromStore().then(movements => {
            if (isMounted) {
                setMetrics(buildIncomeDashboardMetrics(movements));
                setLoading(false);
            }
        }).catch(err => {
            console.error(err);
            if (isMounted) {
                setError(true);
                setLoading(false);
            }
        });
        return () => { isMounted = false; };
    }, []);

    const summary = useMemo(() => {
        if (!metrics?.monthlySeries.length) return null;

        const series = metrics.monthlySeries;
        const totalIncome = series.reduce((sum, m) => sum + m.income, 0);
        const totalExpense = series.reduce((sum, m) => sum + m.expense, 0);
        const avgIncome = totalIncome / series.length;
        const avgExpense = totalExpense / series.length;

        const bestMonth = [...series].sort((a, b) => b.net - a.net)[0];

        return { avgIncome, avgExpense, bestMonth };
    }, [metrics]);

    if (loading) return <WidgetSkeleton />;
    if (error) return <WidgetError message="No fue posible cargar la tendencia de ingresos." />;

    // Check if we have actual data or just empty months
    const hasData = metrics?.monthlySeries.some(m => m.income > 0 || m.expense > 0);

    if (!metrics || !hasData) {
        return (
            <WidgetCard>
                <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        <Activity className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Tendencia (6 meses)</h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Sin movimientos suficientes para mostrar la tendencia.</p>
                </div>
            </WidgetCard>
        );
    }

    const labels = metrics.monthlySeries.map(d => getMonthName(d.month));

    const chartData: ChartData = {
        labels,
        datasets: [
            {
                type: 'bar' as const,
                label: 'Ingresos',
                data: metrics.monthlySeries.map(d => d.income),
                backgroundColor: 'rgba(16, 185, 129, 0.7)', // Emerald-500
                hoverBackgroundColor: 'rgba(16, 185, 129, 0.9)',
                order: 2,
                borderRadius: 4,
            },
            {
                type: 'bar' as const,
                label: 'Gastos',
                data: metrics.monthlySeries.map(d => d.expense),
                backgroundColor: 'rgba(239, 68, 68, 0.7)', // Red-500
                hoverBackgroundColor: 'rgba(239, 68, 68, 0.9)',
                order: 3,
                borderRadius: 4,
            },
            {
                type: 'line' as const,
                label: 'Neto',
                data: metrics.monthlySeries.map(d => d.net),
                borderColor: 'rgba(99, 102, 241, 0.8)', // Indigo-500
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: false,
                tension: 0.3,
                order: 1,
            }
        ]
    };

    const options: ChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
                align: 'end',
                labels: {
                    boxWidth: 8,
                    usePointStyle: true,
                    font: { size: 10 },
                    color: '#9CA3AF' // Gray-400
                }
            },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        let label = ctx.dataset.label || '';
                        if (label) label += ': ';
                        if (ctx.parsed.y !== null) label += formatCurrency(ctx.parsed.y);
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#9CA3AF', font: { size: 10 } }
            },
            y: {
                grid: { color: 'rgba(107, 114, 128, 0.1)' },
                ticks: {
                    color: '#9CA3AF',
                    font: { size: 10 },
                    callback: (val) => new Intl.NumberFormat('es-MX', { notation: "compact", compactDisplay: "short" }).format(Number(val))
                }
            }
        }
    };

    return (
        <WidgetCard>
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                            <Activity className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Tendencia (6 meses)</h3>
                    </div>
                </div>

                {summary && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400 mb-3 px-1">
                        <span>Prom. Ingresos: <b className="text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.avgIncome)}</b></span>
                        <span>Prom. Gastos: <b className="text-red-600 dark:text-red-400">{formatCurrency(summary.avgExpense)}</b></span>
                        {summary.bestMonth && (
                            <span>Mejor mes: <b>{getMonthName(summary.bestMonth.month)}</b> ({formatCurrency(summary.bestMonth.net)})</span>
                        )}
                    </div>
                )}

                <div className="flex-1 min-h-0 w-full">
                    <Chart type='bar' data={chartData} options={options} />
                </div>
            </div>
        </WidgetCard>
    );
}

