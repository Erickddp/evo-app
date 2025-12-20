import { dataStore } from './dataStore';
import { STORAGE_KEYS } from './storageKeys';
import { FLAGS } from '../flags';

// T is preserved for generic signature compatibility but currently enforced as any[] internally
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function readLegacyEvoTransactions<T>(): Promise<T[]> {
    if (!FLAGS.legacyEvoTransactionsFallback) return [];

    try {
        const records = await dataStore.listRecords<T>(STORAGE_KEYS.LEGACY.EVO_TRANSACTIONS);
        return records;
    } catch (e) {
        console.warn('Failed to read legacy evo-transactions:', e);
        return [];
    }
}
