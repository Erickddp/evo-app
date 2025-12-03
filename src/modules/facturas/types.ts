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

export interface Invoice {
    id: string;
    folio: string;
    invoiceDate: string; // YYYY-MM-DD
    serviceDate?: string; // YYYY-MM-DD
    month: string; // YYYY-MM

    // Client snapshot
    clientName: string;
    rfc: string;
    address?: string;
    postalCode?: string;
    email?: string; // Contact

    // Invoice Data
    amount: number;
    productKey?: string;
    paymentMethod?: string;
    paymentForm?: string;
    cfdiUse?: string;
    description?: string;
    professionalId?: string; // Optional identifier
    taxRegime?: string; // Emisor regime usually, or receptor? User said "regimenFiscalEmisor" and "regimenFiscalReceptor" in first prompt, but in second prompt just "taxRegime". I'll assume receptor's regime for the invoice snapshot or just a general field.

    // Status
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
