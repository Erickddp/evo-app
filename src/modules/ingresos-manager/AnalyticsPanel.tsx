import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    PointElement,
    LineElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { type EvoTransaction } from '../../core/domain/evo-transaction';
import { getMonthlySummary } from './utils';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    PointElement,
    LineElement
);

interface AnalyticsPanelProps {
    movements: EvoTransaction[];
    currentView: string;
    selectedYear: number;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ movements, currentView, selectedYear }) => {
    const monthlyData = useMemo(() => getMonthlySummary(movements), [movements]);

    // Filter for the chart based on view/year if needed, 
    // but usually analytics shows a broader trend (e.g. whole year) even if looking at a month.
    // Let's decide: 
    // If view is 'year' or 'historic', show all available months in that scope.
    // If view is 'month', maybe show the last 6 months trend?

    // For now, let's show the data relevant to the selected year if in 'year' view, 
    // or last 12 months if in 'historic' or 'month' view to give context.

    const chartData = useMemo(() => {
        let data = monthlyData;

        if (currentView === 'year') {
            data = monthlyData.filter(d => d.month.startsWith(selectedYear.toString()));
        } else {
            // Default to last 12 months for other views to show trend
            data = monthlyData.slice(-12);
        }
        return data;
    }, [monthlyData, currentView, selectedYear]);

    const labels = chartData.map(d => d.month);

    const barData = {
        labels,
        datasets: [
            {
                label: 'Ingresos',
                data: chartData.map(d => d.income),
                backgroundColor: 'rgba(34, 197, 94, 0.6)', // green-500
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 1,
            },
            {
                label: 'Gastos',
                data: chartData.map(d => d.expense),
                backgroundColor: 'rgba(239, 68, 68, 0.6)', // red-500
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1,
            },
        ],
    };

    // Cumulative Net Balance
    const lineData = {
        labels,
        datasets: [
            {
                label: 'Saldo Acumulado',
                data: chartData.reduce((acc, curr, idx) => {
                    const prev = idx > 0 ? acc[idx - 1] : 0;
                    acc.push(prev + curr.net);
                    return acc;
                }, [] as number[]),
                borderColor: 'rgba(99, 102, 241, 1)', // indigo-500
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                tension: 0.3,
                fill: true,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#374151'
                }
            },
            title: {
                display: false,
            },
        },
        scales: {
            y: {
                ticks: { color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#374151' },
                grid: { color: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb' }
            },
            x: {
                ticks: { color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#374151' },
                grid: { color: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb' }
            }
        }
    };

    if (movements.length === 0) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Ingresos vs Gastos</h4>
                <Bar data={barData} options={options} />
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Evolución Saldo</h4>
                <Line data={lineData} options={options} />
            </div>
        </div>
    );
};
