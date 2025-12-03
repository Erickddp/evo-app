import { describe, it, expect } from 'vitest';
import { parseIngresosCsv } from './utils';
import { calculateTotals } from '../../core/domain/movement';

describe('Ingresos Manager Utils', () => {
    describe('parseIngresosCsv', () => {
        it('should parse new schema correctly', () => {
            const csv = `Fecha,Concepto,Ingreso,Gasto
2023-08-01,Salary,5000,0
2023-08-02,Rent,0,1500`;
            const result = parseIngresosCsv(csv);
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                date: '2023-08-01',
                concept: 'Salary',
                amount: 5000,
                type: 'ingreso'
            });
            expect(result[1]).toMatchObject({
                date: '2023-08-02',
                concept: 'Rent',
                amount: 1500,
                type: 'gasto'
            });
        });

        it('should parse old schema correctly', () => {
            const csv = `Fecha,Concepto,Monto,Tipo
2023-08-01,Salary,5000,Ingreso
2023-08-02,Rent,1500,Gasto`;
            const result = parseIngresosCsv(csv);
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                date: '2023-08-01',
                concept: 'Salary',
                amount: 5000,
                type: 'ingreso'
            });
            expect(result[1]).toMatchObject({
                date: '2023-08-02',
                concept: 'Rent',
                amount: 1500,
                type: 'gasto'
            });
        });

        it('should handle currency symbols and commas', () => {
            const csv = `Fecha,Concepto,Ingreso,Gasto
2023-08-01,"Big Payment","$1,200.50",0`;
            const result = parseIngresosCsv(csv);
            expect(result).toHaveLength(1);
            expect(result[0].amount).toBe(1200.50);
        });
    });

    describe('calculateTotals', () => {
        it('should calculate totals correctly matching Excel example', () => {
            // Example from user prompt:
            // Ingresos: 178,200.00
            // Egresos: 141,391.67
            // Saldo final (Neto): 36,808.33 (178200 - 141391.67)

            const movements = [
                { id: '1', date: '2023-08-01', concept: 'In', amount: 178200.00, type: 'ingreso' as const },
                { id: '2', date: '2023-08-02', concept: 'Out', amount: 141391.67, type: 'gasto' as const },
            ];

            const stats = calculateTotals(movements);

            expect(stats.totalIncome).toBe(178200.00);
            expect(stats.totalExpense).toBe(141391.67);
            expect(stats.netBalance).toBeCloseTo(36808.33, 2);
        });
    });
});
