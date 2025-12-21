export type FinancialRecordType = 'ingreso' | 'gasto' | 'impuesto';
export type FinancialRecordSource = 'bank' | 'cfdi' | 'manual' | 'tax';
export type TaxabilityStatus = 'deducible' | 'no_deducible' | 'unknown';
export type RegimenTarget = 'PM' | 'PF_RESICO';

export interface FinancialRecordLinks {
    facturaId?: string;
    xmlUuid?: string;
    bankMovementId?: string;
}

/**
 * RegistroFinanciero (Canonical Financial Record - CFR)
 * 
 * The single source of truth for all financial transactions in the system.
 * This entity is the destination for CFDI, Bank Movements, Manual Entries, and Tax Payments.
 * 
 * RULES:
 * - Single persisted entity.
 * - No tax logic here.
 * - No dependencies on other modules.
 */
export interface RegistroFinanciero {
    /** Unique UUID */
    id: string;

    /** ISO 8601 Date String */
    date: string;

    /** Description or Concept of the movement */
    concept: string;

    /** Monetary amount (always positive, type determines flow) */
    amount: number;

    /** Direction of the money */
    type: FinancialRecordType;

    /** Origin of the data */
    source: FinancialRecordSource;

    /** Tax classification */
    taxability: TaxabilityStatus;

    /** Optional target regimen for specific tax logic */
    regimenTarget?: RegimenTarget;

    /** Links to original source documents */
    links?: FinancialRecordLinks;

    /** Arbitrary metadata */
    metadata?: Record<string, any>;

    /** ISO 8601 Timestamp */
    createdAt: string;

    /** ISO 8601 Timestamp */
    updatedAt: string;
}
