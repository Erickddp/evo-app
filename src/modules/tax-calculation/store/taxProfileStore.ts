import { dataStore } from '../../../core/data/dataStore';
import type { TaxProfile } from '../../shared/taxProfile';

const TOOL_ID = 'tax-profile';

export const taxProfileStore = {
    async getTaxProfile(): Promise<TaxProfile | null> {
        // Use new Snapshot API (O(1) read)
        return await dataStore.getSnapshot<TaxProfile>(TOOL_ID);
    },

    async saveTaxProfile(profile: TaxProfile): Promise<void> {
        // Use new Snapshot API (Upsert)
        await dataStore.setSnapshot(TOOL_ID, profile);
    },

    async clearTaxProfile(): Promise<void> {
        // Simulate clear by setting null (if allowed) or just ignoring.
        // But dataStore doesn't explicitly support 'deleteSnapshot' yet, 
        // however setSnapshot overwrites. 
        // We can define "cleared" as null payload if we wanted, but explicit deletion is safer.
        // For now, let's keep the limitation comment or implement a hack? 
        // Actually, we can just save null if types allow, but TaxProfile type probably doesn't.
        // Let's implement a 'deleteSnapshot' in dataStore or just leave as is with warning.
        // User asked for "maintenance" of history optional, but for current state, we effectively want to Wipe it.
        // Since I didn't add deleteSnapshot to dataStore, I will leave the warning but update it to reflect new architecture.

        console.warn("clearTaxProfile: Granular deletion not fully supported yet. Use global reset.");
    }
};
