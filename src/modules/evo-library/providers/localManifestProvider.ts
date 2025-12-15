import manifestData from '../library.manifest.json';
import type { LibraryItem, LibrarySourceProvider, ProviderStatus } from './types';

export class LocalManifestProvider implements LibrarySourceProvider {
    async list(): Promise<LibraryItem[]> {
        // Mock async behavior
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(manifestData as LibraryItem[]);
            }, 50);
        });
    }

    async status(): Promise<ProviderStatus> {
        return 'ok';
    }
}
