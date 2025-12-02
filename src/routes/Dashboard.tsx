import { useState, useEffect } from 'react';
import { Zap, Activity, TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react';
import { dataStore } from '../core/data/dataStore';

interface IncomeDashboardStats {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    movementsCount: number;
    updatedAt?: string;
}

interface TaxPayment {
    id: string;
    date: string;
    amount: number;
    type: 'IVA' | 'ISR' | 'Other';
    // other fields omitted as not needed for dashboard
}

interface TaxDashboardStats {
    currentYearTotal: number;
    lastYearTotal: number;
    monthlySeries: { month: string; amount: number }[];
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
    ivaPaidYear: number;
    isrPaidYear: number;
}

export function Dashboard() {
    const [incomeStats, setIncomeStats] = useState<IncomeDashboardStats | null>(null);
    const [taxStats, setTaxStats] = useState<TaxDashboardStats | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function loadStats() {
            try {
                // Load Income Stats
                // Load Income Stats
                const incomeRecords = (await dataStore.listRecords('ingresos-manager')) || [];
                if (isMounted && Array.isArray(incomeRecords) && incomeRecords.length > 0) {
                    const last = incomeRecords[incomeRecords.length - 1];
                    // Safely cast and provide defaults
                    const payload = (last.payload || {}) as Partial<IncomeDashboardStats>;
                    setIncomeStats({
                        totalIncome: Number(payload.totalIncome) || 0,
                        totalExpense: Number(payload.totalExpense) || 0,
                        netBalance: Number(payload.netBalance) || 0,
                        movementsCount: Number(payload.movementsCount) || 0,
                        updatedAt: payload.updatedAt
                    });
                } else if (isMounted) {
                    setIncomeStats(null);
                }

                // Load Tax Stats
                const taxRecords = (await dataStore.listRecords<TaxPayment>('tax-tracker')) || [];
                if (!isMounted) return;

                if (Array.isArray(taxRecords) && taxRecords.length > 0) {
                    const payments = taxRecords.map(r => r.payload).sort((a, b) => a.date.localeCompare(b.date));

                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const lastYear = currentYear - 1;

                    let currentYearTotal = 0;
                    let lastYearTotal = 0;
                    let ivaPaidYear = 0;
                    let isrPaidYear = 0;
                    const monthlyMap = new Map<string, number>();

                    // Initialize last 6 months in map to ensure we have entries even if 0
                    for (let i = 5; i >= 0; i--) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const key = d.toISOString().slice(0, 7); // YYYY-MM
                        monthlyMap.set(key, 0);
                    }

                    for (const p of payments) {
                        if (!p) continue;
                        const amount = Number(p.amount) || 0;
                        const pDate = new Date(p.date);
                        const pYear = pDate.getFullYear();
                        const monthKey = p.date.slice(0, 7);

                        if (pYear === currentYear) {
                            currentYearTotal += amount;
                            if (p.type === 'IVA') ivaPaidYear += amount;
                            if (p.type === 'ISR') isrPaidYear += amount;
                        } else if (pYear === lastYear) {
                            lastYearTotal += amount;
                        }

                        if (monthlyMap.has(monthKey)) {
                            monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + amount);
                        }
                    }

                    const monthlySeries = Array.from(monthlyMap.entries())
                        .map(([month, amount]) => ({ month, amount }))
                        .sort((a, b) => a.month.localeCompare(b.month));

                    const lastPayment = payments[payments.length - 1];

                    setTaxStats({
                        currentYearTotal,
                        lastYearTotal,
                        monthlySeries,
                        lastPaymentDate: lastPayment?.date,
                        lastPaymentAmount: lastPayment ? Number(lastPayment.amount) : undefined,
                        ivaPaidYear,
                        isrPaidYear
                    });
                }

            } catch (err) {
                console.error('Failed to load dashboard stats', err);
            }
        }

        void loadStats();
        return () => {
            isMounted = false;
        };
    }, []);

    const formatCurrency = (val: number | undefined | null) => {
        if (val === undefined || val === null || !Number.isFinite(val)) {
            return "$0.00";
        }
        return val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    };

    const getMonthName = (dateStr: string) => {
        const [year, month] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleString('es-MX', { month: 'short' });
    };

    return (
        <div className="space-y-8">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700">
                <div className="relative z-10">
                    <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                        EVORIX Core
                    </h1>
                    <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                        Tu entorno de herramientas  fiscales y financieras.
                    </p>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Quick Start */}
                <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        <Zap className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Quick Start</h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                        Navigate to the Tools Hub to access your installed modules.
                    </p>
                </div>

                {/* System Status */}
                <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                        <Activity className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">System Status</h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                        All systems operational. Local storage is active.
                    </p>
                </div>

                {/* Financial Snapshot */}
                <div className="group md:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            Financial Snapshot
                        </h3>
                    </div>

                    {!incomeStats ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No hay datos financieros disponibles. Comienza agregando movimientos.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Saldo neto */}
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                    Saldo Neto
                                </p>
                                <p
                                    className={`text-2xl font-bold ${incomeStats.netBalance >= 0
                                        ? 'text-gray-900 dark:text-white'
                                        : 'text-red-600 dark:text-red-400'
                                        }`}
                                >
                                    {formatCurrency(incomeStats.netBalance)}
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                    {incomeStats.movementsCount} movimientos registrados
                                </p>
                            </div>

                            {/* Ingresos / Gastos */}
                            <div className="md:col-span-2 flex flex-col justify-center space-y-4">
                                {/* Ingresos */}
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                                            <TrendingUp size={14} /> Ingresos
                                        </span>
                                        <span className="font-mono text-gray-900 dark:text-white">
                                            {formatCurrency(incomeStats.totalIncome)}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{
                                                width: `${incomeStats.totalIncome + incomeStats.totalExpense > 0
                                                    ? (incomeStats.totalIncome /
                                                        (incomeStats.totalIncome + incomeStats.totalExpense)) *
                                                    100
                                                    : 0
                                                    }%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Gastos */}
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                                            <TrendingDown size={14} /> Gastos
                                        </span>
                                        <span className="font-mono text-gray-900 dark:text-white">
                                            {formatCurrency(incomeStats.totalExpense)}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500 rounded-full"
                                            style={{
                                                width: `${incomeStats.totalIncome + incomeStats.totalExpense > 0
                                                    ? (incomeStats.totalExpense /
                                                        (incomeStats.totalIncome + incomeStats.totalExpense)) *
                                                    100
                                                    : 0
                                                    }%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tax Overview */}
                <div className="group md:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                Resumen de impuestos
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Basado en pagos registrados en el módulo Tax Tracker.
                            </p>
                        </div>
                    </div>

                    {!taxStats ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No hay pagos de impuestos registrados aún.
                        </p>
                    ) : (
                        <div className="space-y-6">
                            {/* KPIs */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        Total año actual
                                    </p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(taxStats.currentYearTotal)}
                                    </p>
                                </div>
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        Total año anterior
                                    </p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(taxStats.lastYearTotal)}
                                    </p>
                                </div>
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        Último pago
                                    </p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                                        {taxStats.lastPaymentAmount ? formatCurrency(taxStats.lastPaymentAmount) : '-'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {taxStats.lastPaymentDate || '-'}
                                    </p>
                                </div>
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        IVA Pagado (Año)
                                    </p>
                                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                        {formatCurrency(taxStats.ivaPaidYear)}
                                    </p>
                                </div>
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        ISR Pagado (Año)
                                    </p>
                                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                        {formatCurrency(taxStats.isrPaidYear)}
                                    </p>
                                </div>
                            </div>

                            {/* Bar Chart */}
                            <div className="mt-6">
                                <div className="flex items-end gap-2 h-32 border-b border-gray-200 dark:border-gray-700 pb-2">
                                    {taxStats.monthlySeries.map((item) => {
                                        const maxAmount = Math.max(...taxStats.monthlySeries.map(s => s.amount), 1);
                                        const heightPercent = Math.max((item.amount / maxAmount) * 100, 4); // Min 4% height for visibility

                                        return (
                                            <div key={item.month} className="flex-1 flex flex-col justify-end group/bar relative">
                                                <div
                                                    className="w-full rounded-t bg-indigo-500 dark:bg-indigo-400 transition-all hover:bg-indigo-600 dark:hover:bg-indigo-300"
                                                    style={{ height: `${heightPercent}%` }}
                                                    title={`${item.month}: ${formatCurrency(item.amount)}`}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2 pt-2">
                                    {taxStats.monthlySeries.map((item) => (
                                        <div key={item.month} className="flex-1 text-center">
                                            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                                                {getMonthName(item.month)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
