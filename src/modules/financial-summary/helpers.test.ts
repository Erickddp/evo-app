import { describe, it, expect } from 'vitest';
import { calculateFinancialSummary } from './helpers';

describe('calculateFinancialSummary', () => {
    it('should calculate totals correctly', () => {
        const movements = [
            { amount: 1000, kind: 'income', date: '2023-01-01' },
            { amount: 500, kind: 'expense', date: '2023-01-02' }
        ] as any[];

        const start = '2023-01-01';
        const end = '2023-01-31';

        const result = calculateFinancialSummary(movements, start, end);

        expect(result.totalIncome).toBe(1000);
        expect(result.totalExpenses).toBe(500);
        expect(result.netProfit).toBe(500);
    });

    it('should handle empty movements', () => {
        const start = '2023-01-01';
        const end = '2023-01-31';
        const result = calculateFinancialSummary([], start, end);

        expect(result.totalIncome).toBe(0);
        expect(result.totalExpenses).toBe(0);
        expect(result.netProfit).toBe(0);
    });
});
