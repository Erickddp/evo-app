import { type EvoTransaction, createEvoTransaction } from '../../core/domain/evo-transaction';

export interface ImportResult {
    movements: EvoTransaction[];
    stats: {
        totalRows: number;
        imported: number;
        ignored: number;
        errors: number;
        errorDetails: string[];
    };
}

export function parseIngresosCsv(content: string): ImportResult {
    const lines = content.split(/\r?\n/);
    const result: ImportResult = {
        movements: [],
        stats: {
            totalRows: 0,
            imported: 0,
            ignored: 0,
            errors: 0,
            errorDetails: []
        }
    };

    if (lines.length < 2) return result;

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));

    // Strict Schema: Fecha, Concepto, Ingreso, Gasto
    const idxFecha = headers.findIndex(h => h.includes('fecha'));
    const idxConcepto = headers.findIndex(h => h.includes('concepto'));
    const idxIngreso = headers.findIndex(h => h.includes('ingreso'));
    const idxGasto = headers.findIndex(h => h.includes('gasto'));

    const isValidSchema = idxFecha !== -1 && idxConcepto !== -1 && idxIngreso !== -1 && idxGasto !== -1;

    if (!isValidSchema) {
        throw new Error('Formato de CSV no reconocido. Se espera exactamente: Fecha, Concepto, Ingreso, Gasto');
    }

    // Helper to parse a CSV line handling quotes
    const parseLine = (text: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                result.push(cur);
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur);
        return result;
    };

    // We start from 1 to skip header
    // We filter out completely empty lines from the loop but count them in totalRows if they were in the file?
    // Actually, usually empty lines at end of file are just artifacts. Let's count non-empty lines.

    const dataLines = lines.slice(1).filter(l => l.trim().length > 0);
    result.stats.totalRows = dataLines.length;

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const rowNum = i + 2; // 1-based index, +1 for header

        try {
            const cols = parseLine(line);

            const cleanText = (str: string | undefined) => {
                return str ? str.replace(/^"|"$/g, '').replace(/""/g, '"').trim() : '';
            };

            const parseCurrency = (str: string | undefined) => {
                if (!str) return 0;
                const clean = str.replace(/["$,\s]/g, ''); // Remove quotes, currency symbols, commas, spaces
                const val = parseFloat(clean);
                return isNaN(val) ? 0 : val;
            };

            const dateStrRaw = cleanText(cols[idxFecha]);
            const conceptStr = cleanText(cols[idxConcepto]);
            const ingresoVal = parseCurrency(cols[idxIngreso]);
            const gastoVal = parseCurrency(cols[idxGasto]);

            // Logic:
            // If Ingreso > 0 -> Ingreso
            // If Gasto > 0 -> Gasto
            // If both > 0 -> Error/Warn? User didn't specify, but usually one per row. Let's prioritize Ingreso or just take the larger?
            // User said: "Si Ingreso > 0 y Gasto vacío -> ingreso", "Si Gasto > 0 y Ingreso vacío -> gasto".
            // "Si ambas columnas están vacías -> se puede ignorar la fila".

            const hasIngreso = ingresoVal > 0;
            const hasGasto = gastoVal > 0;

            if (!hasIngreso && !hasGasto) {
                result.stats.ignored++;
                // result.stats.errorDetails.push(`Fila ${rowNum}: Sin importe (Ingreso y Gasto vacíos/cero).`);
                continue;
            }

            let amount = 0;
            let type: 'ingreso' | 'gasto' = 'ingreso';

            if (hasIngreso && hasGasto) {
                // Edge case: both present. Let's assume it's a split or error. 
                // For now, let's log it and maybe pick the one that matches the column concept? 
                // Or just treat as Ingreso if Ingreso > 0?
                // Let's assume it's an error for now to be safe, or just pick Ingreso.
                // User didn't specify strictness here. Let's pick Ingreso.
                amount = ingresoVal;
                type = 'ingreso';
                // result.stats.errorDetails.push(`Fila ${rowNum}: Ambos valores presentes. Se tomó Ingreso.`);
            } else if (hasIngreso) {
                amount = ingresoVal;
                type = 'ingreso';
            } else {
                amount = gastoVal;
                type = 'gasto';
            }

            // Date Parsing
            let dateStr = dateStrRaw;
            // Try to handle DD/MM/YYYY or DD-MM-YYYY which are common in CSVs
            if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Try parsing common formats
                const parts = dateStr.split(/[-/]/);
                if (parts.length === 3) {
                    // Check if it's DD/MM/YYYY (day first)
                    // Heuristic: if first part > 12, it's definitely day.
                    // If year is last (4 digits).
                    const p1 = parseInt(parts[0]);
                    const p2 = parseInt(parts[1]);
                    const p3 = parseInt(parts[2]);

                    if (parts[2].length === 4) {
                        // DD-MM-YYYY or MM-DD-YYYY
                        // Assume DD-MM-YYYY for ES locale usually
                        const day = p1;
                        const month = p2;
                        const year = p3;
                        dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    }
                }

                // Fallback to Date parse
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toISOString().split('T')[0];
                } else if (dateStr !== dateStrRaw) {
                    // We manually parsed it above
                } else {
                    result.stats.errors++;
                    result.stats.errorDetails.push(`Fila ${rowNum}: Fecha inválida '${dateStrRaw}'.`);
                    continue;
                }
            }

            if (!conceptStr) {
                result.stats.errors++;
                result.stats.errorDetails.push(`Fila ${rowNum}: Concepto vacío.`);
                continue;
            }

            const movement = createEvoTransaction({
                date: dateStr,
                concept: conceptStr,
                amount: amount,
                type: type,
                source: 'manual-csv'
            });
            result.movements.push(movement);
            result.stats.imported++;

        } catch (e: any) {
            result.stats.errors++;
            result.stats.errorDetails.push(`Fila ${rowNum}: Error inesperado (${e.message}).`);
        }
    }

    return result;
}

// --- Date & Grouping Helpers ---

export function getYearMonth(dateStr: string): string {
    // Assumes dateStr is ISO YYYY-MM-DD
    return dateStr.substring(0, 7); // YYYY-MM
}

export function getYear(dateStr: string): number {
    return parseInt(dateStr.substring(0, 4), 10);
}

export interface MonthlySummary {
    month: string; // YYYY-MM
    income: number;
    expense: number;
    net: number;
}

export interface YearlySummary {
    year: number;
    income: number;
    expense: number;
    net: number;
}

export function groupMovementsByMonth(movements: EvoTransaction[]): Record<string, EvoTransaction[]> {
    const groups: Record<string, EvoTransaction[]> = {};
    movements.forEach(m => {
        const ym = getYearMonth(m.date);
        if (!groups[ym]) groups[ym] = [];
        groups[ym].push(m);
    });
    return groups;
}

export function getMonthlySummary(movements: EvoTransaction[]): MonthlySummary[] {
    const groups = groupMovementsByMonth(movements);
    const summaries: MonthlySummary[] = Object.keys(groups).sort().map(ym => {
        const txs = groups[ym];
        const income = txs.filter(t => t.type === 'ingreso').reduce((sum, t) => sum + t.amount, 0);
        const expense = txs.filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
        return {
            month: ym,
            income,
            expense,
            net: income - expense
        };
    });
    return summaries;
}

export function getYearlySummary(movements: EvoTransaction[]): YearlySummary[] {
    const groups: Record<number, EvoTransaction[]> = {};
    movements.forEach(m => {
        const y = getYear(m.date);
        if (!groups[y]) groups[y] = [];
        groups[y].push(m);
    });

    return Object.keys(groups).map(yStr => {
        const year = parseInt(yStr, 10);
        const txs = groups[year];
        const income = txs.filter(t => t.type === 'ingreso').reduce((sum, t) => sum + t.amount, 0);
        const expense = txs.filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
        return {
            year,
            income,
            expense,
            net: income - expense
        };
    }).sort((a, b) => a.year - b.year);
}

// --- Data Store Helpers ---
import { evoStore } from '../../core/evoappDataStore';
import { ingresosMapper } from '../../core/mappers/ingresosMapper';
import { dataStore } from '../../core/data/dataStore'; // Keep for legacy migration check
import { evoEvents } from '../../core/events';

export async function loadMovementsFromStore(): Promise<EvoTransaction[]> {
    try {
        // 1. Try loading from NEW Unified Store (registros-financieros)
        const canonicalRecords = await evoStore.registrosFinancieros.getAll();

        if (canonicalRecords.length > 0) {
            // Map back to Legacy for UI compatibility
            return canonicalRecords.map(ingresosMapper.toLegacy);
        }

        // 2. Fallback: Try loading from LEGACY store (ingresos-manager)
        // The user explicitly requested fallback to 'ingresos-manager'.
        // We also check 'evo-transactions' as a secondary migration source if needed, 
        // but let's prioritize the specific request or just check both.
        // For strict compliance with the prompt "If there are no canonical records, it falls back to the legacy snapshot... in dataStore",
        // we will check 'ingresos-manager'.

        console.log('No canonical data found, checking legacy Ingresos Manager data...');
        const legacyRecords = await dataStore.listRecords<{ movements: any[] }>('ingresos-manager');

        if (legacyRecords.length > 0) {
            legacyRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const legacyMovements = legacyRecords[0].payload.movements || [];

            // Convert to EvoTransaction first
            const migratedTransactions: EvoTransaction[] = legacyMovements.map((m: any) => ({
                id: m.id || crypto.randomUUID(),
                date: m.date,
                concept: m.concept,
                amount: Math.abs(m.amount),
                type: m.type || (m.amount >= 0 ? 'ingreso' : 'gasto'),
                source: 'legacy-migration'
            }));

            if (migratedTransactions.length > 0) {
                // Save immediately to canonical store
                const canonicals = migratedTransactions.map(ingresosMapper.toCanonical);
                await evoStore.registrosFinancieros.saveAll(canonicals);
                console.log(`Migrated ${migratedTransactions.length} legacy records to canonical store.`);
                return migratedTransactions;
            }
        }

        return [];
    } catch (e) {
        console.error('Failed to load movements from dataStore', e);
        return [];
    }
}

export async function saveSnapshot(transactions: EvoTransaction[]) {
    try {
        // 1. Save to Unified Store (Canonical)
        const canonicals = transactions.map(ingresosMapper.toCanonical);
        await evoStore.registrosFinancieros.saveAll(canonicals);

        // 2. Save to Legacy Store (Backward Compatibility)
        await dataStore.saveRecord('ingresos-manager', { movements: transactions });

        // 3. Emit Event
        evoEvents.emit('finance:updated');
    } catch (e) {
        console.error('Failed to save snapshot', e);
    }
}
