
export type ToolId = 'cfdi-validator' | 'ingresos-manager' | string;

export interface StoredRecord<T = unknown> {
    id: string;
    toolId: ToolId;
    createdAt: string; // ISO
    updatedAt: string; // ISO
    payload: T;
}

export interface ImportResult {
    totalRows: number;
    importedCount: number;
    errorCount: number;
    errors: string[];
}

export interface DataStore {
    saveRecord<T = unknown>(toolId: ToolId, payload: T): Promise<StoredRecord<T>>;
    listRecords<T = unknown>(toolId?: ToolId): Promise<StoredRecord<T>[]>;
    clearAll(): Promise<void>;
    exportAllAsCsv(): Promise<string>;
    exportToCSVBlob(): Promise<Blob>;
    importFromCsv(csvText: string, options?: { clearBefore?: boolean }): Promise<ImportResult>;
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

    async importFromCsv(csvText: string, options?: { clearBefore?: boolean }): Promise<ImportResult> {
        const result: ImportResult = {
            totalRows: 0,
            importedCount: 0,
            errorCount: 0,
            errors: []
        };

        if (options?.clearBefore !== false) {
            await this.clearAll();
        }

        // Remove BOM if present
        let content = csvText;
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }

        // Normalize newlines to \n
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        const lines = this.splitCsvLines(content);

        // Filter out empty lines
        const nonEmptyLines = lines.filter(line => line.trim().length > 0);

        if (nonEmptyLines.length === 0) {
            return result;
        }

        // Detect delimiter from header
        const headerLine = nonEmptyLines[0];
        const commaCount = (headerLine.match(/,/g) || []).length;
        const semiCount = (headerLine.match(/;/g) || []).length;
        const delimiter = semiCount > commaCount ? ';' : ',';

        // Validate header
        const expectedColumns = ['id', 'toolId', 'createdAt', 'updatedAt', 'payload_json'];
        const headerColumns = this.parseCsvLine(headerLine, delimiter);

        // Basic validation: check if all expected columns are present
        // We trim headers to be safe against extra whitespace
        const normalizedHeaderColumns = headerColumns.map(h => h.trim());
        const missingColumns = expectedColumns.filter(col => !normalizedHeaderColumns.includes(col));

        if (missingColumns.length > 0) {
            result.errors.push(`Invalid header. Missing columns: ${missingColumns.join(', ')}`);
            return result;
        }

        // Map header indices
        const colMap = new Map<string, number>();
        normalizedHeaderColumns.forEach((col, index) => {
            colMap.set(col, index);
        });

        const records: StoredRecord[] = [];
        const existingRecords = options?.clearBefore === false ? this.getRecords() : [];
        const existingIds = new Set(existingRecords.map(r => r.id));

        // Process rows (skip header)
        for (let i = 1; i < nonEmptyLines.length; i++) {
            result.totalRows++;
            const line = nonEmptyLines[i];

            try {
                const columns = this.parseCsvLine(line, delimiter);

                // We need at least the required columns
                if (columns.length < expectedColumns.length) {
                    throw new Error(`Invalid column count. Expected at least ${expectedColumns.length}, got ${columns.length}`);
                }

                const id = columns[colMap.get('id')!]?.trim();
                const toolId = columns[colMap.get('toolId')!]?.trim();
                const createdAt = columns[colMap.get('createdAt')!]?.trim();
                const updatedAt = columns[colMap.get('updatedAt')!]?.trim();
                const payloadJson = columns[colMap.get('payload_json')!]; // Don't trim payload JSON as it might be significant

                if (!id || !toolId || !createdAt || !updatedAt || !payloadJson) {
                    throw new Error('Missing required fields');
                }

                let payload;
                try {
                    payload = JSON.parse(payloadJson);
                } catch (e) {
                    throw new Error('Invalid JSON payload');
                }

                const record: StoredRecord = {
                    id,
                    toolId,
                    createdAt,
                    updatedAt,
                    payload
                };

                // Upsert logic
                if (existingIds.has(id)) {
                    const index = existingRecords.findIndex(r => r.id === id);
                    if (index !== -1) {
                        existingRecords[index] = record;
                    }
                } else {
                    records.push(record);
                    existingIds.add(id);
                }

                result.importedCount++;
            } catch (e) {
                result.errorCount++;
                result.errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
                console.warn(`Failed to parse CSV row ${i + 1}:`, e);
            }
        }

        this.saveRecords([...existingRecords, ...records]);
        return result;
    }

    async exportAllAsCsv(): Promise<string> {
        const records = this.getRecords();
        const header = ['id', 'toolId', 'createdAt', 'updatedAt', 'payload_json'];

        if (records.length === 0) {
            return header.join(',');
        }

        const rows = records.map((r) => {
            const payloadJson = JSON.stringify(r.payload);
            return [
                r.id,
                r.toolId,
                r.createdAt,
                r.updatedAt,
                payloadJson
            ].map(this.escapeCsvField).join(',');
        });

        return [header.join(','), ...rows].join('\n');
    }

    async exportToCSVBlob(): Promise<Blob> {
        const csvContent = await this.exportAllAsCsv();
        // Add BOM for Excel compatibility
        const BOM = '\uFEFF';
        return new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    }

    private escapeCsvField(field: string): string {
        if (field === null || field === undefined) return '';
        const stringField = String(field);
        // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r') || stringField.includes(';')) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    }

    // Robust CSV line splitter that respects quotes
    private splitCsvLines(content: string): string[] {
        const lines: string[] = [];
        let currentLine = '';
        let inQuotes = false;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];

            if (char === '"') {
                inQuotes = !inQuotes;
                currentLine += char;
            } else if (char === '\n' && !inQuotes) {
                lines.push(currentLine);
                currentLine = '';
            } else {
                currentLine += char;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    }

    private parseCsvLine(line: string, delimiter: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (inQuotes) {
                if (char === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') {
                        // Escaped quote
                        current += '"';
                        i++;
                    } else {
                        // End of quotes
                        inQuotes = false;
                    }
                } else {
                    current += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === delimiter) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
        }
        result.push(current);
        return result;
    }
}

export const dataStore: DataStore = new LocalStorageDataStore();
