import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    type ChartOptions,
    type ChartData
} from 'chart.js';
import { loadMovementsFromStore } from '../../../modules/ingresos-manager/utils';
import { buildIncomeDashboardMetrics, type IncomeDashboardMetrics } from '../../../modules/ingresos-manager/metrics';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

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

    if (loading) {
        return <div className="h-full flex items-center justify-center text-gray-400">Cargando...</div>;
    }

    if (!metrics) {
        return <div className="h-full flex items-center justify-center text-gray-400">No hay datos disponibles</div>;
    }

    const { currentMonth, previousMonth } = metrics;
    const incomeDiff = currentMonth.income - previousMonth.income;
    const expenseDiff = currentMonth.expense - previousMonth.expense;
    const netDiff = currentMonth.net - previousMonth.net;

    return (
        <div className="h-full flex flex-col justify-between">
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
        </div>
    );
}

export function IncomeTrendWidget() {
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

    if (loading) return <div className="h-full flex items-center justify-center text-gray-400">Cargando...</div>;
    if (!metrics) return <div className="h-full flex items-center justify-center text-gray-400">No hay datos</div>;

    const data: ChartData<'bar'> = {
        labels: metrics.monthlySeries.map(d => d.month),
        datasets: [
            {
                label: 'Neto',
                data: metrics.monthlySeries.map(d => d.net),
                backgroundColor: metrics.monthlySeries.map(d => d.net >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                borderRadius: 4,
            }
        ]
    };

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => formatCurrency(ctx.raw as number)
                }
            }
        },
        scales: {
            x: { display: false },
            y: { display: false }
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    <Activity className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Tendencia (6 meses)</h3>
            </div>
            <div className="flex-1 min-h-0">
                <Bar data={data} options={options} />
            </div>
        </div>
    );
}
