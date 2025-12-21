/**
 * Utility functions for robust month handling and date filtering.
 * Ensures consistent behavior across the application (Dashboard, Journey, Tools).
 */

/**
 * Extracts a 'YYYY-MM' month key from various date inputs.
 * Returns null if invalid.
 */
export function toMonthKey(dateLike: string | Date | number | null | undefined): string | null {
    if (!dateLike) return null;

    try {
        if (dateLike instanceof Date) {
            if (isNaN(dateLike.getTime())) return null;
            return dateLike.toISOString().slice(0, 7);
        }

        if (typeof dateLike === 'number') {
            const d = new Date(dateLike);
            if (isNaN(d.getTime())) return null;
            return d.toISOString().slice(0, 7);
        }

        if (typeof dateLike === 'string') {
            const trimmed = dateLike.trim();
            // Match YYYY-MM pattern at start
            if (/^\d{4}-\d{2}/.test(trimmed)) {
                return trimmed.slice(0, 7);
            }
            // Try parsing if it's not a simple ISO string
            const d = new Date(trimmed);
            if (!isNaN(d.getTime())) {
                return d.toISOString().slice(0, 7);
            }
        }
    } catch (e) {
        return null;
    }

    return null;
}

/**
 * Checks if a date belongs to a specific month key (YYYY-MM).
 * Handles various input formats safely.
 */
export function isInMonth(dateLike: string | Date | number | null | undefined, targetMonthKey: string): boolean {
    if (!targetMonthKey) return false;
    const key = toMonthKey(dateLike);
    return key === targetMonthKey;
}
