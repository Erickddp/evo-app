import type { LibraryManifest } from '../types';

const BASE_URL = import.meta.env.VITE_LIBRARY_BASE_URL ?? '';

export const libraryService = {
    async fetchManifest(): Promise<LibraryManifest> {
        const cacheKey = 'evo-library-manifest';
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) {
            try {
                return JSON.parse(cached);
            } catch {
                sessionStorage.removeItem(cacheKey);
            }
        }

        try {
            // Construct URL: if BASE_URL is present, use it; otherwise default to local public folder
            const baseUrl = BASE_URL ? BASE_URL.replace(/\/$/, '') : '/library-data';
            const targetUrl = `${baseUrl}/manifest.json`;
            const response = await fetch(targetUrl);

            const contentType = response.headers.get('content-type');
            if (!response.ok) {
                throw new Error(`Failed to load manifest: ${response.status} ${response.statusText}`);
            }
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Manifest no es JSON, revisa URL (posible redirección a index.html)');
            }

            const data = await response.json();
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
            return data;
        } catch (error) {
            console.error('Library manifest fetch failed:', error);
            throw error;
        }
    },

    async fetchDocument(url: string): Promise<string> {
        // Determine full URL
        const baseUrl = BASE_URL ? BASE_URL.replace(/\/$/, '') : '/library-data';

        const fullUrl = url.startsWith('http')
            ? url
            : `${baseUrl}/${url.replace(/^\//, '')}`;

        const cacheKey = `evo-library-doc-${url}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) return cached;

        try {
            const response = await fetch(fullUrl);

            if (!response.ok) {
                throw new Error(`Failed to load document: ${response.status} ${response.statusText}`);
            }

            const text = await response.text();

            // Only cache text-based content valid for sessionStorage
            // Avoid quotas exceeded issues with a simple length check (e.g., < 1MB)
            if (text.length < 1024 * 1024) {
                sessionStorage.setItem(cacheKey, text);
            }

            return text;
        } catch (error) {
            console.error('Library document fetch failed:', error);
            throw error;
        }
    }
};
