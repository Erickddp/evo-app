
import { type EvoTransaction, calculateTotals as calcTotalsCore } from '../../../core/domain/evo-transaction';
import { ingresosMapper } from '../../../core/mappers/ingresosMapper';
import type { RegistroFinanciero } from '../../../core/evoappDataModel';
import { evoStore } from '../../../core/evoappDataStore';

// Re-export core calculator for use in UI
export const calculateTotals = calcTotalsCore;

export function formatCurrency(amount: number): string {
    return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function normalizeMovimientoToRegistro(input: any): RegistroFinanciero | null {
    try {
        if (!input) return null;

        // 1. Date
        let date = '';
        if (input.date instanceof Date) {
            date = input.date.toISOString().split('T')[0];
        } else if (typeof input.date === 'string') {
            if (input.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                date = input.date;
            } else {
                const d = new Date(input.date);
                if (!isNaN(d.getTime())) {
                    date = d.toISOString().split('T')[0];
                }
            }
        }
        if (!date) return null;

        // 2. Amount
        let amount = Number(input.amount);
        if (isNaN(amount) || amount === 0) return null;
        amount = Math.abs(amount); // Always positive in store

        // 3. Type
        // Input type is expected to be 'ingreso' (Abono) or 'gasto' (Cargo)
        // If input logic comes from UI toggle, ensure it matches.
        const type: 'ingreso' | 'gasto' = input.type === 'ingreso' ? 'ingreso' : 'gasto';

        // 4. Concept
        const concept = typeof input.concept === 'string' ? input.concept.trim() : 'Movimiento Manual';
        if (!concept) return null;

        // 5. Source
        const source = 'manual';

        // 6. ID
        const id = input.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mov-${Date.now()}`);
        const now = new Date().toISOString();

        return {
            id,
            date,
            type,
            amount,
            concept,
            source,
            taxability: input.taxability || 'exempt',
            metadata: input.metadata || {},
            links: input.links || [],
            createdAt: now,
            updatedAt: now
        };
    } catch (e) {
        console.error('Normalization error', e);
        return null;
    }
}

export async function loadMovimientosFromStore(): Promise<EvoTransaction[]> {
    try {
        const canonicalRecords = await evoStore.registrosFinancieros.getAll();
        return canonicalRecords.map(ingresosMapper.toLegacy);
    } catch (e) {
        console.error('Failed to load movements from store', e);
        return [];
    }
}

export async function saveMovimientosSnapshot(transaction: EvoTransaction) {
    try {
        // Single save for manual entry
        const canonical = ingresosMapper.toCanonical(transaction);
        await evoStore.registrosFinancieros.add(canonical);
    } catch (e) {
        console.error('Failed to save movement', e);
    }
}


// Helper to remove if needed
export async function deleteMovimientoFromStore(id: string) {
    try {
        await evoStore.registrosFinancieros.delete(id);
    } catch (e) {
        console.error('Failed to delete movement', e);
    }
}


// --- CSV UTILITIES ---

export type CsvRowError = {
    row: number;
    reason: string;
    raw: string;
};

export type CsvImportResult = {
    valid: EvoTransaction[];
    errors: CsvRowError[];
    total: number;
};

export function downloadTemplate() {
    const headers = 'date,type,amount,concept,reference,account,category';
    const example1 = '2025-12-01,abono,1000.00,Depósito ejemplo,REF001,BBVA,Ingreso';
    const example2 = '2025-12-02,cargo,250.00,Compra ejemplo,REF002,BBVA,Gasto';
    const csvContent = "data:text/csv;charset=utf-8," + [headers, example1, example2].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "plantilla_movimientos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportToCsv(movements: EvoTransaction[], month: string) {
    if (!movements.length) return;

    const headers = ['Fecha', 'Tipo', 'Monto', 'Concepto', 'Fuente'];
    const rows = movements.map(m => [
        `"${m.date}"`,
        `"${m.type === 'ingreso' ? 'Abono' : 'Cargo'}"`,
        `"${m.amount.toFixed(2)}"`,
        `"${m.concept.replace(/"/g, '""')}"`,
        `"${m.source || 'manual'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," +
        [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `movimientos_${month.replace('-', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


function splitCsvLine(line: string, delimiter = ','): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            // Handle double quotes inside quotes (e.g. "foo ""bar"" baz")
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function fixEncoding(text: string): string {
    try {
        // Simple heuristic: if text has utf8-like chars interpreted as latin1, decode them.
        // We essentially want decoded utf-8.
        // Most common browser encoding mess: UTF-8 read as ISO-8859-1.
        return decodeURIComponent(escape(text));
    } catch {
        return text;
    }
}

function detectCsvFormat(headerLine: string): 'template' | 'bank' | 'unknown' {
    const lower = headerLine.toLowerCase();
    if (lower.includes('date') && lower.includes('type') && lower.includes('amount')) return 'template';
    if (lower.includes('fecha') && lower.includes('concepto') && (lower.includes('ingreso') || lower.includes('deposito') || lower.includes('cargo') || lower.includes('retiro'))) return 'bank';
    // Fallback for spanish template
    if (lower.includes('date') && lower.includes('type')) return 'template';
    return 'bank'; // Aggressive fallback to bank if it looks like typical CSV, or 'unknown'
}

export async function parseMovimientosCsv(fileText: string): Promise<CsvImportResult> {
    const lines = fileText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return { valid: [], errors: [], total: 0 };

    // Header detection
    const format = detectCsvFormat(lines[0]);
    if (format === 'template') {
        return parseTemplateCsv(lines);
    } else {
        return parseBankCsv(lines);
    }
}


function parseTemplateCsv(lines: string[]): CsvImportResult {
    // Skip header if looks like header
    let startIdx = 0;
    if (lines[0].toLowerCase().includes('date') || lines[0].toLowerCase().includes('fecha')) {
        startIdx = 1;
    }

    const valid: EvoTransaction[] = [];
    const errors: CsvRowError[] = [];

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        try {
            const cols = line.split(',');
            if (cols.length < 4) {
                errors.push({ row: i + 1, reason: 'Faltan columnas (min: date,type,amount,concept)', raw: line });
                continue;
            }

            const rawDate = cols[0].trim().replace(/"/g, '');
            const rawType = cols[1].trim().toLowerCase().replace(/"/g, '');
            const rawAmount = cols[2].trim().replace(/[$,"]/g, '');
            const rawConcept = cols[3].trim().replace(/"/g, '');

            // 1. Date
            const normalizedDate = normalizeDate(rawDate);
            let date = '';

            if (normalizedDate.ok && normalizedDate.value) {
                date = normalizedDate.value;
            } else {
                errors.push({ row: i + 1, reason: `Fecha inválida. Formatos permitidos: YYYY-MM-DD o DD/MM/YYYY o DD-MM-YYYY (${rawDate})`, raw: line });
                continue;
            }

            // 2. Type
            let type: 'ingreso' | 'gasto' | null = null;
            if (['abono', 'ingreso', 'deposit'].includes(rawType)) type = 'ingreso';
            else if (['cargo', 'gasto', 'expense', 'retiro'].includes(rawType)) type = 'gasto';

            if (!type) {
                errors.push({ row: i + 1, reason: `Tipo inválido (req: abono/cargo): ${rawType}`, raw: line });
                continue;
            }

            // 3. Amount
            const amount = parseFloat(rawAmount);
            if (isNaN(amount) || amount <= 0) {
                errors.push({ row: i + 1, reason: `Monto inválido: ${rawAmount}`, raw: line });
                continue;
            }

            // 4. Concept
            if (rawConcept.length < 2) {
                errors.push({ row: i + 1, reason: `Concepto muy corto`, raw: line });
                continue;
            }
            const cleanConcept = fixEncoding(rawConcept);

            // Generate stable ID
            const hash = simpleHash(cleanConcept);
            const id = `bank_${date}_${type}_${amount}_${hash}`;

            valid.push({
                id,
                date,
                type,
                amount,
                concept: cleanConcept,
                source: 'csv'
            });

        } catch (e) {
            errors.push({ row: i + 1, reason: 'Error de parseo desconocido', raw: line });
        }
    }

    return { valid, errors, total: lines.length - startIdx };
}

function parseBankCsv(lines: string[]): CsvImportResult {
    // 1. Detect column indices from header
    const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));

    // Map required columns
    const idxDate = header.findIndex(h => h.includes('fecha'));
    const idxConcept = header.findIndex(h => h.includes('concepto') || h.includes('descripcion') || h.includes('descripción'));

    // Amounts: look for "ingreso", "deposito", "abono" VS "gasto", "cargo", "retiro"
    const idxIncome = header.findIndex(h => h.includes('ingreso') || h.includes('deposito') || h.includes('depósito') || h.includes('abono'));
    const idxExpense = header.findIndex(h => h.includes('gasto') || h.includes('cargo') || h.includes('retiro'));

    if (idxDate === -1 || idxConcept === -1 || (idxIncome === -1 && idxExpense === -1)) {
        // Can't identify essential columns. Fallback to assuming positions or error?
        // Let's soft fail or try generic positions? No, standard is strict.
        return {
            valid: [],
            errors: [{ row: 1, reason: 'No se detectaron columnas válidas (Fecha, Concepto, Ingreso/Gasto)', raw: lines[0] }],
            total: lines.length
        };
    }

    const valid: EvoTransaction[] = [];
    const errors: CsvRowError[] = [];

    // Skip header of course
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        try {
            // Use robust splitter instead of split(',')
            const cols = splitCsvLine(line, ',');

            // Get Raw Values
            const rawDate = cols[idxDate]?.trim().replace(/"/g, '') || '';
            const rawConcept = cols[idxConcept]?.trim().replace(/"/g, '') || '';
            const rawIncome = idxIncome !== -1 ? cols[idxIncome]?.trim().replace(/[$,"]/g, '') : '';
            const rawExpense = idxExpense !== -1 ? cols[idxExpense]?.trim().replace(/[$,"]/g, '') : '';

            // 1. Date
            const normalizedDate = normalizeDate(rawDate);
            if (!normalizedDate.ok || !normalizedDate.value) {
                errors.push({ row: i + 1, reason: `Fecha inválida (${rawDate})`, raw: line });
                continue;
            }
            const date = normalizedDate.value;

            // 2. Amounts & Type
            let incomeVal = parseFloat(rawIncome);
            let expenseVal = parseFloat(rawExpense);
            if (isNaN(incomeVal)) incomeVal = 0;
            if (isNaN(expenseVal)) expenseVal = 0;

            // Fix absolute values just in case
            incomeVal = Math.abs(incomeVal);
            expenseVal = Math.abs(expenseVal);

            let type: 'ingreso' | 'gasto' | null = null;
            let amount = 0;

            if (incomeVal > 0 && expenseVal === 0) {
                type = 'ingreso';
                amount = incomeVal;
            } else if (expenseVal > 0 && incomeVal === 0) {
                type = 'gasto';
                amount = expenseVal;
            } else if (expenseVal > 0 && incomeVal > 0) {
                errors.push({ row: i + 1, reason: 'Ambiguo: Tiene valores en Ingreso y Gasto', raw: line });
                continue;
            } else {
                // Format usually implies blank = 0. If both blank/0, ignore?
                errors.push({ row: i + 1, reason: 'Sin monto válido', raw: line });
                continue;
            }

            // 3. Concept
            let cleanConcept = fixEncoding(rawConcept);
            if (cleanConcept.length < 2) {
                cleanConcept = "Movimiento Desconocido"; // Fallback or error? Strict requirement said error for template. For bank we can be lenient or strict.
                // let's error to be safe
                errors.push({ row: i + 1, reason: 'Concepto vacío/corto', raw: line });
                continue;
            }

            const hash = simpleHash(cleanConcept);
            const id = `bank_${date}_${type}_${amount}_${hash}`;

            valid.push({
                id,
                date,
                type,
                amount,
                concept: cleanConcept,
                source: 'csv'
            });

        } catch (e) {
            errors.push({ row: i + 1, reason: 'Error parseo', raw: line });
        }
    }

    return { valid, errors, total: lines.length - 1 };
}


export async function saveImportedMovimientos(transactions: EvoTransaction[]) {
    // Bulk save? Store interface is item by item usually, but we can parallelize or sequential
    // Check duplicates against existing for current month?
    // User requirement: "Importar NO debe borrar. deduplicar contra registros existentes del mes por id"

    // 1. Load existing to check dups (optimization: load all for impacted months? Or just all?)
    // Our store is simple indexedDB usually. Let's just try to add. If ID exists, store might overwrite or fail.
    // The requirement says "insertar solo nuevos".
    // We'll check existence first.

    const all = await loadMovimientosFromStore();
    const existingIds = new Set(all.map(x => x.id));

    const toAdd: EvoTransaction[] = [];
    let duplicates = 0;

    for (const tx of transactions) {
        if (existingIds.has(tx.id)) {
            duplicates++;
        } else {
            toAdd.push(tx);
        }
    }

    // Write sequentially
    for (const tx of toAdd) {
        await saveMovimientosSnapshot(tx);
    }

    return { added: toAdd.length, duplicates };
}

// Helper for date normalization
export function normalizeDate(input: string): { ok: boolean; value?: string; reason?: string } {
    if (!input) return { ok: false, reason: 'Fecha vacía' };

    // 1. Try YYYY-MM-DD
    if (input.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Validate valid date
        const parts = input.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (d.getFullYear() === parts[0] && d.getMonth() === parts[1] - 1 && d.getDate() === parts[2]) {
            return { ok: true, value: input };
        }
        return { ok: false, reason: 'Fecha inválida (calendario)' };
    }

    // 2. Try DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1], 10);
        const month = parseInt(ddmmyyyy[2], 10);
        const year = parseInt(ddmmyyyy[3], 10);

        const d = new Date(year, month - 1, day);
        if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
            // Return canonical YYYY-MM-DD
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return { ok: true, value: `${y}-${m}-${da}` };
        }
        return { ok: false, reason: 'Fecha inválida (calendario)' };
    }

    return { ok: false, reason: 'Formato desconocido' };
}

function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}
