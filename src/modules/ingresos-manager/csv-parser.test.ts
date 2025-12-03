import { parseIngresosCsv } from './utils';

describe('parseIngresosCsv', () => {
    it('should parse a simple CSV correctly', () => {
        const csv = `Fecha,Concepto,Ingreso,Gasto
2023-01-01,Salary,5000,0
2023-01-02,Rent,0,1000`;
        const result = parseIngresosCsv(csv);
        expect(result.stats.totalRows).toBe(2);
        expect(result.stats.imported).toBe(2);
        expect(result.movements[0].amount).toBe(5000);
        expect(result.movements[0].type).toBe('ingreso');
        expect(result.movements[1].amount).toBe(1000);
        expect(result.movements[1].type).toBe('gasto');
    });

    it('should handle quoted fields with commas', () => {
        const csv = `Fecha,Concepto,Ingreso,Gasto
2023-01-01,"Salary, Bonus",6000,0`;
        const result = parseIngresosCsv(csv);
        expect(result.stats.imported).toBe(1);
        expect(result.movements[0].concept).toBe('Salary, Bonus');
        expect(result.movements[0].amount).toBe(6000);
    });

    it('should ignore rows with no amount', () => {
        const csv = `Fecha,Concepto,Ingreso,Gasto
2023-01-01,Note,0,0`;
        const result = parseIngresosCsv(csv);
        expect(result.stats.totalRows).toBe(1);
        expect(result.stats.imported).toBe(0);
        expect(result.stats.ignored).toBe(1);
    });

    it('should handle different date formats', () => {
        const csv = `Fecha,Concepto,Ingreso,Gasto
01-02-2023,Format1,100,0
2023/02/01,Format2,100,0`;
        const result = parseIngresosCsv(csv);
        expect(result.stats.imported).toBe(2);
        expect(result.movements[0].date).toBe('2023-02-01');
        expect(result.movements[1].date).toBe('2023-02-01');
    });

    it('should handle large files', () => {
        let csv = 'Fecha,Concepto,Ingreso,Gasto\n';
        for (let i = 0; i < 150; i++) {
            csv += `2023-01-01,Item ${i},100,0\n`;
        }
        const result = parseIngresosCsv(csv);
        expect(result.stats.totalRows).toBe(150);
        expect(result.stats.imported).toBe(150);
    });
});
