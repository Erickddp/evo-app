import type { MovimientoBancario } from '../evoappDataModel';

// Legacy type definition from Bank Reconciler (it was internal, so we redefine a compatible shape here or import if exported)
// In src/modules/bank-reconciler/index.tsx it was defined locally.
// We will assume a shape compatible with what we saw.

export interface LegacyBankMovement {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'ingreso' | 'gasto';
}

export const bankMapper = {
    toCanonical(m: LegacyBankMovement): MovimientoBancario {
        return {
            id: m.id,
            fecha: m.date,
            descripcion: m.description,
            // In legacy, amount is signed or absolute depending on context, but usually absolute + type.
            // In canonical: cargo (out) / abono (in).
            cargo: m.type === 'gasto' ? Math.abs(m.amount) : undefined,
            abono: m.type === 'ingreso' ? Math.abs(m.amount) : undefined,
            conciliado: false
        };
    },

    toLegacy(m: MovimientoBancario): LegacyBankMovement {
        const isIncome = (m.abono || 0) > 0;
        const amount = isIncome ? (m.abono || 0) : (m.cargo || 0);
        return {
            id: m.id,
            date: m.fecha,
            description: m.descripcion,
            amount: amount,
            type: isIncome ? 'ingreso' : 'gasto'
        };
    }
};
