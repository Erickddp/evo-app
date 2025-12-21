import { tokenManager } from './tokenManager';
import { getGoogleClientId, hasGoogleClientId } from './driveConfig';

export type DriveUploadResult = { fileId: string; name: string };

export interface DriveClient {
    isAuthenticated(): boolean;
    signIn(): Promise<void>;
    signOut(): Promise<void>;
    uploadToAppData(name: string, blob: Blob, mimeType: string): Promise<DriveUploadResult>;
    listAppDataFiles(prefix: string): Promise<Array<{ id: string; name: string; modifiedTime?: string }>>;
    listBackups(prefix?: string): Promise<Array<{ id: string; name: string; modifiedTime?: string; size?: number }>>;
    downloadFile(fileId: string): Promise<Blob>;
    getUserInfo(): Promise<DriveUser>;
}

export interface DriveUser {
    displayName: string;
    emailAddress: string;
    photoLink: string;
}

declare global {
    interface Window {
        google: any;
    }
}

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

class GoogleDriveClient implements DriveClient {
    private tokenClient: any;
    private clientId: string | undefined;

    constructor() {
        this.clientId = getGoogleClientId();
    }

    private async ensureGisReady(timeoutMs = 8000): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (typeof window !== 'undefined' && window.google && window.google.accounts && window.google.accounts.oauth2) {
                return;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        throw new Error('GIS_NOT_READY');
    }

    private initTokenClient() {
        if (!hasGoogleClientId()) {
            throw new Error('GOOGLE_CLIENT_ID_MISSING');
        }
        const clientId = getGoogleClientId();

        try {
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: (tokenResponse: any) => {
                    if (tokenResponse.access_token) {
                        tokenManager.setToken(tokenResponse.access_token, tokenResponse.expires_in);
                    }
                },
            });
        } catch (e) {
            console.error("Failed to init token client", e);
            throw e;
        }
    }

    isAuthenticated(): boolean {
        return !!tokenManager.getToken();
    }

    async signIn(): Promise<void> {
        if (!hasGoogleClientId()) {
            throw new Error('GOOGLE_CLIENT_ID_MISSING');
        }

        try {
            await this.ensureGisReady();
        } catch (e) {
            throw new Error('GIS_NOT_READY');
        }

        // Lazy initialization
        if (!this.tokenClient) {
            this.initTokenClient();
        }

        return new Promise((resolve, reject) => {
            try {
                // We use a transient wrapper approach or just rely on the fact that 
                // initTokenClient's callback updates the tokenManager.
                // But to make this specific call awaitable, we ideally need to know when THAT specific auth flow finished.
                // The GIS API 'callback' is global for that client instance.

                // A workaround to make it awaitable is to use a one-off client for this request 
                // OR wrap the callback.

                // Let's force a new client init for this interaction to capture the callback cleanly.
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: this.clientId,
                    scope: SCOPES,
                    callback: (resp: any) => {
                        if (resp.error) {
                            reject(new Error(resp.error.message || resp.error));
                            return;
                        }
                        if (resp.access_token) {
                            tokenManager.setToken(resp.access_token, resp.expires_in);
                            resolve();
                        }
                    },
                });

                client.requestAccessToken({ prompt: '' });

            } catch (err) {
                reject(err);
            }
        });
    }

    async signOut(): Promise<void> {
        const token = tokenManager.getToken();
        tokenManager.clear();
        if (token && window.google) {
            window.google.accounts.oauth2.revoke(token, () => { });
        }
    }

    private async fetchWithAuth(url: string, options: RequestInit = {}) {
        const token = tokenManager.getToken();
        if (!token) throw new Error("Not authenticated");

        const headers = new Headers(options.headers || {});
        headers.set('Authorization', `Bearer ${token}`);

        const res = await fetch(url, { ...options, headers });

        if (res.status === 401) {
            tokenManager.clear();
            throw new Error("Token expired or unauthorized (401)");
        }

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Drive API Error: ${res.status} - ${errBody}`);
        }

        return res;
    }

    async uploadToAppData(name: string, blob: Blob, mimeType: string): Promise<DriveUploadResult> {
        const metadata = {
            name,
            parents: ['appDataFolder'],
            mimeType
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const res = await this.fetchWithAuth(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
            {
                method: 'POST',
                body: form
            }
        );

        const data = await res.json();
        return { fileId: data.id, name: data.name };
    }

    async listAppDataFiles(prefix: string): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
        const query = `name contains '${prefix}' and trashed = false`;
        const params = new URLSearchParams({
            spaces: 'appDataFolder',
            q: query,
            fields: 'files(id,name,modifiedTime,size)',
            orderBy: 'modifiedTime desc'
        });

        const res = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files?${params}`);
        const data = await res.json();
        return data.files || [];
    }

    async listBackups(prefix?: string): Promise<Array<{ id: string; name: string; modifiedTime?: string; size?: number }>> {
        // Support V1 (backup_full) and V2 (manifest)
        // If prefix provided (e.g., 'evoapp_raquel'), filter by it.
        // Default prefix usually 'evoapp'.
        const nameFilter = prefix ? prefix : 'evoapp';

        // Match both manifesto and backup files for robustness, but V2 revolves around manifest.
        // "name contains '${nameFilter}_manifest_' or name contains '${nameFilter}_backup_full_'"
        const query = `(name contains '${nameFilter}_manifest_' or name contains '${nameFilter}_backup_full_') and trashed = false`;

        const params = new URLSearchParams({
            spaces: 'appDataFolder',
            q: query,
            fields: 'files(id,name,modifiedTime,size)',
            orderBy: 'modifiedTime desc'
        });

        const res = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files?${params}`);
        const data = await res.json();

        return (data.files || []).map((f: any) => ({
            ...f,
            size: f.size ? parseInt(f.size, 10) : 0
        }));
    }

    async downloadFile(fileId: string): Promise<Blob> {
        const res = await this.fetchWithAuth(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { method: 'GET' }
        );
        return await res.blob();
    }

    async getUserInfo(): Promise<DriveUser> {
        const res = await this.fetchWithAuth(
            `https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink)`,
            { method: 'GET' }
        );
        const data = await res.json();

        // Data format is { user: { displayName, ... } }
        if (!data.user) {
            throw new Error("No user info found in response");
        }

        return {
            displayName: data.user.displayName,
            emailAddress: data.user.emailAddress,
            photoLink: data.user.photoLink
        };
    }
}

export const driveClient = new GoogleDriveClient();
