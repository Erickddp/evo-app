import { dataStore } from '../dataStore';
import { ingresosMapper } from '../../mappers/ingresosMapper';
import { facturasMapper } from '../../mappers/facturasMapper';
import { taxPaymentMapper } from '../../mappers/taxPaymentMapper';

interface SysMetadata {
    migration_complete_v1: boolean;
    schemaVersion: number;
    migratedAt: string;
}

export class MigrationService {
    private static readonly METADATA_KEY = 'sys-metadata';

    static async checkAndMigrate(): Promise<void> {
        console.log('[MIGRATION] Checking migration status...');

        // 1. Check if already migrated
        const metadata = await dataStore.getSnapshot<SysMetadata>(this.METADATA_KEY);
        if (metadata && metadata.migration_complete_v1) {
            console.log('[MIGRATION] Already migrated to V1.');
            return;
        }

        console.log('[MIGRATION] Starting V1 Migration (Append-Only -> Current-State)...');
        const start = performance.now();

        try {
            // Priority 1: Convert Append-Only Snapshots to Single Snapshot
            const stores = [
                'registros-financieros',
                'facturas',
                'clientes',
                'pagos-impuestos',
                'movimientos-bancarios',
                'calculos-impuestos'
            ];

            for (const key of stores) {
                await this.consolidateSnapshot(key);
            }

            // Priority 2: Migrate Legacy Keys if Canonical is Empty
            await this.migrateLegacyIngresos();
            await this.migrateLegacyFacturas();
            await this.migrateLegacyTax();
            await this.migrateDashboardConfig();

            // Mark Complete
            await dataStore.setSnapshot<SysMetadata>(this.METADATA_KEY, {
                migration_complete_v1: true,
                schemaVersion: 1,
                migratedAt: new Date().toISOString()
            });

            console.log(`[MIGRATION] Success in ${(performance.now() - start).toFixed(2)}ms`);

        } catch (error) {
            console.error('[MIGRATION] Failed', error);
            // We do NOT mark complete so it retries next time.
            throw error;
        }
    }

    // Helper: Reads all legacy 'records', takes the absolute last one, saves as snapshot
    private static async consolidateSnapshot(key: string) {
        // Check if snapshot already exists (safety for idempotency if we re-run partial migration)
        const existingSnapshot = await dataStore.getSnapshot(key);
        if (existingSnapshot) {
            // If snapshot exists, trust it as the "latest" truth from a previous run or usage.
            return;
        }

        const records = await dataStore.listRecords(key);
        if (records.length === 0) return;

        // Sort by createdAt desc to get latest
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const latest = records[0];
        let payload = latest.payload;

        // Unwrap UnifiedPayload if present (legacy evoStore wrapper)
        if (payload && typeof payload === 'object' && 'items' in payload && Array.isArray((payload as any).items)) {
            payload = (payload as any).items;
        }

        console.log(`[MIGRATION] Consolidating ${key}: ${records.length} snapshots found. Keeping latest from ${latest.createdAt}`);

        await dataStore.setSnapshot(key, payload);
    }

    private static async migrateLegacyIngresos() {
        const CANONICAL_KEY = 'registros-financieros';
        const LEGACY_KEY = 'ingresos-manager';

        // Only migrate if canonical is empty
        const current = await dataStore.getSnapshot(CANONICAL_KEY);
        if (current) return;

        const records = await dataStore.listRecords(LEGACY_KEY);
        if (records.length === 0) return;

        // Get latest legacy snapshot
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const sourceData = records[0].payload as any[];

        if (!Array.isArray(sourceData)) return;

        console.log(`[MIGRATION] Migrating ${sourceData.length} entries from ${LEGACY_KEY} to ${CANONICAL_KEY}`);

        const mapped = sourceData.map(item => ingresosMapper.toCanonical(item));
        await dataStore.setSnapshot(CANONICAL_KEY, mapped);
    }

    private static async migrateLegacyFacturas() {
        const FACTURAS_KEY = 'facturas';
        const CLIENTES_KEY = 'clientes';
        const LEGACY_KEY = 'facturas-manager';

        const currentF = await dataStore.getSnapshot(FACTURAS_KEY);
        const currentC = await dataStore.getSnapshot(CLIENTES_KEY);

        if (currentF && currentC) return;

        const records = await dataStore.listRecords(LEGACY_KEY);
        if (records.length === 0) return;

        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Legacy payload for facturas-manager was often { clients: [], invoices: [] }
        const sourcePayload = records[0].payload as any;

        if (sourcePayload && sourcePayload.invoices && !currentF) {
            console.log(`[MIGRATION] Migrating invoices from ${LEGACY_KEY}`);
            const mappedF = sourcePayload.invoices.map((inv: any) => facturasMapper.invoiceToCanonical(inv));
            await dataStore.setSnapshot(FACTURAS_KEY, mappedF);
        }

        if (sourcePayload && sourcePayload.clients && !currentC) {
            console.log(`[MIGRATION] Migrating clients from ${LEGACY_KEY}`);
            const mappedC = sourcePayload.clients.map((c: any) => facturasMapper.clientToCanonical(c));
            await dataStore.setSnapshot(CLIENTES_KEY, mappedC);
        }
    }

    private static async migrateLegacyTax() {
        const CANONICAL_KEY = 'pagos-impuestos';
        const LEGACY_KEY = 'tax-tracker';

        const current = await dataStore.getSnapshot(CANONICAL_KEY);
        if (current) return;

        const records = await dataStore.listRecords(LEGACY_KEY);
        if (records.length === 0) return;

        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const sourceData = records[0].payload as any[];

        if (!Array.isArray(sourceData)) return;

        const mapped = sourceData.map(item => taxPaymentMapper.toCanonical(item));
        await dataStore.setSnapshot(CANONICAL_KEY, mapped);
    }

    private static async migrateDashboardConfig() {
        const KEY = 'dashboard-config';
        const current = await dataStore.getSnapshot(KEY);
        if (current) return;

        await this.consolidateSnapshot(KEY);
    }
}
