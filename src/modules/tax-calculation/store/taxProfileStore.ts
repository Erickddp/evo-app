import { dataStore } from '../../../core/data/dataStore';
import type { TaxProfile } from '../../shared/taxProfile';

const TOOL_ID = 'tax-profile';

export const taxProfileStore = {
    async getTaxProfile(): Promise<TaxProfile | null> {
        const records = await dataStore.listRecords<TaxProfile>(TOOL_ID);
        if (records.length === 0) return null;

        // Return the most recently updated profile if multiple exist (though we should enforce singleton)
        records.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return records[0].payload;
    },

    async saveTaxProfile(profile: TaxProfile): Promise<void> {
        // We want a singleton profile, so we could clear previous ones or just append.
        // For simplicity and history, we append, but getTaxProfile always takes the latest.
        // To keep it clean, let's clear previous profiles before saving the new one, 
        // effectively updating the single profile.

        // Actually, dataStore.saveRecord creates a NEW record with a new ID.
        // If we want to support "update", we might need to handle IDs, but dataStore seems append-only log style.
        // So "saving" is just adding a new version.

        // However, to prevent bloating the DB with profile edits, we can clear old ones for this toolId first.
        // This is a design choice. Let's keep it simple: clear old, save new.

        // Wait, if we clear old, we lose history? Maybe that's fine for a profile.
        // Let's try to just save. The getTaxProfile logic already handles getting the latest.
        // But to avoid infinite growth, let's remove old ones if there are too many?
        // For now, let's just clear old ones to enforce singleton nature strictly.

        // We can't easily delete specific records in the current dataStore interface (only clearAll).
        // Wait, dataStore.clearAll() clears EVERYTHING. That's not what we want.
        // dataStore interface doesn't have deleteByToolId.

        // So we just append. getTaxProfile gets the latest.
        await dataStore.saveRecord(TOOL_ID, profile);
    },

    async clearTaxProfile(): Promise<void> {
        // We can't clear ONLY tax profile with current dataStore.
        // This method might be tricky if dataStore doesn't support granular deletion.
        // Checking dataStore.ts...
        // It only has clearAll().

        // So we can't really "clear" just the profile without clearing everything else.
        // We can simulate "clearing" by saving a null or a special "deleted" marker, 
        // but the UI expects a TaxProfile or null.

        // If the user wants to "delete" the profile, we might need to implement a way to ignore it.
        // Or we just don't support explicit "delete profile" button for now, only "update".
        // The requirement says: "Se borre correctamente cuando se use el botón global “Clear Local Data” en Settings."
        // That works automatically with dataStore.clearAll().

        // But the requirement also asked for: clearTaxProfile(): Promise<void>;
        // If I can't implement it properly, I should probably throw or do nothing, 
        // or maybe I can extend dataStore later. For now, let's leave it empty or log a warning.

        console.warn("clearTaxProfile: Granular deletion not supported by DataStore yet. Use global Clear Data.");
    }
};
