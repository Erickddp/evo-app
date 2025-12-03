export interface BaseParams {
    income: number;
    expenses: number;
}

export interface BaseResult {
    taxableBase: number; // For ISR usually
    ivaBase?: number;    // For IVA (Income - Deductible Expenses)
}

export interface TaxParams {
    taxableBase: number;
    ivaBase?: number; // Optional, as some regimens might not use it or calculate differently
    income?: number;  // Raw income might be needed
    expenses?: number; // Raw expenses might be needed
}

export interface TaxResult {
    iva: number;
    isr: number;
    total: number;
}

export interface RegimenCalculator {
    calculateBase(params: BaseParams): BaseResult;
    calculateTaxes(params: TaxParams): TaxResult;
}
