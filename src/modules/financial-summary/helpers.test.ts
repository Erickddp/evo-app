import { describe, it, expect } from 'vitest';
import { buildFinancialSummary, type NormalizedMovement } from './helpers';

describe('buildFinancialSummary', () => {
    const movements: NormalizedMovement[] = [
        { id: '1', amount: 1000, kind: 'income', date: '2023-10-15', concept: 'Salary', sourceTool: 'test' },
        { id: '2', amount: 500, kind: 'expense', date: '2023-10-20', concept: 'Groceries', sourceTool: 'test' },
        { id: '3', amount: 200, kind: 'tax', date: '2023-10-25', concept: 'VAT', sourceTool: 'test' },
        { id: '4', amount: 3000, kind: 'income', date: '2023-09-01', concept: 'Previous Salary', sourceTool: 'test' },
    ];

    it('should calculate totals correctly for all history', () => {
        const result = buildFinancialSummary(movements, { type: 'all' });

        expect(result.totalIncome).toBe(4000); // 1000 + 3000
        expect(result.totalExpenses).toBe(500);
        expect(result.totalTaxes).toBe(200);
        expect(result.netProfit).toBe(3300); // 4000 - 500 - 200
    });

    it('should filter by specific month (October 2023)', () => {
        const result = buildFinancialSummary(movements, { type: 'month', year: 2023, month: 10 });

        expect(result.totalIncome).toBe(1000);
        expect(result.totalExpenses).toBe(500);
        expect(result.totalTaxes).toBe(200);
        expect(result.netProfit).toBe(300); // 1000 - 500 - 200
        expect(result.detailedMovements).toHaveLength(3);
    });

    it('should filter by custom range', () => {
        const result = buildFinancialSummary(movements, {
            type: 'custom',
            start: '2023-09-01',
            end: '2023-09-30'
        });

        expect(result.totalIncome).toBe(3000);
        expect(result.detailedMovements).toHaveLength(1);
        expect(result.detailedMovements[0].concept).toBe('Previous Salary');
    });

    it('should handle empty movements', () => {
        const result = buildFinancialSummary([], { type: 'all' });

        expect(result.totalIncome).toBe(0);
        expect(result.totalExpenses).toBe(0);
        expect(result.netProfit).toBe(0);
    });
});
