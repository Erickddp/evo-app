import type { EvoProfile } from './profileTypes';

const STORE_KEY = 'evoapp_profiles';
const ACTIVE_KEY = 'evoapp_active_profile_id';

const DEFAULT_PROFILE: EvoProfile = {
    id: 'default',
    name: 'Mi EVOAPP',
    drivePrefix: 'evoapp_default',
    dbPrefix: 'default',
    createdAt: new Date().toISOString()
};

export const profileStore = {
    list(): EvoProfile[] {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            // Ensure default exists
            if (!list.find((p: EvoProfile) => p.id === 'default')) {
                list.unshift(DEFAULT_PROFILE);
                localStorage.setItem(STORE_KEY, JSON.stringify(list));
            }
            return list;
        } catch (e) {
            return [DEFAULT_PROFILE];
        }
    },

    getActiveId(): string {
        return localStorage.getItem(ACTIVE_KEY) || 'default';
    },

    setActiveId(id: string): void {
        localStorage.setItem(ACTIVE_KEY, id);
    },

    upsert(profile: EvoProfile): void {
        const list = this.list();
        const index = list.findIndex(p => p.id === profile.id);
        if (index >= 0) {
            list[index] = profile;
        } else {
            list.push(profile);
        }
        localStorage.setItem(STORE_KEY, JSON.stringify(list));
    },

    remove(id: string): void {
        if (id === 'default') return; // Cannot delete default
        let list = this.list();
        list = list.filter(p => p.id !== id);
        localStorage.setItem(STORE_KEY, JSON.stringify(list));
    }
};
