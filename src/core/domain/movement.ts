export type MovementType = 'ingreso' | 'gasto';

export interface Movement {
    id: string;
    date: string; // ISO YYYY-MM-DD
    concept: string;
    amount: number; // Always positive
    type: MovementType;
}

export interface MovementStats {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
}

export function calculateTotals(movements: Movement[]): MovementStats {
    let totalIncome = 0;
    let totalExpense = 0;

    for (const m of movements) {
        if (m.type === 'ingreso') {
            totalIncome += m.amount;
        } else if (m.type === 'gasto') {
            totalExpense += m.amount;
        }
    }

    return {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
    };
}

export function createMovement(data: Partial<Movement>): Movement {
    if (!data.date || !data.concept || data.amount === undefined || !data.type) {
        throw new Error('Missing required fields for Movement');
    }

    if (data.amount < 0) {
        throw new Error('Amount must be positive');
    }

    return {
        id: data.id || crypto.randomUUID(),
        date: data.date,
        concept: data.concept,
        amount: data.amount,
        type: data.type,
    };
}
