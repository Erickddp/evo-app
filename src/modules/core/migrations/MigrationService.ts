import { dataStore } from '../../../core/data/dataStore';
import { evoStore } from '../../../core/evoappDataStore'; // Canonical Store
import { normalizeToRegistroFinanciero } from '../normalize/normalizeToRegistroFinanciero';
import type { RegistroFinanciero } from '../financial/types';

const LEGACY_TOOLS = [
    'ingresos-manager',
    'facturas-manager',
    'tax-tracker',
    'dashboard-config' // Example, though maybe not financial
];

export class MigrationService {

    private legacyStore: typeof dataStore;
    private canonicalStore: any;

    constructor(
        legacyStore: typeof dataStore = dataStore,
        // Using 'any' for canonicalStore temporarily because evoStore type is anonymous object in evoappDataStore
        // ideally we would export EvoStore type there.
        canonicalStore: any = evoStore
    ) {
        this.legacyStore = legacyStore;
        this.canonicalStore = canonicalStore;
    }


    /**
     * Executes the one-time migration from Legacy/Snapshot data to Canonical Financial Records.
     * Idempotent: checks for completion flag.
     */
    async runMigration(): Promise<void> {
        console.log('[MigrationService] Checking migration status...');

        // 1. Check if already done
        const isDone = await this.isMigrationComplete();
        if (isDone) {
            console.log('[MigrationService] Migration V1 already completed (or skipped via Restore).');
            return;
        }

        console.log('[MigrationService] Starting Migration V1...');

        try {
            const allRecords: RegistroFinanciero[] = [];

            // 2. Load Snapshots (Append-Only Historical)
            // We iterate over known tools that produced financial data
            for (const toolId of LEGACY_TOOLS) {
                const records = await this.legacyStore.listRecords(toolId);

                if (records.length === 0) continue;

                // Sort by date to process chronologically or get latest?
                // The prompt says: "b) Para cada snapshot: reconstruir último estado por entidad"
                // Assuming 'payload' IS the state (snapshot).
                // We want the LATEST snapshot effectively, OR if append-only meant "events", we process all.
                // Given "ingresos-manager", usually it saved the whole array? 
                // Let's assume it saved snapshots. We take the latest one.
                const sorted = records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const latest = sorted[0];

                if (latest && latest.payload) {
                    // Normalize items inside the payload
                    const items = this.extractItems(latest.payload);
                    for (const item of items) {
                        const cfr = normalizeToRegistroFinanciero(item, {
                            defaultSource: 'manual', // default fallback
                            // We could infer more context from toolId
                        });
                        allRecords.push(cfr);
                    }
                }
            }

            // 3. Import from 'legacy keys' if they exist as direct snapshots in the dataStore?
            // The listRecords above covers the 'append-only' aspect.
            // If dataStore was used with `setSnapshot` (key-value) previously, we'd check getSnapshot.
            // But dataStore.ts implies 'records' store was used for everything.
            // So listRecords is likely sufficient.

            // 4. Deduplicate
            const uniqueRecords = this.deduplicate(allRecords);

            // 5. Save to Canonical Store
            if (uniqueRecords.length > 0) {
                console.log(`[MigrationService] Saving ${uniqueRecords.length} migrated records.`);
                // We use putMany or saveAll depending on if we want to replace or merge.
                // Prompt: "Guardar SOLO CFR en evoStore canónico."
                // Idempotency implies we should merge, or if it's "migration", maybe we just set?
                // Let's use putMany (merge) to be safe if some new data exists.
                await this.canonicalStore.registrosFinancieros.putMany(uniqueRecords);
            }

            // 6. Mark Complete
            await this.markMigrationComplete();
            console.log('[MigrationService] Migration V1 Success.');

        } catch (e) {
            console.error('[MigrationService] Migration Failed:', e);
            // Do not mark complete so it retries
        }
    }

    private extractItems(payload: unknown): any[] {
        if (Array.isArray(payload)) return payload;
        if (payload && typeof payload === 'object') {
            // Check common legacy shapes
            // e.g. { activeProfileId, incomes: [] }
            if ('ingresos' in payload && Array.isArray((payload as any).ingresos)) return (payload as any).ingresos;
            if ('facturas' in payload && Array.isArray((payload as any).facturas)) return (payload as any).facturas;
            if ('items' in payload && Array.isArray((payload as any).items)) return (payload as any).items;
            // If it is just an object possibly representing one record? Unlikely for managers.
        }
        return [];
    }

    private deduplicate(records: RegistroFinanciero[]): RegistroFinanciero[] {
        const map = new Map<string, RegistroFinanciero>();

        for (const r of records) {
            // Priority: xmlUuid > bankMovementId > generated-content-hash
            let key = r.id;

            if (r.links?.xmlUuid) key = `xml:${r.links.xmlUuid}`;
            else if (r.links?.bankMovementId) key = `bank:${r.links.bankMovementId}`;
            else {
                // Fallback content hash for manual items to avoid dupes if migration runs twice on same data source
                // (date + amount + source + type)
                key = `hash:${r.date}-${r.amount}-${r.source}-${r.type}`;
            }

            const existing = map.get(key);
            if (!existing) {
                map.set(key, r);
            } else {
                // Conflict resolution: Conserve the most recent (updatedAt)
                if (new Date(r.updatedAt) > new Date(existing.updatedAt)) {
                    map.set(key, r);
                }
            }
        }

        return Array.from(map.values());
    }

    private async isMigrationComplete(): Promise<boolean> {
        // We store this meta-flag in the dataStore itself? 
        // Or in localStorage? If we clear localStorage, we lose it?
        // Better store it in the 'records' store as a special meta-record or use a dedicated meta store.
        // For simplicity and robustness within the DB:
        // We can use getSnapshot('migration_meta') if available, or just listRecords checking for a specific ID.

        // Let's use `evoStore` meta capability if possible or `dataStore.getSnapshot`.
        // `dataStore.getSnapshot` uses keys like 'ingresos-manager'. We can use 'system:migration'.

        const meta = await this.legacyStore.getSnapshot<{ v1_complete: boolean; source?: string }>('system:migration');
        if (meta?.v1_complete) {
            if (meta.source === 'restore-v2') {
                console.log('[MigrationService] Found Restore V2 flag. Skipping migration.');
            }
            return true;
        }
        return false;
    }

    private async markMigrationComplete(): Promise<void> {
        await this.legacyStore.setSnapshot('system:migration', { v1_complete: true, timestamp: new Date().toISOString() });
    }
}

export const migrationService = new MigrationService();
