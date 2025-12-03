import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StoredRecord } from './dataStore';

export interface EvorixDB extends DBSchema {
    records: {
        key: string;
        value: StoredRecord;
        indexes: { 'by-toolId': string };
    };
}

const DB_NAME = 'evorix-db';
const DB_VERSION = 1;

export async function initDB(): Promise<IDBPDatabase<EvorixDB>> {
    return openDB<EvorixDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('records')) {
                const store = db.createObjectStore('records', { keyPath: 'id' });
                store.createIndex('by-toolId', 'toolId');
            }
        },
    });
}
