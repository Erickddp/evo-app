import type { TaxPayment } from '../../modules/tax-tracker/types';
import type { PagoImpuesto } from '../evoappDataModel';

export const taxPaymentMapper = {
    toCanonical(tp: TaxPayment): PagoImpuesto {
        // Parse date to get month/year if not explicit
        const dateObj = new Date(tp.date);
        return {
            id: tp.id,
            fechaPago: tp.date,
            periodoMes: dateObj.getMonth() + 1,
            periodoAnio: dateObj.getFullYear(),
            concepto: tp.concept,
            monto: tp.amount,
            estado: tp.status === 'Paid' ? 'pagado' : 'pendiente'
        };
    },

    toLegacy(pi: PagoImpuesto): TaxPayment {
        return {
            id: pi.id,
            date: pi.fechaPago,
            concept: pi.concepto,
            amount: pi.monto,
            type: 'Other', // Generic fallback
            status: pi.estado === 'pagado' ? 'Paid' : 'Pending'
        };
    }
};
