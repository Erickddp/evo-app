import React, { useMemo } from 'react';
import type { TaxPayment } from '../types';

interface Props {
    payments: TaxPayment[];
    incomeMovements: Array<{ date: string; amount: number }>;
}

export const TaxIncomeChart: React.FC<Props> = ({ payments, incomeMovements }) => {
    const data = useMemo(() => {
        const now = new Date();
        const months: string[] = [];
        // Last 12 months
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d.toISOString().slice(0, 7));
        }

        const incomeMap = new Map<string, number>();
        incomeMovements.forEach(m => {
            const key = m.date.slice(0, 7);
            incomeMap.set(key, (incomeMap.get(key) || 0) + m.amount);
        });

        const taxMap = new Map<string, number>();
        payments.forEach(p => {
            const key = p.date.slice(0, 7);
            taxMap.set(key, (taxMap.get(key) || 0) + p.amount);
        });

        const history = months.map(month => ({
            month,
            income: incomeMap.get(month) || 0,
            tax: taxMap.get(month) || 0,
            isForecast: false
        }));

        // Forecast for next 3 months
        const last3Months = history.slice(-3);
        const avgIncome = last3Months.reduce((sum, item) => sum + item.income, 0) / 3 || 0;
        const avgTaxRatio = last3Months.reduce((sum, item) => sum + (item.income > 0 ? item.tax / item.income : 0), 0) / 3 || 0.16; // Default to 16% if no data

        const forecast = [];
        for (let i = 1; i <= 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const month = d.toISOString().slice(0, 7);
            forecast.push({
                month,
                income: avgIncome,
                tax: avgIncome * avgTaxRatio,
                isForecast: true
            });
        }

        return [...history, ...forecast];
    }, [payments, incomeMovements]);

    const maxVal = Math.max(...data.map(d => Math.max(d.income, d.tax)), 1);

    const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const getMonthName = (dateStr: string) => {
        const [year, month] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleString('es-MX', { month: 'short' });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ingresos vs Impuestos</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Comparativa histórica y proyección estimada basada en el comportamiento reciente.
            </p>

            <div className="relative h-64 w-full">
                <div className="absolute inset-0 flex items-end gap-2 md:gap-4">
                    {data.map((item) => {
                        const incomeHeight = (item.income / maxVal) * 100;
                        const taxHeight = (item.tax / maxVal) * 100;

                        return (
                            <div key={item.month} className="flex-1 flex flex-col justify-end h-full group relative">
                                {/* Tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10 pointer-events-none transition-opacity">
                                    <div className="font-bold">{getMonthName(item.month)} {item.isForecast ? '(Est.)' : ''}</div>
                                    <div>Ingresos: {formatCurrency(item.income)}</div>
                                    <div>Impuestos: {formatCurrency(item.tax)}</div>
                                </div>

                                <div className="flex gap-1 items-end justify-center w-full h-full">
                                    {/* Income Bar */}
                                    <div
                                        className={`w-1/3 rounded-t transition-all ${item.isForecast ? 'bg-green-200 dark:bg-green-900/30 dashed-border' : 'bg-green-500 dark:bg-green-600'}`}
                                        style={{ height: `${Math.max(incomeHeight, 1)}%` }}
                                    />
                                    {/* Tax Bar */}
                                    <div
                                        className={`w-1/3 rounded-t transition-all ${item.isForecast ? 'bg-red-200 dark:bg-red-900/30' : 'bg-red-500 dark:bg-red-600'}`}
                                        style={{ height: `${Math.max(taxHeight, 1)}%` }}
                                    />
                                </div>

                                <div className="mt-2 text-[10px] text-center text-gray-500 dark:text-gray-400 truncate w-full">
                                    {getMonthName(item.month)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-center gap-6 mt-6 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                    <span className="text-gray-600 dark:text-gray-300">Ingresos</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                    <span className="text-gray-600 dark:text-gray-300">Impuestos</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-sm"></div>
                    <span className="text-gray-500 dark:text-gray-400">Proyección (Estimado)</span>
                </div>
            </div>
        </div>
    );
};
