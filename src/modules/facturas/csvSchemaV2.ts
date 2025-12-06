import type { Invoice, Client } from './types';
import type { Cliente } from '../../core/evoappDataModel';

export const FACTURAS_CSV_HEADERS_V2 = [
    "FECHA",
    "NUMERO DE FACTURA",
    "NOMBRE",
    "RFC",
    "MONTO",
    "FECHA DE PAGO",
    "CP",
    "DIRECCION",
    "METODO DE PAGO",
    "FORMA DE PAGO",
    "DESCRIPCION",
    "REGIMEN FISCAL",
    "CORREO O CONTACTO"
] as const;

export type FacturaCsvRowV2 = {
    fecha: string;
    numeroFactura: string;
    nombre: string;
    rfc: string;
    monto: string;
    fechaPago?: string;
    cp?: string;
    direccion?: string;
    metodoPago?: string;
    formaPago?: string;
    descripcion?: string;
    regimenFiscal?: string;
    correoOContacto?: string;
};

// Pure mapping helper: Invoice + Client -> CSV Row
export function mapInvoiceToCsvRowV2(invoice: Invoice, client: Cliente | undefined): FacturaCsvRowV2 {
    // Format date YYYY-MM-DD
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        // If already YYYY-MM-DD
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
        try {
            return new Date(dateStr).toISOString().slice(0, 10);
        } catch {
            return dateStr;
        }
    };

    const row: FacturaCsvRowV2 = {
        fecha: formatDate(invoice.invoiceDate),
        numeroFactura: invoice.folio,
        nombre: client?.razonSocial || invoice.clientName,
        rfc: client?.rfc || invoice.rfc,
        monto: String(invoice.amount),
        fechaPago: invoice.paymentDate ? formatDate(invoice.paymentDate) : undefined,
        cp: client?.codigoPostal || undefined,
        direccion: client?.direccion || undefined,
        metodoPago: invoice.paymentMethod,
        formaPago: invoice.paymentForm,
        descripcion: invoice.concept,
        regimenFiscal: client?.regimenFiscal || undefined,
        correoOContacto: client?.email || client?.telefono || undefined
    };

    return row;
}

// Pure mapping helper: CSV Row -> Invoice Input + Client Input
export function mapCsvRowV2ToInvoice(row: FacturaCsvRowV2): { invoice: Invoice; client: Client } {
    const parseAmount = (val: string) => {
        if (!val) return 0;
        return parseFloat(val.replace(/[$,\s]/g, ''));
    };

    const normalizeDate = (val: string) => {
        if (!val) return '';
        // DD/MM/YYYY -> YYYY-MM-DD
        if (val.includes('/')) {
            const parts = val.split('/');
            if (parts.length === 3) {
                // Assume dd/mm/yyyy
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        return val;
    };

    const amount = parseAmount(row.monto);
    const invoiceDate = normalizeDate(row.fecha);
    const paymentDate = row.fechaPago ? normalizeDate(row.fechaPago) : undefined;

    const isPaid = !!paymentDate;

    // We generate temporary IDs, actual logic might overwrite them or use them
    const newClientId = crypto.randomUUID();
    const newInvoiceId = crypto.randomUUID();
    const now = new Date().toISOString();

    const clientStub: Client = {
        id: newClientId,
        rfc: row.rfc,
        name: row.nombre,
        email: row.correoOContacto ? (row.correoOContacto.includes('@') ? row.correoOContacto : undefined) : undefined,
        phone: row.correoOContacto ? (!row.correoOContacto.includes('@') ? row.correoOContacto : undefined) : undefined,
        address: row.direccion,
        postalCode: row.cp,
        taxRegime: row.regimenFiscal,
        createdAt: now,
        updatedAt: now
    };

    const invoiceStub: Invoice = {
        id: newInvoiceId,
        folio: row.numeroFactura,
        invoiceDate,
        month: invoiceDate ? invoiceDate.slice(0, 7) : '',
        clientName: row.nombre,
        rfc: row.rfc,
        email: clientStub.email,
        concept: row.descripcion || '',
        amount,
        status: isPaid ? 'Pagada' : 'Pendiente',
        paymentForm: row.formaPago || '99',
        paymentMethod: row.metodoPago || 'PUE',
        cfdiUse: 'G03', // Default
        notes: '',

        // Derived
        paid: isPaid,
        realized: true,
        paymentDate,

        createdAt: now,
        updatedAt: now,

        // Legacy fields placeholders
        serviceDate: undefined,
        address: row.direccion,
        postalCode: row.cp,
        taxRegime: row.regimenFiscal
    };

    return { invoice: invoiceStub, client: clientStub };
}
