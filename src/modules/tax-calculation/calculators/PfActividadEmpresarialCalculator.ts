import type { RegimenCalculator, BaseParams, TaxParams, BaseResult, TaxResult } from './types';

export class PfActividadEmpresarialCalculator implements RegimenCalculator {
    calculateBase(params: BaseParams): BaseResult {
        // Actividad Empresarial: Taxable Base = Income - Deductible Expenses
        const base = Math.max(0, params.income - params.expenses);
        return {
            taxableBase: base,
            ivaBase: params.income - params.expenses // Can be negative for IVA credit
        };
    }

    calculateTaxes(params: TaxParams): TaxResult {
        const { taxableBase, ivaBase } = params;

        const isr = this.calculateIsr(taxableBase);

        // IVA is 16% of the "Value Added" (Income - Expenses)
        const netIva = (ivaBase || 0) * 0.16;

        return {
            iva: netIva,
            isr: isr,
            total: isr + netIva
        };
    }

    private calculateIsr(base: number): number {
        // 2024 Monthly ISR Table for Persona Física
        const table = [
            { limit: 0.01, fixed: 0.00, rate: 0.0192 },
            { limit: 746.05, fixed: 14.32, rate: 0.0640 },
            { limit: 6332.06, fixed: 371.83, rate: 0.1088 },
            { limit: 11128.02, fixed: 893.63, rate: 0.1600 },
            { limit: 12935.83, fixed: 1182.88, rate: 0.1792 },
            { limit: 15487.72, fixed: 1640.18, rate: 0.2136 },
            { limit: 31236.50, fixed: 5004.12, rate: 0.2352 },
            { limit: 49233.01, fixed: 9236.89, rate: 0.3000 },
            { limit: 93993.91, fixed: 22665.17, rate: 0.3200 },
            { limit: 125325.21, fixed: 32691.18, rate: 0.3400 },
            { limit: 375975.62, fixed: 117912.32, rate: 0.3500 },
        ];

        if (base <= 0) return 0;

        // Find the corresponding row
        // We iterate backwards to find the highest limit that is <= base? 
        // No, usually tables are "Lower Limit". So we find the row where base >= limit.
        // We want the highest row where base >= limit.

        let row = table[0];
        for (let i = 0; i < table.length; i++) {
            if (base >= table[i].limit) {
                row = table[i];
            } else {
                break;
            }
        }

        const excess = base - row.limit;
        const marginalTax = excess * row.rate;
        const totalIsr = marginalTax + row.fixed;

        return totalIsr;
    }
}
