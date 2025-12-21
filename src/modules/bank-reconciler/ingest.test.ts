import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestBankMovements } from './ingest';
import { evoStore } from '../../core/evoappDataStore';
import { evoEvents } from '../../core/events';
import type { BankMovement } from './types';

// Mock Dependencies
vi.mock('../../core/evoappDataStore', () => ({
    evoStore: {
        registrosFinancieros: {
            getAll: vi.fn(),
            putMany: vi.fn(),
            add: vi.fn(),
            save: vi.fn()
        }
    }
}));

vi.mock('../../core/events', () => ({
    evoEvents: {
        emit: vi.fn()
    }
}));

describe('ingestBankMovements', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Default empty store
        (evoStore.registrosFinancieros.getAll as any).mockResolvedValue([]);
    });

    it('should ingest new records correctly', async () => {
        const movements: BankMovement[] = [
            { date: '2024-01-01', amount: 100, type: 'DEBIT', description: 'Test Charge' },
            { date: '2024-01-02', amount: 200, type: 'CREDIT', description: 'Test Deposit' }
        ];

        const result = await ingestBankMovements(movements);

        expect(result.new).toBe(2);
        expect(result.updated).toBe(0);

        expect(evoStore.registrosFinancieros.putMany).toHaveBeenCalledTimes(1);
        const savedBatch = (evoStore.registrosFinancieros.putMany as any).mock.calls[0][0];
        expect(savedBatch).toHaveLength(2);
        expect(savedBatch[0].amount).toBe(100);
        expect(savedBatch[0].type).toBe('gasto'); // DEBIT -> gasto
        expect(savedBatch[1].amount).toBe(200);
        expect(savedBatch[1].type).toBe('ingreso'); // CREDIT -> ingreso
        expect(savedBatch[0].links.bankMovementId).toBeDefined();

        expect(evoEvents.emit).toHaveBeenCalledWith('data:changed');
    });

    it('should deduplicate existing records', async () => {
        // 1. Simulate existing record
        // We need to know the hash to simulate it. 
        // Or we just trust the logic: existingMap uses links.bankMovementId.

        // Let's run ingest once to see what ID it generates, or just mock the getAll return value carefully.
        // Actually, we can just spy on the logic. 
        // But better: let's infer the ID or just assume stability.

        const move1: BankMovement = { date: '2024-01-01', amount: 100, type: 'DEBIT', description: 'Unique Tx' };

        // First run (empty store)
        await ingestBankMovements([move1]);
        const firstCallBatch = (evoStore.registrosFinancieros.putMany as any).mock.calls[0][0];
        const generatedId = firstCallBatch[0].links.bankMovementId;
        const cfrId = firstCallBatch[0].id;

        // Reset mocks for second run
        vi.clearAllMocks();

        // Mock store returning the existing record
        (evoStore.registrosFinancieros.getAll as any).mockResolvedValue([
            { ...firstCallBatch[0] } // Return the saved record
        ]);

        // Second run (same move)
        const result = await ingestBankMovements([move1]);

        expect(result.new).toBe(0);
        expect(result.updated).toBe(1);

        const secondCallBatch = (evoStore.registrosFinancieros.putMany as any).mock.calls[0][0];
        expect(secondCallBatch[0].id).toBe(cfrId); // Should preserve CFR ID
    });
});
