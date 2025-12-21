import { type EvoTransaction } from '../domain/evo-transaction';
import type { RegistroFinanciero } from '../evoappDataModel';

/**
 * MAPPER: Ingresos Manager <-> Unified Data Model
 */

export const ingresosMapper = {
    toCanonical(tx: EvoTransaction): RegistroFinanciero {
        // Normalize source to constrained list
        let source: any = 'manual';
        if (tx.source === 'bank' || tx.source === 'cfdi' || tx.source === 'tax') {
            source = tx.source;
        }

        return {
            id: tx.id,
            date: tx.date,
            amount: tx.amount,
            type: tx.type === 'ingreso' ? 'ingreso' : 'gasto',
            source: source,
            taxability: 'unknown',
            links: {},
            metadata: {
                concept: tx.concept, // Preserved here
                originalSource: tx.source, // Keep original specific source
                referenciaId: tx.metadata?.referenciaId,
                categoria: tx.category,
                etiquetas: tx.tags
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        } as RegistroFinanciero;
    },

    toLegacy(reg: any): EvoTransaction {
        // Handle both Canonical (English) and Legacy (Spanish) keys
        return {
            id: reg.id,
            date: reg.date || reg.fecha,
            concept: reg.metadata?.concept || reg.concept || reg.concepto || 'Sin concepto',
            amount: reg.amount || reg.monto,
            type: reg.type || reg.tipo,
            source: reg.metadata?.originalSource || reg.source || reg.origen || 'manual',
            category: reg.metadata?.categoria || reg.categoria,
            tags: reg.metadata?.etiquetas || reg.etiquetas,
            metadata: {
                referenciaId: reg.metadata?.referenciaId || reg.referenciaId
            }
        };
    }
};
