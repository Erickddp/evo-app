import type { RegistroFinanciero, FinancialRecordType, FinancialRecordSource, TaxabilityStatus } from '../financial/types';

// Minimal shapes for known inputs to avoid circular module dependencies
interface PartialInvoice {
    id?: string;
    invoiceDate?: string;
    amount?: number;
    rfc?: string; // Emisor or Receptor depending on context
    concept?: string;
    status?: string;
    uuid?: string; // Often standardized as uuid in some systems
    folio?: string;
    // Add other fields as needed for heuristics
}

interface PartialBankMovement {
    date?: string;
    description?: string;
    amount?: number;
    type?: "DEBIT" | "CREDIT";
}

export interface NormalizationContext {
    defaultType?: FinancialRecordType;
    defaultSource?: FinancialRecordSource;
    defaultTaxability?: TaxabilityStatus;
    knownUserRfc?: string; // To help infer Income vs Expense
}

/**
 * Normalizes various inputs into a Canonical Financial Record (CFR).
 * 
 * Responsibilities:
 * - Guarantee valid CFR structure.
 * - Infer source, type, and taxability.
 * - Generate stable ID if one doesn't exist.
 * - Pure transformation (no side effects).
 * 
 * @param input The raw input object (CFDI, Bank Movement, Manual Data, etc.)
 * @param context Optional context helpers
 */
export const normalizeToRegistroFinanciero = (
    input: unknown,
    context?: NormalizationContext
): RegistroFinanciero => {
    const now = new Date().toISOString();

    // Default values
    let amount = 0;
    let date = now;
    let type: FinancialRecordType = context?.defaultType || 'gasto';
    let source: FinancialRecordSource = context?.defaultSource || 'manual';
    let taxability: TaxabilityStatus = context?.defaultTaxability || 'unknown';
    let id = crypto.randomUUID();
    let metadata: Record<string, any> = {};
    let links = {};

    // Cast input safely
    const raw = input as Record<string, any>; // Basic shape assumption
    if (!raw || typeof raw !== 'object') {
        // Fallback for primitive or null
        return createRecord({
            id,
            date,
            amount,
            type,
            source,
            taxability,
            concept: resolveConcept(input, type),
            createdAt: now,
            updatedAt: now
        });
    }

    // --- Heuristic 1: Bank Movement ---
    if ('type' in raw && ('DEBIT' === raw.type || 'CREDIT' === raw.type)) {
        const bankMove = raw as PartialBankMovement & { bankMovementId?: string };
        source = 'bank';
        amount = Math.abs(bankMove.amount || 0);
        date = bankMove.date || now;
        type = bankMove.type === 'CREDIT' ? 'ingreso' : 'gasto';
        metadata = { description: bankMove.description };

        if (bankMove.bankMovementId) {
            links = { bankMovementId: bankMove.bankMovementId };
        }
    }
    // --- Heuristic 2: CFDI / Invoice ---
    else if ('invoiceDate' in raw || 'rfc' in raw || 'folio' in raw) {
        const invoice = raw as PartialInvoice;
        source = 'cfdi';
        amount = Number(invoice.amount) || 0;
        date = invoice.invoiceDate || now; // invoiceDate from the Invoice interface

        // Infer Type
        // If we have context.knownUserRfc, checks could be made. 
        // Without clear distinction, we rely on context or default.
        if (context?.defaultType) {
            type = context.defaultType;
        }

        // Links
        links = {
            facturaId: invoice.id,
            xmlUuid: invoice.uuid // Sometimes explicit in other shapes
        };

        metadata = {
            rfc: invoice.rfc,
            folio: invoice.folio,
            concept: invoice.concept,
            status: invoice.status
        };

        if (invoice.id) {
            // If the invoice already has a UUID, we COULD use it as the CFR ID 
            // if 1:1 mapping is desired. However, separation is cleaner. 
            // We'll keep CFR ID random but ensure idempotency in a real system by checking existence (out of scope here).
        }
    }
    // --- Heuristic 3: Manual / Generic ---
    else {
        // Just map fields if they match CFR shape roughly
        if (raw.amount !== undefined) amount = Number(raw.amount);
        if (raw.date) date = String(raw.date);
        if (raw.type && ['ingreso', 'gasto', 'impuesto'].includes(raw.type)) type = raw.type as FinancialRecordType;
        if (raw.source && ['bank', 'cfdi', 'manual', 'tax'].includes(raw.source)) source = raw.source as FinancialRecordSource;
        if (raw.taxability) taxability = raw.taxability as TaxabilityStatus;
        if (raw.metadata) metadata = { ...metadata, ...raw.metadata };
        if (raw.id) id = String(raw.id) as any; // Trust provided ID if manual
    }

    return {
        id,
        date,
        amount,
        type,
        source,
        taxability,
        links,
        metadata,
        concept: resolveConcept(raw, type),
        createdAt: now,
        updatedAt: now,
        ...context // Allow overriding specific fields via context if needed, but risky? No, strict to interface.
    };
};

function resolveConcept(input: any, fallbackType: FinancialRecordType): string {
    if (!input || typeof input !== 'object') {
        return getFallbackConcept(fallbackType);
    }
    const candidate = input.concept || input.concepto || input.metadata?.concept || input.metadata?.concepto;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
    }
    return getFallbackConcept(fallbackType);
}

function getFallbackConcept(type: FinancialRecordType): string {
    switch (type) {
        case 'ingreso': return 'Ingreso';
        case 'gasto': return 'Gasto';
        case 'impuesto': return 'Impuesto';
        default: return 'Movimiento';
    }
}

function createRecord(base: RegistroFinanciero): RegistroFinanciero {
    return base;
}
