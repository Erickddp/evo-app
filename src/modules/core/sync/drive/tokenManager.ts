export class TokenManager {
    private accessToken: string | null = null;
    private expiresAt: number = 0; // epoch ms
    private readonly STORAGE_KEY_TOKEN = 'evoapp_google_access_token';
    private readonly STORAGE_KEY_EXPIRES = 'evoapp_google_expires_at';

    constructor() {
        this.loadFromStorage();
    }

    setToken(token: string, expiresInSec: number) {
        this.accessToken = token;
        // Calculate expiration time (safety margin: 60s)
        this.expiresAt = Date.now() + (expiresInSec * 1000) - 60000;

        localStorage.setItem(this.STORAGE_KEY_TOKEN, token);
        localStorage.setItem(this.STORAGE_KEY_EXPIRES, this.expiresAt.toString());
    }

    getToken(): string | null {
        if (!this.accessToken) {
            this.loadFromStorage();
        }

        if (this.accessToken && Date.now() < this.expiresAt) {
            return this.accessToken;
        }

        return null;
    }

    clear() {
        this.accessToken = null;
        this.expiresAt = 0;
        localStorage.removeItem(this.STORAGE_KEY_TOKEN);
        localStorage.removeItem(this.STORAGE_KEY_EXPIRES);
    }

    private loadFromStorage() {
        const storedToken = localStorage.getItem(this.STORAGE_KEY_TOKEN);
        const storedExpires = localStorage.getItem(this.STORAGE_KEY_EXPIRES);

        if (storedToken && storedExpires) {
            this.accessToken = storedToken;
            this.expiresAt = parseInt(storedExpires, 10);
        }
    }
}

export const tokenManager = new TokenManager();
