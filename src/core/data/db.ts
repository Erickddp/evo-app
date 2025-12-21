import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StoredRecord } from './dataStore';

export interface EvorixDB extends DBSchema {
    records: {
        key: string;
        value: StoredRecord;
        indexes: { 'by-toolId': string };
    };
}

const DEFAULT_DB_NAME = 'evorix-db';
const DB_VERSION = 1;

export async function initDB(dbNameOverride?: string): Promise<IDBPDatabase<EvorixDB>> {
    const name = dbNameOverride || DEFAULT_DB_NAME;
    return openDB<EvorixDB>(name, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('records')) {
                const store = db.createObjectStore('records', { keyPath: 'id' });
                store.createIndex('by-toolId', 'toolId');
            }
        },
    });
}
