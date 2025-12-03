import type { RegimenCalculator, BaseParams, TaxParams, BaseResult, TaxResult } from './types';

export class PmGeneralCalculator implements RegimenCalculator {
    calculateBase(params: BaseParams): BaseResult {
        // PM General: Usually based on "Coeficiente de Utilidad" applied to Income.
        // Since we don't have the coefficient stored, we'll estimate using actual profit.
        // Estimation: Taxable Base = Income - Expenses
        const base = Math.max(0, params.income - params.expenses);
        return {
            taxableBase: base,
            ivaBase: params.income - params.expenses
        };
    }

    calculateTaxes(params: TaxParams): TaxResult {
        const { taxableBase, ivaBase } = params;

        // PM General ISR Rate: 30%
        // Note: This is an estimation. Real calculation uses provisional payments based on coefficient.
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
