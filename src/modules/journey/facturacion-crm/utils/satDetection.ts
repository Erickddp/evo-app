
export function isSatCsv(headers: string[]): boolean {
    const required = ['uuid', 'rfcemisor', 'rfcreceptor', 'efectocomprobante'];
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Check if ALL required headers are present
    return required.every(r => normalizedHeaders.includes(r));
}
