import { useEffect, useState, useMemo } from 'react';
import { FileText, Calendar } from 'lucide-react';
import { dataStore } from '../../data/dataStore';
import { evoStore } from '../../evoappDataStore';
import { WidgetSkeleton, WidgetError, WidgetCard } from './WidgetCommon';
import { evoEvents } from '../../events';

type Period = 'currentMonth' | 'last3Months' | 'currentYear';

export function FacturasWidget() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [period, setPeriod] = useState<Period>('currentMonth');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            try {
                // Determine source: try canonical evoStore first, then legacy
                let loadedInvoices: any[] = [];
                const canonicalInvoices = await evoStore.facturas.getAll();

                if (canonicalInvoices.length > 0) {
                    loadedInvoices = canonicalInvoices;
                } else {
                    const legacyRecords = await dataStore.listRecords<any>('facturas-manager');
                    if (legacyRecords.length > 0) {
                        loadedInvoices = legacyRecords
                            .filter(r => r.payload.type === 'invoice')
                            .map(r => r.payload.data)
                            // Map legacy to generic structure if needed - key fields are date/fecha, amount/total, paid state
                            .map(legacy => ({
                                ...legacy,
                                fechaEmision: legacy.date || legacy.createdAt, // Ensure date field availability
                                total: Number(legacy.amount) || 0,
                                pagada: !!legacy.paid
                            }));
                    }
                }

                if (isMounted) {
                    setInvoices(loadedInvoices);
                    setLoading(false);
                }
            } catch (e) {
                console.error(e);
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        }
        void load();

        const handleReload = () => void load();
        evoEvents.on('invoice:updated', handleReload);

        return () => {
            isMounted = false;
            evoEvents.off('invoice:updated', handleReload);
        };
    }, []);

    const stats = useMemo(() => {
        if (invoices.length === 0) return null;

        const now = new Date();
        const currentMonthIso = now.toISOString().slice(0, 7); // YYYY-MM
        const currentYearIso = now.getFullYear().toString();

        // 1. Filter by period
        let filtered = [];
        if (period === 'currentMonth') {
            filtered = invoices.filter(inv => (inv.fechaEmision || '').startsWith(currentMonthIso));
        } else if (period === 'currentYear') {
            filtered = invoices.filter(inv => (inv.fechaEmision || '').startsWith(currentYearIso));
        } else if (period === 'last3Months') {
            const months: string[] = [];
            for (let i = 0; i < 3; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push(d.toISOString().slice(0, 7));
            }
            filtered = invoices.filter(inv => {
                const dateStr = inv.fechaEmision || '';
                return months.some(m => dateStr.startsWith(m));
            });
        }

        // Metrics for selected period
        const facturasPeriodo = filtered.length;
        const montoPeriodo = filtered.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);

        const pendientes = filtered.filter(inv => !inv.pagada);
        const pendientesCount = pendientes.length;
        const pendientesTotal = pendientes.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);

        // Optional: Mini summary for current month (always)
        const currentMonthInvoices = invoices.filter(inv => (inv.fechaEmision || '').startsWith(currentMonthIso));
        const currentMonthCount = currentMonthInvoices.length;
        const currentMonthAmount = currentMonthInvoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);

        return {
            facturasPeriodo,
            montoPeriodo,
            pendientesCount,
            pendientesTotal,
            currentMonthCount,
            currentMonthAmount,
            hasData: invoices.length > 0
        };
    }, [invoices, period]);

    const formatCurrency = (val: number) => val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    if (loading) return <WidgetSkeleton />;
    if (error) return <WidgetError message="No fue posible cargar el resumen de facturación." />;

    if (!stats || !stats.hasData) {
        return (
            <WidgetCard>
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Facturación</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Resumen del periodo.</p>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sin facturas registradas.</p>
                </div>
            </WidgetCard>
        );
    }

    return (
        <WidgetCard>
            <div className="flex flex-col h-full bg-white dark:bg-transparent">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Facturación</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Global
                            </p>
                        </div>
                    </div>
                    <div className="relative">
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as Period)}
                            className="appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded-lg py-1 pl-2 pr-6 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="currentMonth">Este mes</option>
                            <option value="last3Months">Últimos 3 meses</option>
                            <option value="currentYear">Año actual</option>
                        </select>
                        <Calendar className="absolute right-2 top-1.5 h-3 w-3 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* Body Blocks */}
                <div className="grid grid-cols-2 gap-4 flex-1">
                    {/* Facturación del Periodo */}
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 flex flex-col justify-center">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            Facturas en el periodo
                        </p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                            {stats.facturasPeriodo}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            Total: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{formatCurrency(stats.montoPeriodo)}</span>
                        </p>
                    </div>

                    {/* Pendiente de Cobro */}
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 flex flex-col justify-center">
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                            Pendiente de cobro
                        </p>
                        <p className="text-3xl font-bold text-amber-700 dark:text-amber-500 mb-1">
                            {stats.pendientesCount}
                        </p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/80 truncate">
                            Total: <span className="font-mono font-medium">{formatCurrency(stats.pendientesTotal)}</span>
                        </p>
                    </div>
                </div>

                {/* Footer / Mini Summary */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-xs text-gray-400">
                        Este mes: {stats.currentMonthCount} facturas, {formatCurrency(stats.currentMonthAmount)} facturado.
                    </p>
                </div>
            </div>
        </WidgetCard>
    );
}

