import type { TaxPayment, MonthlyTaxSummary } from './types';

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

export function getCurrentYear(): number {
    return new Date().getFullYear();
}

export function getPaymentsForYear(payments: TaxPayment[], year: number): TaxPayment[] {
    return payments.filter(p => {
        const pYear = new Date(p.date).getFullYear();
        return pYear === year;
    });
}

export function getYearTotals(payments: TaxPayment[]): { totalYear: number; totalIVA: number } {
    return payments.reduce(
        (acc, curr) => {
            acc.totalYear += curr.amount;
            if (curr.type === 'IVA') {
                acc.totalIVA += curr.amount;
            }
            return acc;
        },
        { totalYear: 0, totalIVA: 0 }
    );
}

export function getLastPayment(payments: TaxPayment[]): TaxPayment | null {
    if (payments.length === 0) return null;
    // Sort descending by date
    const sorted = [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0];
}

export function getMonthlyTaxSummary(payments: TaxPayment[]): MonthlyTaxSummary[] {
    const summary: MonthlyTaxSummary[] = [];

    // Initialize 12 months
    for (let i = 1; i <= 12; i++) {
        summary.push({ month: i, total: 0, iva: 0 });
    }

    for (const p of payments) {
        const date = new Date(p.date);
        // Ensure we are only processing valid dates. 
        // Note: The caller is responsible for filtering by year if needed.
        // This function aggregates WHATEVER payments are passed to it by month.
        // Usually, you'd pass getPaymentsForYear(payments, year) result here.

        const monthIndex = date.getMonth(); // 0-11
        if (monthIndex >= 0 && monthIndex < 12) {
            summary[monthIndex].total += p.amount;
            if (p.type === 'IVA') {
                summary[monthIndex].iva += p.amount;
            }
        }
    }

    return summary;
}
