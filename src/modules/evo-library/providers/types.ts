export interface LibraryItem {
    id: string;
    name: string;
    type: 'folder' | 'file';
    ext?: string;
    mime?: string;
    path: string;
    driveUrl: string;
    keywords: string[];
    summary: string;
    updatedAt?: string;
}

export type ProviderStatus = 'ok' | 'degraded' | 'offline';
export type LibrarySource = 'local' | 'api';

export interface SyncResult {
    added: number;
    updated: number;
    removed: number;
}

export interface LibrarySourceProvider {
    list(): Promise<LibraryItem[]>;
    sync?(): Promise<SyncResult>;
    status(): Promise<ProviderStatus>;
}
