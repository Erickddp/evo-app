import { useState, useEffect } from 'react';
import { Zap, Activity, TrendingUp, TrendingDown, DollarSign, FileText, FileCheck, AlertCircle } from 'lucide-react';
import { dataStore } from '../core/data/dataStore';
import type { CfdiSummary } from '../modules/cfdi-validator/parser';
import type { Movement as IngresosMovement } from '../modules/ingresos-manager/index';
import { normalizeMovements, calculateFinancialSummary, getPeriodDates } from '../modules/financial-summary/helpers';
import { sanitizeTaxPayment, calculateTaxStats } from '../modules/tax-tracker/helpers';

interface IncomeDashboardStats {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    movementsCount: number;
    updatedAt?: string;
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

interface CfdiDashboardStats {
    totalProcessed: number;
    emittedCount: number;
    receivedCount: number;
    invalidCount: number;
    lastRunDate?: string;
}

interface FinancialSummaryDashboardStats {
    netProfit: number;
    income: number;
    expenses: number;
    hasData: boolean;
}

export function Dashboard() {
    const [incomeStats, setIncomeStats] = useState<IncomeDashboardStats | null>(null);
    const [taxStats, setTaxStats] = useState<TaxDashboardStats | null>(null);
    const [cfdiStats, setCfdiStats] = useState<CfdiDashboardStats | null>(null);
    const [finSummaryStats, setFinSummaryStats] = useState<FinancialSummaryDashboardStats | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function loadStats() {
            try {
                // Load Income Stats
                const incomeRecords = (await dataStore.listRecords<{ movements: IngresosMovement[] }>('ingresos-manager')) || [];
                let ingresosMovements: IngresosMovement[] = [];

                if (isMounted && Array.isArray(incomeRecords) && incomeRecords.length > 0) {
                    const last = incomeRecords[incomeRecords.length - 1];
                    // Safely cast and provide defaults
                    const payload = (last.payload || {}) as any;
                    setIncomeStats({
                        totalIncome: Number(payload.stats?.totalIncome) || 0,
                        totalExpense: Number(payload.stats?.totalExpense) || 0,
                        netBalance: Number(payload.stats?.netBalance) || 0,
                        movementsCount: Number(payload.movementsCount) || 0,
                        updatedAt: payload.updatedAt
                    });
                    ingresosMovements = payload.movements || [];
                } else if (isMounted) {
                    setIncomeStats(null);
                }

                // Load Tax Stats
                const taxRecords = (await dataStore.listRecords<any>('tax-tracker')) || [];
                const taxPayments = taxRecords.map(r => sanitizeTaxPayment(r.payload));

                if (isMounted) {
                    const stats = calculateTaxStats(taxPayments);
                    // Filter monthlySeries to last 6 months for dashboard view if needed, 
                    // or just use what comes back. The helper returns last 12 months.
                    // Let's slice it to last 6 to match previous behavior if space is tight, 
                    // or keep 12. The user didn't specify, but "Sync with Dashboard" implies keeping it working.
                    // I'll keep all 12, it gives more info.

                    setTaxStats(stats);
                }

                // Calculate Financial Summary (Current Month)
                if (isMounted) {
                    const normalized = normalizeMovements(ingresosMovements, taxPayments);
                    const { start, end } = getPeriodDates('month');
                    const summary = calculateFinancialSummary(normalized, start, end);

                    setFinSummaryStats({
                        netProfit: summary.netProfit,
                        income: summary.totalIncome,
                        expenses: summary.totalExpenses,
                        hasData: normalized.length > 0
                    });
                }

                // Load CFDI Stats
                const cfdiRecords = await dataStore.listRecords<{ rows: CfdiSummary[], errors: any[], timestamp: string }>('cfdi-validator');
                if (isMounted && cfdiRecords.length > 0) {
                    const latest = cfdiRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    const rows = latest.payload.rows || [];

                    const emitted = rows.filter(r => r.type === 'Emitted').length;
                    const received = rows.filter(r => r.type === 'Received').length;
                    const invalid = (latest.payload.errors || []).length;

                    setCfdiStats({
                        totalProcessed: rows.length + invalid,
                        emittedCount: emitted,
                        receivedCount: received,
                        invalidCount: invalid,
                        lastRunDate: latest.payload.timestamp
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
        <div className="space-y-6">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700">
                <div className="relative z-10">
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                        EVORIX Core
                    </h1>
                    <p className="mt-1 text-base text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                        Entorno de herramientas fiscales y financieras.
                    </p>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Quick Start */}
                <div className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        <Zap className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">Inicio rápido</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Ve a Tools Hub para abrir tus módulos.
                    </p>
                </div>

                {/* System Status */}
                <div className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                        <Activity className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">Estado del sistema</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Almacenamiento local activo y funcionando.
                    </p>
                </div>

                {/* CFDI Validator Summary */}
                <div className="group md:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                            <FileCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                Validación de CFDI
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Resumen de la última sesión de validación.
                            </p>
                        </div>
                    </div>

                    {!cfdiStats ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No hay validaciones recientes.
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                    Total Procesados
                                </p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {cfdiStats.totalProcessed}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800">
                                <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                                    Emitidos
                                </p>
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                    {cfdiStats.emittedCount}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800">
                                <p className="text-[10px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                                    Recibidos
                                </p>
                                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                                    {cfdiStats.receivedCount}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800">
                                <div className="flex items-center gap-1 mb-1">
                                    <AlertCircle className="w-3 h-3 text-red-500" />
                                    <p className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">
                                        Errores
                                    </p>
                                </div>
                                <p className="text-xl font-bold text-red-700 dark:text-red-300">
                                    {cfdiStats.invalidCount}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Financial Snapshot */}
                <div className="group md:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800 min-h-[200px]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            Resumen financiero
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
                                Basado en los pagos del módulo Tax Tracker.
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

                {/* Financial Summary Card */}
                <div className="group md:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                Estado de resultados (Mes Actual)
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Resumen rápido de utilidad, ingresos y gastos de este mes.
                            </p>
                        </div>
                    </div>

                    {!finSummaryStats || !finSummaryStats.hasData ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Empieza a registrar movimientos para ver tu estado de resultados aquí.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                    Utilidad Neta
                                </p>
                                <p className={`text-xl font-bold ${finSummaryStats.netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(finSummaryStats.netProfit)}
                                </p>
                            </div>
                            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800">
                                <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">
                                    Ingresos
                                </p>
                                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                                    {formatCurrency(finSummaryStats.income)}
                                </p>
                            </div>
                            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800">
                                <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
                                    Gastos
                                </p>
                                <p className="text-xl font-bold text-red-700 dark:text-red-300">
                                    {formatCurrency(finSummaryStats.expenses)}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
