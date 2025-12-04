import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    type ChartData,
    type ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { type MonthlyTrendPoint } from '../hooks/useFinancialData';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface TrendChartProps {
    data: MonthlyTrendPoint[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
    const chartData: ChartData<'bar'> = {
        labels: data.map(d => d.month),
        datasets: [
            {
                label: 'Ingresos',
                data: data.map(d => d.income),
                backgroundColor: 'rgba(34, 197, 94, 0.7)', // green-500
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 1,
            },
            {
                label: 'Gastos',
                data: data.map(d => d.expenses),
                backgroundColor: 'rgba(239, 68, 68, 0.7)', // red-500
                borderColor: 'rgb(239, 68, 68)',
                borderWidth: 1,
            },
            {
                label: 'Impuestos',
                data: data.map(d => d.taxes),
                backgroundColor: 'rgba(249, 115, 22, 0.7)', // orange-500
                borderColor: 'rgb(249, 115, 22)',
                borderWidth: 1,
            },
        ],
    };

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                }
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
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
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function (value) {
                        return new Intl.NumberFormat('es-MX', {
                            notation: "compact",
                            compactDisplay: "short"
                        }).format(Number(value));
                    }
                }
            }
        }
    };

    if (data.length === 0) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <p className="text-sm">No hay datos para mostrar en este periodo</p>
            </div>
        );
    }

    return (
        <div className="h-80 w-full">
            <Bar data={chartData} options={options} />
        </div>
    );
};
