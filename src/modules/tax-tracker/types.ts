export interface TaxPayment {
    id: string;
    date: string;
    concept: string;
    amount: number;
    type: 'IVA' | 'ISR' | 'Other';
    status: 'Paid' | 'Pending';
    metadata?: Record<string, any>;
}

export interface TaxProjection {
    period: string; // YYYY-MM
    estimatedIva: number;
    estimatedIsr: number;
    totalIncome: number;
    totalExpenses: number;
}

export interface MonthlyTaxSummary {
    month: number;          // 1-12
    total: number;          // suma de todos los impuestos
    iva: number;            // suma de IVA de ese mes
}
