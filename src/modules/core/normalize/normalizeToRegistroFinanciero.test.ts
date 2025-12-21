
import { normalizeToRegistroFinanciero } from './normalizeToRegistroFinanciero';
import type { FinancialRecordType } from '../financial/types';

describe('normalizeToRegistroFinanciero', () => {

    it('should normalize a Bank Movement (Credit) to Ingreso', () => {
        const bankInput = {
            date: '2023-10-01',
            description: 'Payment Received',
            amount: 5000,
            type: 'CREDIT'
        };

        const result = normalizeToRegistroFinanciero(bankInput);

        expect(result.source).toBe('bank');
        expect(result.type).toBe('ingreso');
        expect(result.amount).toBe(5000);
        expect(result.date).toBe('2023-10-01');
        expect(result.metadata?.description).toBe('Payment Received');
        expect(result.id).toBeDefined();
    });

    it('should normalize a Bank Movement (Debit) to Gasto', () => {
        const bankInput = {
            date: '2023-10-02',
            description: 'Service Fee',
            amount: 200,
            type: 'DEBIT'
        };

        const result = normalizeToRegistroFinanciero(bankInput);

        expect(result.source).toBe('bank');
        expect(result.type).toBe('gasto');
        expect(result.amount).toBe(200);
    });

    it('should normalize a CFDI/Invoice-like object', () => {
        const invoiceInput = {
            id: 'uuid-1234',
            invoiceDate: '2023-10-05',
            amount: 1160,
            rfc: 'XAXX010101000',
            concept: 'Product Sale',
            status: 'paid'
        };

        // Context can help define if it is income or expense
        const context = { defaultType: 'ingreso' as FinancialRecordType };
        const result = normalizeToRegistroFinanciero(invoiceInput, context);

        expect(result.source).toBe('cfdi');
        expect(result.type).toBe('ingreso');
        expect(result.amount).toBe(1160);
        expect(result.links?.facturaId).toBe('uuid-1234');
        expect(result.date).toBe('2023-10-05');
        expect(result.metadata?.rfc).toBe('XAXX010101000');
    });

    it('should normalize a generic manual input', () => {
        const manualInput = {
            id: 'manual-id-101',
            date: '2023-10-10',
            amount: 50,
            type: 'gasto',
            source: 'manual',
            taxability: 'no_deducible'
        };

        const result = normalizeToRegistroFinanciero(manualInput);

        expect(result.source).toBe('manual');
        expect(result.type).toBe('gasto');
        expect(result.amount).toBe(50);
        expect(result.id).toBe('manual-id-101');
        expect(result.taxability).toBe('no_deducible');
    });

    it('should provide robust defaults for empty input', () => {
        const result = normalizeToRegistroFinanciero(null);

        expect(result.id).toBeDefined();
        expect(result.source).toBe('manual'); // Default
        expect(result.type).toBe('gasto'); // Default
        expect(result.amount).toBe(0);
        expect(result.taxability).toBe('unknown');
    });
});
