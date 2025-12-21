
export function getGoogleClientId(): string | undefined {
    // Access via 'any' to avoid type issues if types are not perfect
    const id = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

    if (typeof id !== 'string') return undefined;

    const trimmed = id.trim();
    if (!trimmed) return undefined;

    // Strict validation: Must end with correct google domain
    if (!trimmed.endsWith('.apps.googleusercontent.com')) {
        console.warn('[DRIVE] Invalid Client ID format. Must end with .apps.googleusercontent.com');
        return undefined;
    }

    return trimmed;
}

export function hasGoogleClientId(): boolean {
    return !!getGoogleClientId();
}

export function getGoogleClientIdMasked(): string {
    const id = getGoogleClientId();
    if (!id) return '(missing)';
    // Show only start and end
    if (id.length < 10) return '***';
    return `${id.slice(0, 8)}...${id.slice(-6)}`;
}
