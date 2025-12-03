import { z } from 'zod';

export const BankMovementSchema = z.object({
    operationDate: z.string(), // ISO YYYY-MM-DD
    postingDate: z.string(),   // ISO YYYY-MM-DD
    description: z.string(),
    amount: z.number(),
    balance: z.number().nullable(),
    type: z.enum(['ingreso', 'egreso']),
});

export type BankMovement = z.infer<typeof BankMovementSchema>;

export const BankStatementResponseSchema = z.object({
    movements: z.array(BankMovementSchema),
});

export type BankStatementResponse = z.infer<typeof BankStatementResponseSchema>;
