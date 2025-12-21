import { isTaxEngineEnabled } from '../../../config/flags';
import type { EvoProfile } from '../../core/profiles/profileTypes';
import type { RegistroFinanciero } from '../../core/financial/types';
import pfResicoTable from './tables/pf_resico.json'; // Verify tsconfig allows this or I define type
import pmGeneralTable from './tables/pm_general.json';

// --- Types ---

export interface TaxComputationParams {
    profile: EvoProfile;
    registros: RegistroFinanciero[];
    month: string; // YYYY-MM
}

export interface TaxResult {
    ingresos: number;
    gastosDeducibles: number;
    baseGravable: number;
    impuestoEstimado: number;
    tasaAplicada?: number;
    warnings: string[];
    confidence: number; // 0.0 - 1.0
    meta?: Record<string, any>;
}

// --- Engine ---

export const computeMonthly = (params: TaxComputationParams): TaxResult => {
    // 1. Feature Flag Guard
    if (!isTaxEngineEnabled()) {
        console.warn('[TaxEngine] Attempted to run calculation while ENABLE_TAX_ENGINE_V1 is false.');
        return {
            ingresos: 0,
            gastosDeducibles: 0,
            baseGravable: 0,
            impuestoEstimado: 0,
            warnings: ['El motor de impuestos V1 no está habilitado.'],
            confidence: 0
        };
    }

    const { profile, registros, month } = params;
    const warnings: string[] = [];

    // 2. Filter by Month
    // RegistroFinanciero.date is ISO YYYY-MM-DD
    const monthRecords = registros.filter(r => {
        if (!r.date || typeof r.date !== 'string') return false;
        return r.date.startsWith(month);
    });

    if (monthRecords.length === 0) {
        return {
            ingresos: 0,
            gastosDeducibles: 0,
            baseGravable: 0,
            impuestoEstimado: 0,
            warnings: ['No hay movimientos para el periodo seleccionado.'],
            confidence: 1.0
        };
    }

    // 3. Regime Routing
    const regime = profile.taxRegime;
    if (!regime) {
        return {
            ingresos: 0,
            gastosDeducibles: 0,
            baseGravable: 0,
            impuestoEstimado: 0,
            warnings: ['El perfil no tiene un régimen fiscal configurado.'],
            confidence: 0
        };
    }

    // 4. Calculate Confidence
    const confidence = calculateConfidence(monthRecords);
    if (confidence < 0.7) {
        warnings.push('La confianza del cálculo es baja. Revisa movimientos sin clasificar o manuales.');
    }

    // Check for 'unknown' taxability
    const hasUnknown = monthRecords.some(r => r.taxability === 'unknown');
    if (hasUnknown) {
        warnings.push('Existen movimientos con taxability="unknown". El cálculo puede ser impreciso.');
    }

    // 5. Calculation Logic
    let result: TaxResult = {
        ingresos: 0,
        gastosDeducibles: 0,
        baseGravable: 0,
        impuestoEstimado: 0,
        warnings,
        confidence
    };

    switch (regime) {
        case 'PF_RESICO':
            result = calculatePfResico(monthRecords, result);
            break;
        case 'PM':
            result = calculatePM(monthRecords, result);
            break;
        default:
            result.warnings.push(`Régimen no soportado: ${regime}`);
            break;
    }

    return result;
};

// --- Strategies ---

function calculatePfResico(records: RegistroFinanciero[], baseResult: TaxResult): TaxResult {
    // Ingresos: type='ingreso', source!='tax'
    // RESICO paga sobre ingresos cobrados
    const ingresos = records
        .filter(r => r.type === 'ingreso' && r.source !== 'tax')
        .reduce((sum, r) => sum + r.amount, 0);

    // Gastos: No deducibles para ISR en RESICO (pero sí para IVA, aunque V1 aqui calcula ISR estimado generalmente)
    // El prompt dice: "Base = suma de ingresos del mes."
    const gastos = 0; // Irrelevant for ISR base in RESICO

    const baseGravable = ingresos;

    // Find rate
    // Table is sorted ascending by limit
    const tableRow = pfResicoTable.find(row => baseGravable <= row.limit);
    // If exceeds all limits, use max (last one) or throw? Usually last one rate applies to excess?
    // Simplified: use the rate of the matching bracket. If none (income huge), use max rate.
    const effectiveRate = tableRow ? tableRow.rate : (pfResicoTable[pfResicoTable.length - 1].rate);

    const impuesto = baseGravable * effectiveRate;

    return {
        ...baseResult,
        ingresos,
        gastosDeducibles: gastos,
        baseGravable,
        impuestoEstimado: impuesto,
        tasaAplicada: effectiveRate,
        meta: {
            regime: 'PF_RESICO',
            baseAlgorithm: 'Ingresos Cobrados * Tasa Tabla'
        }
    };
}

function calculatePM(records: RegistroFinanciero[], baseResult: TaxResult): TaxResult {
    // Ingresos
    const ingresos = records
        .filter(r => r.type === 'ingreso' && r.source !== 'tax')
        .reduce((sum, r) => sum + r.amount, 0);

    // Deducibles: type='gasto', taxability='deducible'
    const deducibles = records
        .filter(r => r.type === 'gasto' && r.taxability === 'deducible')
        .reduce((sum, r) => sum + r.amount, 0);

    const baseGravable = Math.max(0, ingresos - deducibles);

    const rate = pmGeneralTable.estimatedRate;
    const impuesto = baseGravable * rate;

    baseResult.warnings.push('Estimación no oficial (PM).');
    baseResult.warnings.push('No considera coeficiente de utilidad, pérdidas anteriores, ni ajuste anual.');

    return {
        ...baseResult,
        ingresos,
        gastosDeducibles: deducibles,
        baseGravable,
        impuestoEstimado: impuesto,
        tasaAplicada: rate,
        meta: {
            regime: 'PM',
            baseAlgorithm: '(Ingresos - Deducciones) * Tasa Estimada'
        }
    };
}

// --- Helpers ---

function calculateConfidence(records: RegistroFinanciero[]): number {
    if (records.length === 0) return 1;

    const total = records.length;

    // KPI 1: Classification
    const classified = records.filter(r => r.taxability !== 'unknown').length;
    const classifiedScore = classified / total; // 0 to 1

    // KPI 2: Source Quality
    // CFDI/Bank/Tax are 'verified'. Manual is 'unverified'.
    const verified = records.filter(r => r.source === 'cfdi' || r.source === 'bank' || r.source === 'tax').length;
    const sourceScore = verified / total; // 0 to 1

    // Weighted Average
    // Classification is critical (0.6). Source is important (0.4).
    const score = (classifiedScore * 0.6) + (sourceScore * 0.4);

    // Round to 2 decimals
    return Math.round(score * 100) / 100;
}
