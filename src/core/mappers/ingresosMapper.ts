import { type EvoTransaction } from '../domain/evo-transaction';
import type { RegistroFinanciero } from '../evoappDataModel';

/**
 * MAPPER: Ingresos Manager <-> Unified Data Model
 */

export const ingresosMapper = {
    toCanonical(tx: EvoTransaction): RegistroFinanciero {
        return {
            id: tx.id,
            fecha: tx.date,
            concepto: tx.concept,
            monto: tx.amount,
            tipo: tx.type === 'ingreso' ? 'ingreso' : 'gasto', // 'pago'/'impuesto' map to 'gasto' for now in strict binary
            categoria: tx.category,
            origen: tx.source || 'manual',
            referenciaId: tx.metadata?.referenciaId,
            etiquetas: tx.tags,
            creadoEn: new Date().toISOString(), // Legacy might not have this, default to now
            actualizadoEn: new Date().toISOString()
        };
    },

    toLegacy(reg: RegistroFinanciero): EvoTransaction {
        return {
            id: reg.id,
            date: reg.fecha,
            concept: reg.concepto,
            amount: reg.monto,
            type: reg.tipo,
            source: reg.origen,
            category: reg.categoria,
            tags: reg.etiquetas,
            metadata: {
                referenciaId: reg.referenciaId
            }
        };
    }
};
