
import { MigrationService } from './MigrationService';

// Mock implementations
class MockDataStore {
    public snapshots: Record<string, any> = {};
    public records: Record<string, any[]> = {};

    async getSnapshot<T>(key: string): Promise<T | null> {
        return this.snapshots[key] || null;
    }

    async setSnapshot<T>(key: string, payload: T): Promise<void> {
        this.snapshots[key] = payload;
    }

    async listRecords(toolId?: string) {
        if (toolId && this.records[toolId]) return this.records[toolId];
        return [];
    }

    // Helper for setup
    addMockRecord(toolId: string, payload: any) {
        if (!this.records[toolId]) this.records[toolId] = [];
        this.records[toolId].push({
            id: 'mock-id-' + Math.random(),
            toolId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            payload
        });
    }
}

class MockEntityStore {
    public savedItems: any[] = [];
    async putMany(items: any[]) {
        this.savedItems.push(...items);
    }
    async getAll() { return this.savedItems; }
}

class MockEvoStore {
    registrosFinancieros = new MockEntityStore();
}

// Tests
describe('MigrationService', () => {
    let mockLegacy: MockDataStore;
    let mockCanonical: MockEvoStore;
    let service: MigrationService;

    beforeEach(() => {
        mockLegacy = new MockDataStore();
        mockCanonical = new MockEvoStore();
        service = new MigrationService(mockLegacy as any, mockCanonical as any);
    });

    it('should migrate legacy records to CFR', async () => {
        // Setup Legacy Data
        mockLegacy.addMockRecord('ingresos-manager', {
            ingresos: [
                { id: 'legacy-1', monto: 100, fecha: '2023-01-01', type: 'ingreso', source: 'manual' }
            ]
        });

        // Run
        await service.runMigration();

        // Verify
        const saved = mockCanonical.registrosFinancieros.savedItems;
        expect(saved.length).toBe(1);
        expect(saved[0].amount).toBe(100);
        expect(saved[0].date).toBe('2023-01-01');

        // Verify status
        const meta = await mockLegacy.getSnapshot<{ v1_complete: boolean }>('system:migration');
        expect(meta?.v1_complete).toBe(true);
    });

    it('should be idempotent (not duplicate if run twice)', async () => {
        // Setup Data
        mockLegacy.addMockRecord('ingresos-manager', {
            ingresos: [{ id: 'l1', monto: 50, fecha: '2023-01-01' }]
        });

        // Run 1
        await service.runMigration();
        expect(mockCanonical.registrosFinancieros.savedItems.length).toBe(1);

        // Run 2
        await service.runMigration();
        // Should return early because migration_complete is true
        expect(mockCanonical.registrosFinancieros.savedItems.length).toBe(1);
    });

    it('should deduplicate based on content hash if id missing', async () => {
        // Two tools having same data? Or same tool having data that normalizes to same properties
        mockLegacy.addMockRecord('ingresos-manager', {
            ingresos: [{ date: '2023-01-01', amount: 100, type: 'ingreso', source: 'manual' }]
        });
        mockLegacy.addMockRecord('facturas-manager', {
            // Suppose this normalizes exactly the same (unlikely in real world but possible)
            items: [{ date: '2023-01-01', amount: 100, type: 'ingreso', source: 'manual' }]
        });

        await service.runMigration();

        const saved = mockCanonical.registrosFinancieros.savedItems;
        // Should deduplicate by hash if logic works
        expect(saved.length).toBe(1);
    });

    it('should do nothing if already complete (scenario: new profile or post-migration)', async () => {
        mockLegacy.snapshots['system:migration'] = { v1_complete: true };
        mockLegacy.addMockRecord('ingresos-manager', { ingresos: [{ id: 'l1', amount: 999 }] });

        await service.runMigration();

        expect(mockCanonical.registrosFinancieros.savedItems.length).toBe(0);
    });
});
