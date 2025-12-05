import { dataStore } from './data/dataStore';
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
}

export const evoStore = {
    registrosFinancieros: new EntityStore<RegistroFinanciero>('registros-financieros'),
    facturas: new EntityStore<Factura>('facturas'),
    clientes: new EntityStore<Cliente>('clientes'),
    movimientosBancarios: new EntityStore<MovimientoBancario>('movimientos-bancarios'),
    pagosImpuestos: new EntityStore<PagoImpuesto>('pagos-impuestos'),
    calculosImpuestos: new EntityStore<CalculoImpuesto>('calculos-impuestos'),
};
