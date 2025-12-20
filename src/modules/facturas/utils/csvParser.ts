
/**
 * RFC4180 compliant CSV Parser and Generator
 * 
 * Features:
 * - Handles quotes, commas, newlines inside quotes
 * - Auto-detects delimiter
 * - Strict header normalization
 */

export interface CsvParseResult {
    data: string[][]; // Rows -> Columns
    delimiter: string;
    errors: string[];
}

export function detectDelimiter(text: string): "," | ";" | "\t" {
    const firstLine = text.split('\n')[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;

    if (semis > commas && semis > tabs) return ";";
    if (tabs > commas && tabs > semis) return "\t";
    return ",";
}

/**
 * Parses CSV text using a state machine to correctly handle newlines within quotes.
 * This prevents rows from being split incorrectly.
 */
export function parseCsv(text: string): CsvParseResult {
    const delimiter = detectDelimiter(text);
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    let i = 0;

    // Remove BOM if present
    const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

    while (i < cleanText.length) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    // Escaped quote
                    currentVal += '"';
                    i++;
                } else {
                    // End of quotes
                    inQuotes = false;
                }
            } else {
                currentVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                currentRow.push(currentVal);
                currentVal = '';
            } else if (char === '\r' || char === '\n') {
                // Newline logic
                if (char === '\r' && nextChar === '\n') i++; // Skip \n in \r\n

                currentRow.push(currentVal);
                rows.push(currentRow);
                currentRow = [];
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        i++;
    }

    // Push last buffer if exists
    if (currentVal || currentRow.length > 0) {
        currentRow.push(currentVal);
        rows.push(currentRow);
    }

    // Filter empty rows (often last line is empty)
    const validRows = rows.filter(r => r.length > 0 && !(r.length === 1 && r[0] === ''));

    return { data: validRows, delimiter, errors: [] };
}

export function toCsvRow(values: (string | number | undefined | null)[]): string {
    return values.map(v => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        // If contains quote, comma, semicolon, newline -> wrap in quotes and escape quotes
        if (/[";,\n\r]/.test(s)) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    }).join(',');
}

export function normalizeHeader(raw: string): string {
    return raw
        .trim()
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^A-Z0-9]+/g, " ") // keep only alphanumeric
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Normalizes a date string.
 * Rule: 
 * - If contains /
 *   - Check first block. If > 12 -> DD/MM/YYYY
 *   - Else -> MM/DD/YYYY
 * - Returns YYYY-MM-DD
 */
export function normalizeDate(raw: string): string | null {
    if (!raw) return null;
    let s = raw.trim();
    if (!s) return null;

    // 1. ISO Format (YYYY-MM-DD) support
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // 2. Strict DD/MM/YYYY Format
    // Rule: Anything with / is DD/MM/YYYY. No guessing.
    if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            let y = parseInt(parts[2], 10);

            // Handle 2-digit year (optional but safer for bad CSVs)
            if (parts[2].length === 2) y += 2000;

            // Basic validation
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900 && y < 3000) {
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }
    }

    // If matches neither, return null (Invalid)
    return null;
}

export function parseAmount(val: string): number | null {
    if (!val) return null;
    // Remove $ and commas, allow negative
    const clean = val.replace(/[$,\s]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
}
