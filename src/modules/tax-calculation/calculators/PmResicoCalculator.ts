import type { RegimenCalculator, BaseParams, TaxParams, BaseResult, TaxResult } from './types';

export class PmResicoCalculator implements RegimenCalculator {
    calculateBase(params: BaseParams): BaseResult {
        // PM RESICO: Taxable Base = Income - Deductible Expenses (Cash Flow)
        const base = Math.max(0, params.income - params.expenses);
        return {
            taxableBase: base,
            ivaBase: params.income - params.expenses
        };
    }

    calculateTaxes(params: TaxParams): TaxResult {
        const { taxableBase, ivaBase } = params;

        // PM RESICO ISR Rate: 30% on Profit
        const isr = taxableBase * 0.30;

        // IVA: 16% on Value Added
        const netIva = (ivaBase || 0) * 0.16;

        return {
            iva: netIva,
            isr: isr,
            total: isr + netIva
        };
    }
}
