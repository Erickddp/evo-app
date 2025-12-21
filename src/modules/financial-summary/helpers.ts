import { type EvoTransaction } from '../../core/domain/evo-transaction';

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

export type PeriodFilter =
    | { type: 'all' }
    | { type: 'currentMonth' }
    | { type: 'month'; year: number; month: number } // 1–12
    | { type: 'custom'; start: string; end: string };

export const normalizeMovements = (
    transactions: EvoTransaction[]
): NormalizedMovement[] => {
    const normalized: NormalizedMovement[] = [];

    transactions.forEach(t => {
        let kind: MovementKind | undefined;
        if (t.type === 'ingreso') kind = 'income';
        else if (t.type === 'gasto' || t.type === 'pago') kind = 'expense';
        else if (t.type === 'impuesto') kind = 'tax';

        if (kind && t.date && typeof t.date === 'string') {
            normalized.push({
                id: t.id,
                date: t.date,
                concept: t.concept,
                amount: t.amount,
                kind,
                sourceTool: t.source || 'unknown'
            });
        }
    });

    // Sort by date desc
    return normalized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const filterMovementsByPeriod = (movements: NormalizedMovement[], filter: PeriodFilter): NormalizedMovement[] => {
    const now = new Date();

    switch (filter.type) {
        case 'currentMonth': {
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            const prefix = `${y}-${m.toString().padStart(2, '0')}`;
            return movements.filter(mv => mv.date.startsWith(prefix));
        }
        case 'month': {
            const prefix = `${filter.year}-${filter.month.toString().padStart(2, '0')}`;
            return movements.filter(mv => mv.date.startsWith(prefix));
        }
        case 'custom': {
            return movements.filter(mv => mv.date >= filter.start && mv.date <= filter.end);
        }
        case 'all':
        default:
            return movements;
    }
};

export const calculateFinancialSummary = (
    movements: NormalizedMovement[]
): FinancialSummaryState => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalTaxes = 0;
    const monthlyMap = new Map<string, MonthlyData>();

    // When plotting trends, we typically want ascending order for the chart, 
    // even if movements are stored desc. We'll handle sorting of series at the end.

    // Iterate movements to build totals and grouping
    movements.forEach(m => {
        const month = m.date.substring(0, 7); // YYYY-MM
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { month, income: 0, expenses: 0, taxes: 0 });
        }
        const monthData = monthlyMap.get(month)!;

        // Ensure amount is treated as number just in case
        const amt = Number(m.amount) || 0;

        if (m.kind === 'income') {
            totalIncome += amt;
            monthData.income += amt;
        } else if (m.kind === 'expense') {
            totalExpenses += amt;
            monthData.expenses += amt;
        } else if (m.kind === 'tax') {
            totalTaxes += amt;
            monthData.taxes += amt;
        }
    });

    const netProfit = totalIncome - totalExpenses - totalTaxes;

    // Monthly series sorted by month ASC for the chart
    const monthlySeries = Array.from(monthlyMap.values())
        .sort((a, b) => a.month.localeCompare(b.month));

    const monthsCount = Math.max(monthlySeries.length, 1);

    return {
        totalIncome,
        totalExpenses,
        totalTaxes,
        netProfit,
        monthlySeries,
        detailedMovements: movements, // These are already filtered
        avgIncome: totalIncome / monthsCount,
        avgExpenses: totalExpenses / monthsCount,
        avgProfit: netProfit / monthsCount
    };
};

export function buildFinancialSummary(
    movements: NormalizedMovement[],
    filter: PeriodFilter
): FinancialSummaryState {
    const filtered = filterMovementsByPeriod(movements, filter);
    return calculateFinancialSummary(filtered);
}
