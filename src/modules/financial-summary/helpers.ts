import type { Movement as IngresosMovement } from '../ingresos-manager/index';
import type { TaxPayment } from '../tax-tracker/types';

export type MovementKind = 'income' | 'expense' | 'tax';

export interface NormalizedMovement {
    id: string;
    date: string;       // ISO date YYYY-MM-DD
    concept: string;
    amount: number;     // positive value
    kind: MovementKind;
    sourceTool: string; // 'ingresos-manager' | 'tax-tracker' | 'bank-reconciler'
}

export interface MonthlyData {
    month: string; // YYYY-MM
    income: number;
    expenses: number;
    taxes: number;
}

export interface FinancialSummaryState {
    totalIncome: number;
    totalExpenses: number;
    totalTaxes: number;
    netProfit: number;
    monthlySeries: MonthlyData[];
    detailedMovements: NormalizedMovement[];
    // Averages for projection
    avgIncome: number;
    avgExpenses: number;
    avgProfit: number;
}

export const normalizeMovements = (
    ingresosMovements: IngresosMovement[],
    taxPayments: TaxPayment[]
): NormalizedMovement[] => {
    const normalized: NormalizedMovement[] = [];

    // 1. Ingresos Manager
    ingresosMovements.forEach(m => {
        normalized.push({
            id: m.id,
            date: m.date,
            concept: m.concept,
            amount: Math.abs(m.amount),
            kind: m.amount >= 0 ? 'income' : 'expense',
            sourceTool: 'ingresos-manager'
        });
    });

    // 2. Tax Tracker
    taxPayments.forEach(p => {
        normalized.push({
            id: p.id,
            date: p.date,
            concept: p.concept,
            amount: Math.abs(p.amount),
            kind: 'tax',
            sourceTool: 'tax-tracker'
        });
    });

    // Sort by date desc
    return normalized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const calculateFinancialSummary = (
    movements: NormalizedMovement[],
    startDate?: string,
    endDate?: string
): FinancialSummaryState => {
    // Filter by date range if provided
    const filtered = movements.filter(m => {
        if (startDate && m.date < startDate) return false;
        if (endDate && m.date > endDate) return false;
        return true;
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalTaxes = 0;
    const monthlyMap = new Map<string, MonthlyData>();

    filtered.forEach(m => {
        const month = m.date.substring(0, 7); // YYYY-MM
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { month, income: 0, expenses: 0, taxes: 0 });
        }
        const monthData = monthlyMap.get(month)!;

        if (m.kind === 'income') {
            totalIncome += m.amount;
            monthData.income += m.amount;
        } else if (m.kind === 'expense') {
            totalExpenses += m.amount;
            monthData.expenses += m.amount;
        } else if (m.kind === 'tax') {
            totalTaxes += m.amount;
            monthData.taxes += m.amount;
        }
    });

    const netProfit = totalIncome - totalExpenses - totalTaxes;

    const monthlySeries = Array.from(monthlyMap.values())
        .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate averages
    // If we have data, divide by number of unique months in the range, 
    // or just the months present in data? 
    // "Ingreso promedio mensual" usually implies over the selected period.
    // If selected period is "This Year" (e.g. 5 months passed), we should divide by 5?
    // Or divide by the number of months that actually have data?
    // Let's use the number of months in the series for simplicity, or 1 to avoid division by zero.
    const monthsCount = Math.max(monthlySeries.length, 1);

    return {
        totalIncome,
        totalExpenses,
        totalTaxes,
        netProfit,
        monthlySeries,
        detailedMovements: filtered,
        avgIncome: totalIncome / monthsCount,
        avgExpenses: totalExpenses / monthsCount,
        avgProfit: netProfit / monthsCount
    };
};

export const getPeriodDates = (preset: 'all' | 'month' | 'year' | 'custom', customStart?: string, customEnd?: string): { start: string | undefined, end: string | undefined } => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (preset) {
        case 'month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            return { start, end: today };
        }
        case 'year': {
            const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
            return { start, end: today };
        }
        case 'custom':
            return { start: customStart, end: customEnd };
        case 'all':
        default:
            return { start: undefined, end: undefined };
    }
};
