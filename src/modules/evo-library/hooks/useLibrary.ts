import { useState, useEffect, useCallback } from 'react';
import type { LibraryManifest } from '../types';
import { libraryService } from '../services/libraryService';

type LibraryState = {
    loading: boolean;
    error: string | null;
    data: LibraryManifest | null;
    currentUrl: string | null;
};


export const useLibrary = () => {
    const [state, setState] = useState<LibraryState>({
        loading: true,
        error: null,
        data: null,
        currentUrl: null,
    });

    const loadManifest = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const data = await libraryService.fetchManifest();
            setState(prev => ({ ...prev, loading: false, data }));
        } catch (err: any) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: err.message || 'Error loading library manifest'
            }));
        }
    }, []);

    useEffect(() => {
        loadManifest();
    }, [loadManifest]);

    const selectDocument = (url: string) => {
        setState(prev => ({ ...prev, currentUrl: url }));
    };

    return {
        ...state,
        reload: loadManifest,
        selectDocument
    };
};
