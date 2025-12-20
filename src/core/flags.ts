
export const FLAGS = {
    legacyEvoTransactionsFallback:
        (import.meta.env.VITE_LEGACY_EVO_TRANSACTIONS_FALLBACK ?? 'false').toLowerCase() === 'true',
} as const;
