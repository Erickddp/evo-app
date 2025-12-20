import type { Invoice } from '../../types';

export type FolioSerie = 'A' | 'B' | 'C';

export interface FolioSuggestion {
    folio: string;
    isTaken: boolean;
    nextAvailable?: string; // If taken, this is the auto-incremented alternative (e.g. A-0126-2)
}

/**
 * Calculates the MMYY suffix from a YYYY-MM-DD string.
 */
export function getMonthYearSuffix(dateStr: string): string {
    if (!dateStr) return '';
    try {
        // Assume dateStr is YYYY-MM-DD
        // We want MMyy
        const [year, month] = dateStr.split('-');
        if (!year || !month) return '';
        return `${month}${year.slice(2)}`;
    } catch {
        return '';
    }
}

/**
 * Parses a folio to determine its series (A, B, or C).
 * Default to C if unknown.
 */
export function getSerieFromFolio(folio: string): FolioSerie {
    const f = folio.trim().toUpperCase();
    if (f.startsWith('A-')) return 'A';
    if (f.startsWith('B-')) return 'B';
    if (f.startsWith('C')) return 'C';
    // Fallback/Heuistics
    if (f.includes('-')) return 'A'; // Assume A if dashed but not B
    return 'C';
}

/**
 * Core logic to find the next folio.
 */
export function calculateNextFolio(
    invoices: Invoice[],
    serie: FolioSerie,
    dateStr: string
): FolioSuggestion {

    // --- SERIE C (Consecutive) ---
    if (serie === 'C') {
        // Regex to find C(\d+)
        let max = 99; // Start at C100 if none
        invoices.forEach(inv => {
            const match = inv.folio.toUpperCase().match(/^C(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > max) max = num;
            }
        });
        const next = max + 1;
        const folio = `C${next}`;
        // Verify uniqueness just in case non-standard C folios exist
        const isTaken = invoices.some(i => i.folio.toUpperCase() === folio);

        return {
            folio,
            isTaken,
            nextAvailable: isTaken ? `C${next + 1}` : undefined // Simple collision handling for C
        };
    }

    // --- SERIE A / B (Month-Year) ---
    const suffix = getMonthYearSuffix(dateStr);
    if (!suffix) {
        // If invalid date, return generic
        return { folio: `${serie}-0000`, isTaken: false };
    }

    const baseFolio = `${serie}-${suffix}`; // e.g. A-0126

    // Check strict match
    const isTaken = invoices.some(i => i.folio.toUpperCase() === baseFolio);

    if (!isTaken) {
        return { folio: baseFolio, isTaken: false };
    }

    // If taken, find next available suffix: A-0126-2, A-0126-3...
    // Pattern: A-0126(-\d+)?
    const regex = new RegExp(`^${serie}-${suffix}(?:-(\\d+))?$`);

    let maxSuffix = 1;
    let foundAny = false;

    invoices.forEach(inv => {
        const f = inv.folio.toUpperCase();
        const match = f.match(regex);
        if (match) {
            foundAny = true;
            // match[1] is the suffix digit. If undefined, it represents "1" (the base)
            if (match[1]) {
                const s = parseInt(match[1], 10);
                if (!isNaN(s) && s > maxSuffix) maxSuffix = s;
            }
        }
    });

    // Next is maxSuffix + 1
    const nextAvailable = `${serie}-${suffix}-${maxSuffix + 1}`;

    return {
        folio: baseFolio,
        isTaken: true,
        nextAvailable
    };
}
