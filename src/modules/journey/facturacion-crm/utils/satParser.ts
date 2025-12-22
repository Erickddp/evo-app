import { fixMojibake } from './csvParser';

export interface SatImportRow {
    uuid: string;
    rfcEmisor: string;
    nombreEmisor: string;
    rfcReceptor: string;
    nombreReceptor: string;
    fechaEmisionISODate: string;
    montoNumber: number;
    efecto: string;
    estatus: string;
    fechaCancelacionISODate?: string;
    type: 'ingreso' | 'gasto' | 'ambiguo';
}

export type ParsedSatResult = {
    valid: SatImportRow[];
    ambiguous: SatImportRow[];
    cancelled: SatImportRow[];
    errors: SatRowError[];
};

export type SatRowError = {
    row: number;
    reason: string;
    raw: string;
};

// Standard SAT headers expected
const SAT_HEADERS = [
    'Uuid',
    'RfcEmisor',
    'NombreEmisor',
    'RfcReceptor',
    'NombreReceptor',
    'FechaEmision', // Expected: DD/MM/YYYY HH:mm:ss or similar
    'FechaCertificacionSat',
    'Monto',
    'EfectoComprobante',
    'Estatus',
    'FechaCancelacion'
];

/**
 * Parses SAT CSV content.
 * Handles quoted fields, normalizes dates, money, and text.
 */
export async function parseSatCsv(text: string, ownRfc?: string): Promise<ParsedSatResult> {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    const valid: SatImportRow[] = [];
    const ambiguous: SatImportRow[] = [];
    const cancelled: SatImportRow[] = [];
    const errors: SatRowError[] = [];

    // Header Detection (Case insensitive)
    let headerLineIndex = -1;
    let headerMap: Record<string, number> = {};

    for (let i = 0; i < Math.min(20, lines.length); i++) {
        const rawCols = splitCsvLine(lines[i]);
        const normalizedCols = rawCols.map(c => normalizeHeader(c));

        // Check if we find most required headers
        const matches = SAT_HEADERS.filter(h => normalizedCols.includes(normalizeHeader(h)));
        if (matches.length >= 5) {
            headerLineIndex = i;
            normalizedCols.forEach((col, idx) => {
                headerMap[col] = idx;
            });
            console.log(`[SAT_FLOW] SAT headers detected: ${normalizedCols.join(', ')}`);
            break;
        }
    }

    if (headerLineIndex === -1) {
        return { valid: [], ambiguous: [], cancelled: [], errors: [{ row: 0, reason: 'No se encontraron encabezados del SAT válidos.', raw: '' }] };
    }

    // Process rows
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const rawLine = lines[i];
        const cols = splitCsvLine(rawLine);

        // Basic sanity check
        if (cols.length < 2) continue;

        try {
            // Extract fields using map
            const getVal = (key: string) => {
                const idx = headerMap[normalizeHeader(key)];
                return idx !== undefined && cols[idx] ? cols[idx].trim() : '';
            };

            const uuid = getVal('Uuid');
            const rfcEmisor = getVal('RfcEmisor');
            const nombreEmisor = fixMojibake(getVal('NombreEmisor'));
            const rfcReceptor = getVal('RfcReceptor');
            const nombreReceptor = fixMojibake(getVal('NombreReceptor'));
            // Date format: DD/MM/YYYY HH:mm:ss
            const rawFecha = getVal('FechaEmision');
            const rawMonto = getVal('Monto');
            const efecto = getVal('EfectoComprobante');
            const estatus = getVal('Estatus');
            const rawFechaCancelacion = getVal('FechaCancelacion');

            // Validations
            if (!uuid || uuid.length < 10) {
                errors.push({ row: i + 1, reason: 'UUID inválido', raw: rawLine });
                continue;
            }

            // Normalize Date
            // Expected SAT Date: "27/11/2024 10:29:43" or "2024-11-27T..."
            const fechaEmisionISODate = parseSatDate(rawFecha);
            if (!fechaEmisionISODate) {
                errors.push({ row: i + 1, reason: `Fecha inválida: ${rawFecha}`, raw: rawLine });
                continue;
            }

            // Normalize Mount
            const montoNumber = parseSatAmount(rawMonto);
            if (isNaN(montoNumber)) {
                errors.push({ row: i + 1, reason: `Monto inválido: ${rawMonto}`, raw: rawLine });
                continue;
            }

            const fechaCancelacionISODate = rawFechaCancelacion ? (parseSatDate(rawFechaCancelacion) || undefined) : undefined;
            const isCancelled = estatus === '0' || estatus.toLowerCase().includes('cancelad') || !!fechaCancelacionISODate;

            // Classification Logic
            let type: 'ingreso' | 'gasto' | 'ambiguo' = 'ambiguo';

            if (ownRfc) {
                // Normalize RFCs
                const normOwn = ownRfc.toUpperCase().trim();
                const normEmisor = rfcEmisor.toUpperCase().trim();
                const normReceptor = rfcReceptor.toUpperCase().trim();

                if (normEmisor === normOwn && normReceptor !== normOwn) {
                    type = 'ingreso';
                } else if (normReceptor === normOwn && normEmisor !== normOwn) {
                    type = 'gasto';
                }
            } else {
                // Determine ambiguous if no ownRfc provided
                // Caller handles ambiguous rows by asking user or defaulting
                type = 'ambiguo';
            }

            const row: SatImportRow = {
                uuid,
                rfcEmisor,
                nombreEmisor,
                rfcReceptor,
                nombreReceptor,
                fechaEmisionISODate,
                montoNumber,
                efecto,
                estatus,
                fechaCancelacionISODate,
                type
            };

            if (isCancelled) {
                cancelled.push(row);
            } else if (type === 'ambiguo') {
                ambiguous.push(row);
            } else {
                valid.push(row);
            }

        } catch (e) {
            errors.push({ row: i + 1, reason: `Error de parsing: ${(e as Error).message}`, raw: rawLine });
        }
    }

    console.log(`[SAT_FLOW] RUN sat parser completed valid=${valid.length} ambiguous=${ambiguous.length} cancelled=${cancelled.length} errors=${errors.length}`);
    return { valid, ambiguous, cancelled, errors };
}

// Helper: Custom split respecting quotes
function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"')); // Unquote and unescape double quotes
}

function normalizeHeader(h: string): string {
    return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseSatDate(dateStr: string): string | null {
    if (!dateStr) return null;
    // Format: DD/MM/YYYY HH:mm:ss
    // Split by space first
    const parts = dateStr.split(' ');
    const datePart = parts[0];

    if (datePart.includes('/')) {
        const [d, m, y] = datePart.split('/');
        if (d && m && y) {
            // Ensure YYYY
            const year = y.length === 2 ? `20${y}` : y;
            return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
    }

    // Attempt standard ISO parse
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
    }

    return null;
}

function parseSatAmount(amountStr: string): number {
    if (!amountStr) return 0;
    // Remove $ and spaces
    const clean = amountStr.replace(/[$\s]/g, '');
    // If it has commas, remove them? careful with decimal
    // Standard approach: remove all commas, then parse
    return parseFloat(clean.replace(/,/g, ''));
}
