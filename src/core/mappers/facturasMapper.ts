import type { Invoice, Client } from '../../modules/facturas/types';
import type { Factura, Cliente } from '../evoappDataModel';

/**
 * MAPPER: Facturas Module <-> Unified Data Model
 */

export const facturasMapper = {
    // --- CLIENTS ---
    clientToCanonical(c: Client): Cliente {
        return {
            id: c.id,
            rfc: c.rfc,
            razonSocial: c.name,
            email: c.email,
            telefono: c.phone,
            direccion: c.address,
            codigoPostal: c.postalCode,
            regimenFiscal: c.taxRegime,
            fechaRegistro: c.createdAt
        };
    },

    clientToLegacy(c: Cliente): Client {
        return {
            id: c.id,
            rfc: c.rfc,
            name: c.razonSocial,
            email: c.email,
            phone: c.telefono,
            address: c.direccion,
            postalCode: c.codigoPostal,
            taxRegime: c.regimenFiscal,
            createdAt: c.fechaRegistro,
            updatedAt: c.fechaRegistro // Fallback
        };
    },

    // --- INVOICES ---
    invoiceToCanonical(inv: Invoice): Factura {
        return {
            id: inv.id,
            folio: inv.folio,
            fechaEmision: inv.invoiceDate,
            clienteNombre: inv.clientName,
            rfcCliente: inv.rfc,
            concepto: inv.concept,
            total: inv.amount,
            moneda: 'MXN', // Default for now
            tipoComprobante: 'I', // Default to Ingreso
            estado: inv.paid ? 'pagada' : 'pendiente',
            pagada: inv.paid,
            fechaPago: inv.paymentDate
        };
    },

    invoiceToLegacy(f: Factura): Invoice {
        return {
            id: f.id,
            folio: f.folio,
            invoiceDate: f.fechaEmision,
            clientName: f.clienteNombre,
            rfc: f.rfcCliente,
            concept: f.concepto,
            amount: f.total,
            status: f.estado === 'pagada' ? 'Paid' : 'Pending',
            paymentForm: '99', // Default
            paymentMethod: 'PUE', // Default
            cfdiUse: 'G03', // Default
            month: f.fechaEmision.substring(0, 7),
            paid: f.pagada,
            realized: true,
            paymentDate: f.fechaPago,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
};
