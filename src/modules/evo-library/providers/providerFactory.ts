import { LocalManifestProvider } from './localManifestProvider';
import { ApiProvider } from './apiProvider';
import type { LibraryItem, ProviderStatus, LibrarySource } from './types';

// Singleton instances
const localProvider = new LocalManifestProvider();
const apiProvider = new ApiProvider();

export interface LibraryServiceResult {
    items: LibraryItem[];
    status: ProviderStatus;
    source: LibrarySource;
}

export const libraryFactory = {
    async getItems(): Promise<LibraryServiceResult> {
        const useApi = import.meta.env.VITE_LIBRARY_API_ENABLED === 'true';

        if (useApi) {
            try {
                // Try API first
                const items = await apiProvider.list();
                // If list succeeds, we assume status is ok
                return { items, status: 'ok', source: 'api' };
            } catch (error) {
                console.warn('Library API failed, falling back to local manifest.', error);

                // Fallback to local
                try {
                    const items = await localProvider.list();
                    return { items, status: 'degraded', source: 'local' };
                } catch (localError) {
                    console.error('Local manifest failed too', localError);
                    return { items: [], status: 'offline', source: 'local' };
                }
            }
        }

        // Default to local (API disabled)
        try {
            const items = await localProvider.list();
            return { items, status: 'ok', source: 'local' };
        } catch {
            return { items: [], status: 'offline', source: 'local' };
        }
    },

    async sync(): Promise<{ success: boolean; message?: string }> {
        // Sync is disabled/not required by spec but method exists in interface
        return { success: false, message: 'Sync not implemented' };
    }
};
