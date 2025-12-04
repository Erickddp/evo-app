import { FileText } from 'lucide-react';
import { useTaxSummary } from '../../../modules/tax-tracker/hooks';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export function TaxOverviewWidget() {
    const { totalYear, totalIVA, lastPayment, monthlySummary, loading } = useTaxSummary();

    const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    if (loading) {
        return (
            <div className="h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 animate-pulse">
                <div className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                <div className="space-y-4">
                    <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded"></div>
                    <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded"></div>
                </div>
            </div>
        );
    }

    const labels = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

    const data = {
        labels,
        datasets: [
            {
                label: 'Impuestos totales',
                data: monthlySummary.map(m => m.total),
                backgroundColor: 'rgba(99, 102, 241, 0.8)', // Indigo-500
                hoverBackgroundColor: 'rgba(79, 70, 229, 1)', // Indigo-600
                borderRadius: 4,
            },
            {
                label: 'IVA',
                data: monthlySummary.map(m => m.iva),
                backgroundColor: 'rgba(59, 130, 246, 0.5)', // Blue-500
                hoverBackgroundColor: 'rgba(37, 99, 235, 0.8)', // Blue-600
                borderRadius: 4,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: '#9CA3AF', // Gray-400
                    font: {
                        size: 10
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                    color: '#374151' // Gray-700
                },
                ticks: {
                    color: '#9CA3AF', // Gray-400
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(107, 114, 128, 0.1)' // Gray-500 with opacity
                },
                ticks: {
                    color: '#9CA3AF', // Gray-400
                    font: {
                        size: 10
                    },
                    callback: function (value: any) {
                        return new Intl.NumberFormat('es-MX', {
                            notation: "compact",
                            compactDisplay: "short"
                        }).format(value);
                    }
                }
            }
        }
    };

    return (
        <div className="group h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                    <FileText className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Resumen de impuestos</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Basado en el módulo Tax Tracker.</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* TOTAL AÑO ACTUAL */}
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total año actual</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalYear)}</p>
                    </div>

                    {/* ÚLTIMO PAGO */}
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Último pago</p>
                        {lastPayment ? (
                            <>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(lastPayment.amount)}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {lastPayment.type} · {lastPayment.date}
                                </p>
                            </>
                        ) : (
                            <p className="text-xl font-bold text-gray-900 dark:text-white">-</p>
                        )}
                    </div>

                    {/* IVA (AÑO) */}
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">IVA (Año)</p>
                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalIVA)}</p>
                    </div>
                </div>

                {/* Chart */}
                <div className="h-64 w-full">
                    <Bar options={options} data={data} />
                </div>
            </div>
        </div>
    );
}
