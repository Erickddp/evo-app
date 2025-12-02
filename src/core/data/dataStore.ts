
export type ToolId = 'cfdi-validator' | 'ingresos-manager' | string;

export interface StoredRecord<T = unknown> {
    id: string;
    toolId: ToolId;
    createdAt: string; // ISO
    updatedAt: string; // ISO
    payload: T;
}

export interface DataStore {
    saveRecord<T = unknown>(toolId: ToolId, payload: T): Promise<StoredRecord<T>>;
    listRecords<T = unknown>(toolId?: ToolId): Promise<StoredRecord<T>[]>;
    clearAll(): Promise<void>;
    exportAllAsCsv(): Promise<string>; // returns CSV string for now
    importFromCsv(csvText: string, options?: { clearBefore?: boolean }): Promise<number>;
}

const STORAGE_KEY = 'evorix-core-data';

class LocalStorageDataStore implements DataStore {
    private getRecords(): StoredRecord[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to parse local storage data', e);
            return [];
        }
    }

    private saveRecords(records: StoredRecord[]): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        } catch (e) {
            console.error('Failed to save to local storage', e);
        }
    }

    async saveRecord<T = unknown>(toolId: ToolId, payload: T): Promise<StoredRecord<T>> {
        const records = this.getRecords();
        const now = new Date().toISOString();
        const newRecord: StoredRecord<T> = {
            id: crypto.randomUUID(),
            toolId,
            createdAt: now,
            updatedAt: now,
            payload,
        };
        records.push(newRecord);
        this.saveRecords(records);
        return newRecord;
    }

    async listRecords<T = unknown>(toolId?: ToolId): Promise<StoredRecord<T>[]> {
        const records = this.getRecords();
        if (toolId) {
            return records.filter((r) => r.toolId === toolId) as StoredRecord<T>[];
        }
        return records as StoredRecord<T>[];
    }

    async clearAll(): Promise<void> {
        localStorage.removeItem(STORAGE_KEY);
    }

    async importFromCsv(csvText: string, options?: { clearBefore?: boolean }): Promise<number> {
        if (options?.clearBefore !== false) {
            await this.clearAll();
        }

        const lines = csvText.split(/\r?\n/);
        const records: StoredRecord[] = [];
        const existingRecords = options?.clearBefore === false ? this.getRecords() : [];

        // Skip header if present
        const startIndex = lines[0]?.startsWith('id,toolId,createdAt,updatedAt,payload_json') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                // Safe split respecting payload_json might have commas
                // Expected format: id,toolId,createdAt,updatedAt,"payload_json"
                // or id,toolId,createdAt,updatedAt,payload_json (if no commas in json)

                // We know the first 4 fields are fixed.
                const firstComma = line.indexOf(',');
                const secondComma = line.indexOf(',', firstComma + 1);
                const thirdComma = line.indexOf(',', secondComma + 1);
                const fourthComma = line.indexOf(',', thirdComma + 1);

                if (firstComma === -1 || secondComma === -1 || thirdComma === -1 || fourthComma === -1) {
                    console.warn(`Skipping invalid CSV line ${i + 1}: Not enough columns`);
                    continue;
                }

                const id = line.substring(0, firstComma);
                const toolId = line.substring(firstComma + 1, secondComma);
                const createdAt = line.substring(secondComma + 1, thirdComma);
                const updatedAt = line.substring(thirdComma + 1, fourthComma);
                let payloadStr = line.substring(fourthComma + 1);

                // Handle quotes if present (CSV export usually wraps JSON in quotes if it contains commas)
                if (payloadStr.startsWith('"') && payloadStr.endsWith('"')) {
                    payloadStr = payloadStr.substring(1, payloadStr.length - 1);
                    // Unescape double quotes
                    payloadStr = payloadStr.replace(/""/g, '"');
                }

                const payload = JSON.parse(payloadStr);

                const record: StoredRecord = {
                    id,
                    toolId,
                    createdAt,
                    updatedAt,
                    payload,
                };
                records.push(record);
            } catch (e) {
                console.error(`Failed to parse CSV line ${i + 1}`, e);
            }
        }

        this.saveRecords([...existingRecords, ...records]);
        return records.length;
    }

    async exportAllAsCsv(): Promise<string> {
        const records = this.getRecords();
        if (records.length === 0) {
            return 'id,toolId,createdAt,updatedAt,payload_json';
        }

        // Simple CSV generation: id, toolId, createdAt, updatedAt, payload (JSON stringified)
        const header = 'id,toolId,createdAt,updatedAt,payload_json';
        const rows = records.map((r) => {
            // Escape double quotes in payload JSON
            const payloadStr = JSON.stringify(r.payload).replace(/"/g, '""');
            return `${r.id},${r.toolId},${r.createdAt},${r.updatedAt},"${payloadStr}"`;
        });

        return [header, ...rows].join('\n');
    }
}

export const dataStore: DataStore = new LocalStorageDataStore();
