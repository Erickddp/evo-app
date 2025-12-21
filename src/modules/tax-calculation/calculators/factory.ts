import type { TaxProfile } from '../../shared/taxProfile';
import { isTaxEngineEnabled } from '../../../config/flags';
import type { RegimenCalculator, BaseParams, TaxParams, BaseResult, TaxResult } from './types';
import { PfResicoCalculator } from './PfResicoCalculator';
import { PfActividadEmpresarialCalculator } from './PfActividadEmpresarialCalculator';
import { PmResicoCalculator } from './PmResicoCalculator';
import { PmGeneralCalculator } from './PmGeneralCalculator';

class StubCalculator implements RegimenCalculator {
    calculateBase(params: BaseParams): BaseResult {
        return { taxableBase: params.income - params.expenses, ivaBase: params.income - params.expenses };
    }
    calculateTaxes(params: TaxParams): TaxResult {
        // Default generic estimation (30% ISR, 16% IVA)
        const base = params.taxableBase;
        const isr = base > 0 ? base * 0.30 : 0;
        const iva = (params.ivaBase || 0) * 0.16;
        return { iva, isr, total: isr + iva };
    }
}

export const getCalculatorForRegimen = (regimen?: TaxProfile['regimenFiscal']): RegimenCalculator => {
    if (!isTaxEngineEnabled()) {
        return new StubCalculator();
    }
    switch (regimen) {
        case 'PF_RESICO':
            return new PfResicoCalculator();
        case 'PF_ACT_EMPRESARIAL':
            return new PfActividadEmpresarialCalculator();
        case 'PM_RESICO':
            return new PmResicoCalculator();
        case 'PM_GENERAL':
            return new PmGeneralCalculator();
        default:
            return new StubCalculator();
    }
};
