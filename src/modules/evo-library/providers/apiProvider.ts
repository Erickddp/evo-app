import type { LibraryItem, LibrarySourceProvider, ProviderStatus, SyncResult } from './types';

const API_BASE = import.meta.env.VITE_LIBRARY_API_BASE || '/api';

export class ApiProvider implements LibrarySourceProvider {
    async list(): Promise<LibraryItem[]> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000); // 5s timeout

        try {
            const response = await fetch(`${API_BASE}/library/manifest`, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            clearTimeout(id);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return data as LibraryItem[];
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }

    // Sync not implemented in backend, returning empty result locally
    async sync(): Promise<SyncResult> {
        return { added: 0, updated: 0, removed: 0 };
    }

    async status(): Promise<ProviderStatus> {
        // Since factory handles the calls, if list() works we assume it's ok.
        // We avoid calling /health which doesn't exist.
        return 'ok';
    }
}
