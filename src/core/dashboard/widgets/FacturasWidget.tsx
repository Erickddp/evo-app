import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { dataStore } from '../../data/dataStore';

interface FacturasStats {
    count: number;
    amount: number;
    pendingCount: number;
    pendingAmount: number;
}

export function FacturasWidget() {
    const [stats, setStats] = useState<FacturasStats | null>(null);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            try {
                const records = await dataStore.listRecords<any>('facturas-manager');
                if (!isMounted) return;

                const currentMonth = new Date().toISOString().slice(0, 7);
                const invoices = records
                    .filter(r => r.payload.type === 'invoice')
                    .map(r => r.payload.data);

                const monthInvoices = invoices.filter((inv: any) => inv.month === currentMonth);

                const count = monthInvoices.length;
                const amount = monthInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);
                const pending = monthInvoices.filter((inv: any) => !inv.paid);
                const pendingCount = pending.length;
                const pendingAmount = pending.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);

                setStats({ count, amount, pendingCount, pendingAmount });
            } catch (e) {
                console.error(e);
            }
        }
        void load();
        return () => { isMounted = false; };
    }, []);

    const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    return (
        <div className="group h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <FileText className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Facturación</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Basado en el módulo Facturas.</p>
                </div>
            </div>

            {!stats ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de facturación este mes.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Facturas este mes</p>
                        <div className="flex items-baseline space-x-2">
                            <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.count}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">· {formatCurrency(stats.amount)}</span>
                        </div>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800">
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Pendientes de pago</p>
                        <div className="flex items-baseline space-x-2">
                            <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.pendingCount}</span>
                            <span className="text-sm text-amber-600 dark:text-amber-400">· {formatCurrency(stats.pendingAmount)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
