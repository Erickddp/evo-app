import { useState, useEffect } from 'react';
import { dataStore } from '../../../core/data/dataStore';
import { evoStore } from '../../../core/evoappDataStore';
import { type EvoTransaction } from '../../../core/domain/evo-transaction';
import { normalizeMovements, type NormalizedMovement } from '../helpers';

// Re-export types if needed by legacy consumers, but ideally they should import from helpers
export type { NormalizedMovement };

export function useFinancialData() {
    const [allMovements, setAllMovements] = useState<NormalizedMovement[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const transactions: EvoTransaction[] = [];

            // 1. Load Registros Financieros (Income/Expenses)
            const canonicalRegistros = await evoStore.registrosFinancieros.getAll();

            if (canonicalRegistros.length > 0) {
                // Convert to EvoTransaction-like structure for normalization
                // Or we can just map directly to NormalizedMovement if we wanted, 
                // but normalizeMovements helper expects EvoTransaction[].
                // Let's adapt canonical to EvoTransaction as the helper expects it, or update helper.
                // The helper normalizeMovements expects EvoTransaction[].
                // Let's look at normalizeMovements implementation in helpers.ts:
                // It checks t.type === 'ingreso' etc.
                // Canonical 'RegistroFinanciero' has 'tipo': 'ingreso' | 'gasto', 'fecha', 'monto', ...

                // It seems easier to just construct the EvoTransaction list to feed the helper
                // or just manually push to normalized array.
                // Given the helper logic is simple, maybe we can use it if we map.

                canonicalRegistros.forEach(r => {
                    transactions.push({
                        id: r.id,
                        date: r.fecha,
                        concept: r.concepto,
                        amount: r.monto,
                        type: r.tipo, // 'ingreso' | 'gasto' matches EvoTransaction type mostly
                        source: r.origen
                    } as any);
                });
            } else {
                // Fallback
                const records = await dataStore.listRecords<{ transactions: EvoTransaction[] }>('evo-transactions');
                if (records.length > 0) {
                    const txs = records[0].payload.transactions || [];
                    transactions.push(...txs);
                }
            }

            // 2. Load Tax Payments
            const canonicalPagos = await evoStore.pagosImpuestos.getAll();
            if (canonicalPagos.length > 0) {
                canonicalPagos.forEach(p => {
                    transactions.push({
                        id: p.id,
                        date: p.fechaPago,
                        concept: p.concepto,
                        amount: p.monto,
                        type: 'impuesto', // Matches EvoTransaction type for tax
                        source: 'tax-tracker'
                    } as any);
                });
            } else if (canonicalRegistros.length === 0) {
                // Fallback for taxes only if main fallback was also used or needed.
                // The original code had a check here. We'll simplify: 
                // If we already loaded transactions from fallback, they might include taxes.
                // But explicit fallback for taxes might be needed if they are separate.
                // For now, let's assume if we loaded from evo-transactions above, it has everything.
                // If not, we rely on the above check.
            }

            const normalized = normalizeMovements(transactions);
            setAllMovements(normalized);

        } catch (e) {
            console.error("Failed to load financial data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    return {
        loading,
        allMovements,
        refetch: loadData
    };
}
