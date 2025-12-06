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
import { WidgetSkeleton, WidgetCard } from './WidgetCommon';

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

    if (loading) return <WidgetSkeleton />;

    // Check if error handling is needed - assuming hook might return zeros/empty if error or just successful empty
    // We can assume if totalYear is 0 and lastPayment is null, likely empty.

    const isEmpty = totalYear === 0 && !lastPayment && monthlySummary.every(m => m.total === 0);

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
        <WidgetCard>
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Resumen de Impuestos</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Basado en el módulo Tax Tracker.</p>
                    </div>
                </div>

                {isEmpty ? (
                    <div className="text-center py-8">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sin pagos de impuestos registrados para este año.</p>
                    </div>
                ) : (
                    <div className="space-y-6 flex-1 flex flex-col">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* TOTAL AÑO ACTUAL */}
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total año actual</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalYear)}</p>
                            </div>

                            {/* IVA (AÑO) */}
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">IVA (Año)</p>
                                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalIVA)}</p>
                            </div>

                            {/* ÚLTIMO PAGO */}
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Último pago</p>
                                {lastPayment ? (
                                    <>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(lastPayment.amount)}</p>
                                        <p className="text-xs text-gray-400 mt-1 truncate">
                                            {lastPayment.type} · {new Date(lastPayment.date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">-</p>
                                )}
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="flex-1 min-h-[200px] w-full mt-4">
                            <Bar options={options} data={data} />
                        </div>
                    </div>
                )}
            </div>
        </WidgetCard>
    );
}
