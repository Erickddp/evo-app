import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { dataStore } from '../../data/dataStore';
import { sanitizeTaxPayment, calculateTaxStats } from '../../../modules/tax-tracker/helpers';

interface TaxStats {
    currentYearTotal: number;
    lastYearTotal: number;
    monthlySeries: { month: string; amount: number }[];
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
    ivaPaidYear: number;
    isrPaidYear: number;
}

export function TaxOverviewWidget() {
    const [stats, setStats] = useState<TaxStats | null>(null);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            try {
                const records = await dataStore.listRecords<any>('tax-tracker');
                if (!isMounted) return;

                const payments = records.map(r => sanitizeTaxPayment(r.payload));
                const calculated = calculateTaxStats(payments);
                setStats(calculated);
            } catch (e) {
                console.error(e);
            }
        }
        void load();
        return () => { isMounted = false; };
    }, []);

    const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    const getMonthName = (dateStr: string) => {
        const [year, month] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleString('es-MX', { month: 'short' });
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

            {!stats ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No hay pagos de impuestos registrados aún.</p>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total año actual</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.currentYearTotal)}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Último pago</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.lastPaymentAmount ? formatCurrency(stats.lastPaymentAmount) : '-'}</p>
                            <p className="text-xs text-gray-400 mt-1">{stats.lastPaymentDate || '-'}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">IVA (Año)</p>
                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(stats.ivaPaidYear)}</p>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex items-end gap-2 h-32 border-b border-gray-200 dark:border-gray-700 pb-2">
                            {stats.monthlySeries.map((item) => {
                                const maxAmount = Math.max(...stats.monthlySeries.map(s => s.amount), 1);
                                const heightPercent = Math.max((item.amount / maxAmount) * 100, 4);
                                return (
                                    <div key={item.month} className="flex-1 flex flex-col justify-end group/bar relative">
                                        <div className="w-full rounded-t bg-indigo-500 dark:bg-indigo-400 transition-all hover:bg-indigo-600 dark:hover:bg-indigo-300" style={{ height: `${heightPercent}%` }} title={`${item.month}: ${formatCurrency(item.amount)}`} />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-2 pt-2">
                            {stats.monthlySeries.map((item) => (
                                <div key={item.month} className="flex-1 text-center">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">{getMonthName(item.month)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
