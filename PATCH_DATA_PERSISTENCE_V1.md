# Patch: Data Persistence Redesign (Current-State)

## Changes
1.  **Shared Infrastructure**
    -   `dataStore.ts`: Added `getSnapshot` / `setSnapshot` for O(1) reads and upserts.
    -   `evoappDataStore.ts`: Updated `EntityStore` to use snapshots instead of `listRecords`. Removed `UnifiedPayload` wrapper.
    -   `DataGuard.tsx`: New component to block UI whie `MigrationService` runs.
    -   `App.tsx`: Wrapped application with `DataGuard`.

2.  **Migration & Utilities**
    -   `MigrationService.ts`: 
        -   Consolidates legacy append-only records into single snapshot.
        -   Migrates legacy tool data (`ingresos-manager`, `facturas-manager`, `tax-tracker`) to canonical stores.
        -   Idempotent checks via `sys-metadata` snapshot.
    -   `ingresos-manager/utils.ts`: Removed double-write logic; now writes only to canonical store. Legacy read removed (handled by migration).
    -   `useFacturas.ts`: Removed legacy fallback logic; relies on canonical store populated by migration.
    -   `Dashboard.tsx`: Updated to read/write config using properties snapshots.
    -   `modules/tax-calculation/store/taxProfileStore.ts`: Updated to use snapshots.
    -   `modules/cfdi-validator/index.tsx`: Updated to use snapshots for session persistence.

## Verification Checklist

### 1. New Profile / Empty State
-   [ ] Clear all IndexedDB data (DevTools > Application > Storage > IndexedDB > Delete Database).
-   [ ] Reload App.
-   [ ] Verify `DataGuard` shows "Verificando..." briefly.
-   [ ] Check `evoEvents` or Console: Should see "[MIGRATION] Starting V1...".
-   [ ] Verify `System Metadata` snapshot exists in `records` store: `SNAPSHOT:sys-metadata`.

### 2. Migration from Legacy (Simulated)
-   [ ] Use `dataStore.saveRecord('ingresos-manager', { movements: [...] })` in console to create dummy legacy data.
-   [ ] Reload App.
-   [ ] Check Console logs: "[MIGRATION] Migrating X entries...".
-   [ ] Open "Ingresos Manager" tool. Data should be visible.
-   [ ] Check IndexedDB: `SNAPSHOT:registros-financieros` should contain the data.

### 3. Performance
-   [ ] Create 100 updates to a client (simulating old append-only behavior).
-   [ ] Reload App. `MigrationService` should consolidate these into 1 snapshot.
-   [ ] Subsequent reloads should be O(1) (reading 1 record).

### 4. Idempotency
-   [ ] Reload App multiple times.
-   [ ] Verify `MigrationService` logs: "[MIGRATION] Already migrated to V1" on subsequent runs.
-   [ ] Data shouldn't be duplicated in lists.

## Rollback Plan
If critical failure occurs:
1.  Revert `App.tsx` (remove DataGuard).
2.  Revert `evoappDataStore.ts` to use `listRecords`.
3.  Note: Data written in new snapshot format might not be visible to old code expecting `UnifiedPayload` wrapper. To fully rollback data, might need to wrap payload in `{ items: ... }`.
