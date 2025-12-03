export type EvoTransactionType = 'ingreso' | 'gasto' | 'pago' | 'impuesto';

export interface EvoTransaction {
    id: string;
    date: string;     // ISO 8601 YYYY-MM-DD
    concept: string;
    amount: number;   // Always positive
    type: EvoTransactionType;
    source?: string;  // e.g., 'cfdi', 'bank', 'manual'
    category?: string;
    tags?: string[];
    metadata?: Record<string, any>;
}

export interface TransactionTotals {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
}

/**
 * Creates a new EvoTransaction with a unique ID if not provided.
 */
export function createEvoTransaction(data: Omit<EvoTransaction, 'id'> & { id?: string }): EvoTransaction {
    return {
        id: data.id || crypto.randomUUID(),
        ...data,
        amount: Math.abs(data.amount) // Ensure amount is positive
    };
}

/**
 * Calculates total income, expense, and net balance from a list of transactions.
 */
export function calculateTotals(transactions: EvoTransaction[]): TransactionTotals {
    return transactions.reduce((acc, curr) => {
        if (curr.type === 'ingreso') {
            acc.totalIncome += curr.amount;
            acc.netBalance += curr.amount;
        } else if (curr.type === 'gasto' || curr.type === 'pago' || curr.type === 'impuesto') {
            // Treating 'pago' and 'impuesto' as outflows for general net balance
            acc.totalExpense += curr.amount;
            acc.netBalance -= curr.amount;
        }
        return acc;
    }, { totalIncome: 0, totalExpense: 0, netBalance: 0 });
}

/**
 * Filters transactions based on a search term (concept) and optional date range.
 */
export function filterTransactions(
    transactions: EvoTransaction[],
    searchTerm: string = '',
    startDate?: string,
    endDate?: string
): EvoTransaction[] {
    let filtered = transactions;

    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(t => t.concept.toLowerCase().includes(lowerTerm));
    }

    if (startDate) {
        filtered = filtered.filter(t => t.date >= startDate);
    }

    if (endDate) {
        filtered = filtered.filter(t => t.date <= endDate);
    }

    return filtered;
}

/**
 * Groups transactions by month (YYYY-MM).
 */
export function groupByMonth(transactions: EvoTransaction[]): Record<string, EvoTransaction[]> {
    return transactions.reduce((acc, curr) => {
        const month = curr.date.substring(0, 7); // YYYY-MM
        if (!acc[month]) {
            acc[month] = [];
        }
        acc[month].push(curr);
        return acc;
    }, {} as Record<string, EvoTransaction[]>);
}
