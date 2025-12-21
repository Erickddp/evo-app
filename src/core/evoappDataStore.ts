import { dataStore } from './data/dataStore';
import { evoEvents } from './events';
import type {
    RegistroFinanciero,
    Factura,
    Cliente,
    MovimientoBancario,
    PagoImpuesto,
    CalculoImpuesto
} from './evoappDataModel';

/**
 * EVOAPP UNIFIED STORE
 * 
 * Provides a typed API for accessing canonical entities.
 * Wraps the underlying `dataStore` (IndexedDB) to ensure consistency.
 * 
 * Storage Keys (Namespaces):
 * - registros-financieros
 * - facturas
 * - clientes
 * - movimientos-bancarios
 * - pagos-impuestos
 * - calculos-impuestos
 */

type EntityType =
    | 'registros-financieros'
    | 'facturas'
    | 'clientes'
    | 'movimientos-bancarios'
    | 'pagos-impuestos'
    | 'calculos-impuestos';

interface UnifiedPayload<T> {
    items: T[];
    lastUpdated: string;
}

class EntityStore<T extends { id: string }> {
    private entityType: EntityType;

    constructor(entityType: EntityType) {
        this.entityType = entityType;
    }

    async getAll(): Promise<T[]> {
        const records = await dataStore.listRecords<UnifiedPayload<T>>(this.entityType);
        if (records.length === 0) return [];
        // Sort by most recent record update, but payload has all items.
        // Usually we only have one record per toolId in the current architecture (snapshot model),
        // but let's be robust.
        const latest = records.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        return latest.payload.items || [];
    }

    async saveAll(items: T[]): Promise<void> {
        await dataStore.saveRecord(this.entityType, {
            items,
            lastUpdated: new Date().toISOString()
        });
        evoEvents.emit('data:changed');
    }

    async add(item: T): Promise<void> {
        const items = await this.getAll();
        const existingIdx = items.findIndex(i => i.id === item.id);

        if (existingIdx >= 0) {
            items[existingIdx] = item;
        } else {
            items.push(item);
        }

        await this.saveAll(items);
    }

    async delete(id: string): Promise<void> {
        const items = await this.getAll();
        const filtered = items.filter(i => i.id !== id);
        if (filtered.length !== items.length) {
            await this.saveAll(filtered);
        }
    }

    async getById(id: string): Promise<T | undefined> {
        const items = await this.getAll();
        return items.find(i => i.id === id);
    }

    // V2: Streaming Support
    async iterate(onItem: (item: T) => void | Promise<void>): Promise<number> {
        // Current architecture: Snapshot-based (one big record per store).
        // Optimization: We still have to load the array, but we avoid creating a giant JSON string of headers+all items.
        // We iterate the in-memory array.
        const items = await this.getAll();
        let count = 0;
        for (const item of items) {
            await onItem(item);
            count++;
        }
        return count;
    }

    async putMany(newItems: T[]): Promise<void> {
        // Snapshot architecture requires Read-Modify-Write of the whole set.
        // This is not ideal for massive concurrency but fits the current "Local-First Snapshot" model.
        // To optimize, restore engine calls this in batches.
        // We must load current, merge, save.
        // Optimization: If clearing before, we might start empty.

        // This simple implementation loads all, appends, saves all.
        // Ideally we would cache 'items' if we are doing many batches, 
        // but stateless is safer for now.
        const currentItems = await this.getAll();

        // Create a map for faster merging? or just concat if we know IDs don't collide?
        // Restore usually replaces or appends.
        // Let's use Map for ID dedup.
        const map = new Map<string, T>();
        for (const item of currentItems) map.set(item.id, item);
        for (const item of newItems) map.set(item.id, item);

        await this.saveAll(Array.from(map.values()));
    }
}

export const evoStore = {
    registrosFinancieros: new EntityStore<RegistroFinanciero>('registros-financieros'),
    facturas: new EntityStore<Factura>('facturas'),
    clientes: new EntityStore<Cliente>('clientes'),
    movimientosBancarios: new EntityStore<MovimientoBancario>('movimientos-bancarios'),
    pagosImpuestos: new EntityStore<PagoImpuesto>('pagos-impuestos'),
    calculosImpuestos: new EntityStore<CalculoImpuesto>('calculos-impuestos'),

    async exportAll(): Promise<Record<string, unknown>> {
        const data: Record<string, unknown> = {};
        // We list all keys of evoStore to iterate, excluding 'exportAll' itself
        // Because 'this' in an object literal method refers to the object itself
        const keys = Object.keys(this) as Array<keyof typeof evoStore>;

        for (const key of keys) {
            const store = this[key];
            if (store && typeof store === 'object' && 'getAll' in store) {
                // It's an EntityStore
                // @ts-ignore - we know it has getAll
                data[key] = await store.getAll();
            }
        }
        return data;
    },

    async clearAll(): Promise<void> {
        // Reset all known stores to empty
        const keys = Object.keys(this) as Array<keyof typeof evoStore>;
        for (const key of keys) {
            const store = this[key];
            if (store && typeof store === 'object' && 'saveAll' in store) {
                // @ts-ignore
                await store.saveAll([]);
            }
        }
    },

    async importAll(data: Record<string, unknown>, opts?: { onBatch?: (done: number, total: number) => void, signal?: AbortSignal }): Promise<void> {
        const keys = Object.keys(data);
        const total = keys.length;
        let done = 0;

        for (const key of keys) {
            if (opts?.signal?.aborted) {
                throw new DOMException('Restore aborted', 'AbortError');
            }

            // Find matching store
            // @ts-ignore
            const store = this[key];
            if (store && typeof store === 'object' && 'saveAll' in store) {
                const items = data[key];
                if (Array.isArray(items)) {
                    // @ts-ignore
                    await store.saveAll(items);
                }
            }

            done++;
            opts?.onBatch?.(done, total);

        }
    },

    // V2: Generic Access
    async iterateStore(storeKey: string, onItem: (item: any) => void | Promise<void>): Promise<number> {
        // @ts-ignore
        const store = this[storeKey];
        if (store && typeof store === 'object' && 'iterate' in store) {
            return await store.iterate(onItem);
        }
        return 0;
    },

    async putMany(storeKey: string, items: any[]): Promise<void> {
        // @ts-ignore
        const store = this[storeKey];
        if (store && typeof store === 'object' && 'putMany' in store) {
            await store.putMany(items);
        }
    },

    async reinitialize(namespace: string): Promise<void> {
        await dataStore.switchProfile(namespace);
        // We notify app that data changed completely
        evoEvents.emit('data:changed');
    }
};
