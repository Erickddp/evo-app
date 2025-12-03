export type BankMovementDirection = 'cargo' | 'abono';

export interface BankMovement {
    operationDate: string;      // 'YYYY-MM-DD'
    liquidationDate: string;    // 'YYYY-MM-DD'
    description: string;
    amount: number;             // positive number
    direction: BankMovementDirection; // 'cargo' or 'abono'
    balanceAfter?: number | null;
    rawLine?: string;           // optional original line for debugging
}
