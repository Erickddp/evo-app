import type { TaxPayment } from './types';

export function sanitizeTaxPayment(raw: any): TaxPayment {
    return {
        id: raw.id || crypto.randomUUID(),
        date: raw.date || new Date().toISOString().split('T')[0],
        concept: raw.concept || 'Unknown',
        amount: Number(raw.amount) || 0,
        type: raw.type || 'Other',
        status: raw.status || 'Paid',
        metadata: raw.metadata || {}
    };
}

export interface TaxDashboardStats {
    currentYearTotal: number;
    lastYearTotal: number;
    monthlySeries: { month: string; amount: number }[];
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
    ivaPaidYear: number;
    isrPaidYear: number;
}

export function calculateTaxStats(payments: TaxPayment[]): TaxDashboardStats {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    let currentYearTotal = 0;
    let lastYearTotal = 0;
    let ivaPaidYear = 0;
    let isrPaidYear = 0;
    const monthlyMap = new Map<string, number>();

    // Initialize last 12 months in map
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7); // YYYY-MM
        monthlyMap.set(key, 0);
    }

    // Sort payments by date ascending for processing
    const sortedPayments = [...payments].sort((a, b) => a.date.localeCompare(b.date));

    for (const p of sortedPayments) {
        const amount = p.amount;
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

        // We only care about the months we initialized in the map for the chart/series
        // But if we want all history, we might need to handle it differently.
        // For the dashboard sparkline/bar chart, usually last 6-12 months is good.
        // The existing dashboard code initialized last 6 months.
        // Let's stick to the map we created (last 12 months) or update it if the key exists.
        if (monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + amount);
        }
    }

    const monthlySeries = Array.from(monthlyMap.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month));

    const lastPayment = sortedPayments.length > 0 ? sortedPayments[sortedPayments.length - 1] : undefined;

    return {
        currentYearTotal,
        lastYearTotal,
        monthlySeries,
        lastPaymentDate: lastPayment?.date,
        lastPaymentAmount: lastPayment?.amount,
        ivaPaidYear,
        isrPaidYear
    };
}
