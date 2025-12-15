import { useState, useEffect, useCallback } from 'react';
import { libraryFactory } from '../providers/providerFactory';
import type { LibraryItem, ProviderStatus, LibrarySource } from '../providers/types';

export function useLibraryCatalog() {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [providerStatus, setProviderStatus] = useState<ProviderStatus>('ok');
    const [usingSource, setUsingSource] = useState<LibrarySource>('local');

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await libraryFactory.getItems();
            setItems(result.items);
            setProviderStatus(result.status);
            setUsingSource(result.source);
        } catch (err) {
            console.error(err);
            setError('Failed to load library items.');
            // Even if everything explodes, try to set empty items
            setItems([]);
            setProviderStatus('offline');
        } finally {
            setLoading(false);
        }
    }, []);

    const sync = useCallback(async () => {
        return await libraryFactory.sync();
    }, []);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        items,
        loading,
        error,
        providerStatus,
        usingSource,
        refresh,
        sync
    };
}
