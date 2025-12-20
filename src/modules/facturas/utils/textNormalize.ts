
export function fixMojibake(s: string): string {
    if (!s) return s;
    // Si no hay el caracter de reemplazo, no tocar
    // Note: The user asked to check for '' (U+FFFD). 
    // Sometimes mojibake looks like 'Ã³' but the user specifically mentioned ''.
    // We will stick to the user's logic.
    if (!s.includes('')) return s;

    try {
        // Reinterpretar como bytes latin1 y decodificar como utf-8
        // This assumes the string characters actually hold the byte values (0-255) 
        // or that the U+FFFD (65533) mapped to something recoverable or is just noise.
        // Actually, strictly following the user request:
        const bytes = Uint8Array.from(s, c => c.charCodeAt(0) & 0xff);
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

        // Si mejora (disminuye ), usarlo
        if (decoded && decoded.split('').length < s.split('').length) return decoded;
        return s;
    } catch {
        return s;
    }
}
