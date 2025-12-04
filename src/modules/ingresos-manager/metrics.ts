import { type EvoTransaction, calculateTotals } from '../../core/domain/evo-transaction';
import { getYearMonth, getYear } from './utils';

export interface IncomeDashboardMetrics {
    currentMonth: { income: number; expense: number; net: number };
    previousMonth: { income: number; expense: number; net: number };
    yearToDate: { income: number; expense: number; net: number };
    monthlySeries: Array<{ month: string; income: number; expense: number; net: number }>;
}

export function buildIncomeDashboardMetrics(movements: EvoTransaction[]): IncomeDashboardMetrics {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12

    // Helper to format YYYY-MM
    const formatYM = (y: number, m: number) => `${y}-${m.toString().padStart(2, '0')}`;

    const currentYM = formatYM(currentYear, currentMonth);

    // Previous Month Logic
    let prevMonthYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevMonthYear -= 1;
    }
    const prevYM = formatYM(prevMonthYear, prevMonth);

    const currentMonthTxs = movements.filter(m => getYearMonth(m.date) === currentYM);
    const prevMonthTxs = movements.filter(m => getYearMonth(m.date) === prevYM);
    const yearTxs = movements.filter(m => getYear(m.date) === currentYear);

    const calc = (txs: EvoTransaction[]) => {
        const t = calculateTotals(txs);
        return { income: t.totalIncome, expense: t.totalExpense, net: t.netBalance };
    };

    // Monthly Series (Last 6 months for dashboard mini-chart)
    // We can generate the last 6 months keys and fill data
    const monthlySeries = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const ym = formatYM(d.getFullYear(), d.getMonth() + 1);
        const txs = movements.filter(m => getYearMonth(m.date) === ym);
        const c = calc(txs);
        monthlySeries.push({ month: ym, ...c });
    }

    return {
        currentMonth: calc(currentMonthTxs),
        previousMonth: calc(prevMonthTxs),
        yearToDate: calc(yearTxs),
        monthlySeries
    };
}
