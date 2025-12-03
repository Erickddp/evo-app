import type { RegimenCalculator, BaseParams, TaxParams, BaseResult, TaxResult } from './types';

export class PfResicoCalculator implements RegimenCalculator {
    calculateBase(params: BaseParams): BaseResult {
        // RESICO ISR Base = Gross Income
        // IVA Base = Income - Expenses (Cash flow)
        return {
            taxableBase: params.income,
            ivaBase: params.income - params.expenses
        };
    }

    calculateTaxes(params: TaxParams): TaxResult {
        const { taxableBase, ivaBase } = params;

        const isr = this.calculateIsr(taxableBase);

        // IVA is 16% of the "Value Added" (Income - Expenses)
        // Or strictly: (Income * 0.16) - (Expenses * 0.16)
        // Which is equivalent to (Income - Expenses) * 0.16
        // Assuming all income and expenses are subject to 16% IVA for simplicity.
        // If ivaBase is negative, you have a credit (Saldo a Favor), so tax is 0 (or negative representation?)
        // The UI expects "Total a Cargo", so if it's negative, it should probably be 0 here 
        // and handled as "Saldo a Favor" elsewhere, OR we return negative IVA.
        // Let's return the actual net IVA.

        const netIva = (ivaBase || 0) * 0.16;

        return {
            iva: netIva,
            isr: isr,
            total: isr + netIva
        };
    }

    private calculateIsr(income: number): number {
        if (income <= 25000.00) return income * 0.01;
        if (income <= 50000.00) return income * 0.011;
        if (income <= 83333.33) return income * 0.015;
        if (income <= 208333.33) return income * 0.02;
        return income * 0.025;
    }
}
