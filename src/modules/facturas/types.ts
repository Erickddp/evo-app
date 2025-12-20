// TODO: Refactor to use 'Cliente' from src/core/evoappDataModel.ts in Phase 2
export interface Client {
    id: string;
    rfc: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    postalCode?: string;
    taxRegime?: string;
    createdAt: string;
    updatedAt: string;
}

// TODO: Refactor to use 'Factura' from src/core/evoappDataModel.ts in Phase 2
export interface Invoice {
    id: string;
    folio: string;
    // Standardized fields
    invoiceDate: string; // FECHA (YYYY-MM-DD)
    clientName: string; // CLIENTE
    rfc: string; // RFC
    email?: string; // CORREO
    concept: string; // CONCEPTO
    conceptoGeneral?: string; // Fallback alias
    descripcion?: string; // Fallback alias
    amount: number; // MONTO
    status: string; // ESTADO
    paymentForm: string; // FORMA_PAGO
    paymentMethod: string; // METODO_PAGO
    cfdiUse: string; // USO_CFDI
    notes?: string; // NOTAS

    // Legacy/Internal fields (kept for compatibility or derived)
    serviceDate?: string;
    month: string;
    address?: string;
    postalCode?: string;
    productKey?: string;
    taxRegime?: string;

    // Status booleans (can be derived from status string if needed, or kept in sync)
    paid: boolean;
    realized: boolean;
    paymentDate?: string;

    createdAt: string;
    updatedAt: string;
}

export type FacturaRecordType = 'client' | 'invoice';

export interface FacturaPayload {
    type: FacturaRecordType;
    data: Client | Invoice;
}
