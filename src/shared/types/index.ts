import { z } from 'zod';
import { BankMovementSchema, BankStatementResponseSchema } from '../schemas/bank-movements';

// Re-export schemas
export { BankMovementSchema, BankStatementResponseSchema };

// Inferred types
export type BankMovement = z.infer<typeof BankMovementSchema>;
export type BankStatementResponse = z.infer<typeof BankStatementResponseSchema>;

// Extended types (if needed for UI specific logic)
export type BankMovementWithRaw = BankMovement & {
    rawLine?: string;
};
