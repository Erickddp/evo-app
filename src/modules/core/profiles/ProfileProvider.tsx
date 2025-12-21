import React, { createContext, useContext, useEffect, useState } from 'react';
import type { EvoProfile } from './profileTypes';
import { profileStore } from './profileStore';
import { evoStore } from '../../../core/evoappDataStore';

interface ProfileContextValue {
    profiles: EvoProfile[];
    activeProfile: EvoProfile;
    createProfile: (name: string) => void;
    switchProfile: (profileId: string) => Promise<boolean>; // return success (might be cancelled)
    renameProfile: (profileId: string, name: string) => void;
    deleteProfile: (profileId: string) => void;
    updateProfile: (profile: EvoProfile) => void;
    // UI Helpers
    showUnsavedModal: boolean;
    pendingProfileId: string | null;
    resolvePendingSwitch: (shouldSave: boolean) => Promise<void>;
    cancelPendingSwitch: () => void;
    justCreatedProfileId: string | null;
    clearNewProfileWelcome: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const [profiles, setProfiles] = useState<EvoProfile[]>([]);
    const [activeProfile, setActiveProfile] = useState<EvoProfile>(profileStore.list()[0]);
    const [justCreatedProfileId, setJustCreatedProfileId] = useState<string | null>(null);

    // Initial Load & Migration
    useEffect(() => {
        const load = async () => {
            const list = profileStore.list();
            const activeId = profileStore.getActiveId();
            const active = list.find(p => p.id === activeId) || list[0];

            setProfiles(list);
            setActiveProfile(active);

            // Initialize DB for this profile
            await evoStore.reinitialize(active.dbPrefix);

            // Run Migration
            // This ensures every profile load checks for pending migrations
            try {
                // If we want blocking UI, we could expose an isMigrating state
                // For now, simpler integration as requested "Mostrar: loading bloqueante solo si hay migración ... mensaje..."
                // But this runs inside useEffect. We need state.
                setMigrationLoading(true);
                const { migrationService } = await import('../migrations/MigrationService');
                await migrationService.runMigration();
            } finally {
                setMigrationLoading(false);
            }
        };
        load();
    }, []);

    const [migrationLoading, setMigrationLoading] = useState(false);

    if (migrationLoading) {
        return (
            <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-50">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-indigo-600 mb-2">Preparando datos...</h2>
                    <p className="text-gray-500">Optimizando tu historial financiero.</p>
                </div>
            </div>
        );
    }

    const createProfile = (name: string) => {
        const id = crypto.randomUUID().slice(0, 8); // simplified ID
        const drivePrefix = `evoapp_${id}`; // simple safe prefix
        const dbPrefix = id;

        const newProfile: EvoProfile = {
            id,
            name,
            drivePrefix,
            dbPrefix,
            createdAt: new Date().toISOString()
        };

        profileStore.upsert(newProfile);
        setProfiles(profileStore.list());
        setJustCreatedProfileId(id);
    };

    const switchProfile = async (profileId: string): Promise<boolean> => {
        const target = profiles.find(p => p.id === profileId);
        if (!target) return false;

        if (target.id === activeProfile.id) return true;

        console.log(`Switching profile to ${target.name} (${target.id})`);

        // 1. Persist active ID
        profileStore.setActiveId(target.id);

        // 2. Switch DB
        await evoStore.reinitialize(target.dbPrefix);

        // 3. Update State
        setActiveProfile(target);

        return true;
    };

    const renameProfile = (id: string, name: string) => {
        const p = profiles.find(x => x.id === id);
        if (p) {
            const updated = { ...p, name };
            profileStore.upsert(updated);
            setProfiles(profileStore.list());
            if (activeProfile.id === id) setActiveProfile(updated);
        }
    };

    // Generic update (e.g. for fiscal settings)
    const updateProfile = (profile: EvoProfile) => {
        profileStore.upsert(profile);
        setProfiles(profileStore.list());
        if (activeProfile.id === profile.id) {
            setActiveProfile(profile);
        }
    };

    const deleteProfile = (id: string) => {
        if (id === activeProfile.id) {
            alert("No puedes borrar el perfil activo.");
            return;
        }
        if (confirm("¿Borrar perfil y sus datos locales? (No borra backups en Drive)")) {
            profileStore.remove(id);
            setProfiles(profileStore.list());
        }
    };

    return (
        <ProfileContext.Provider value={{
            profiles,
            activeProfile,
            createProfile,
            switchProfile,
            renameProfile,
            updateProfile,
            deleteProfile,
            // Deprecated/Moved to UI component logic
            showUnsavedModal: false,
            pendingProfileId: null,
            resolvePendingSwitch: async () => { },
            cancelPendingSwitch: () => { },
            // New Onboarding
            justCreatedProfileId,
            clearNewProfileWelcome: () => setJustCreatedProfileId(null)
        }}>
            {children}
        </ProfileContext.Provider>
    );
};

export const useProfile = () => {
    const ctx = useContext(ProfileContext);
    if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
    return ctx;
};
// Alias for consistency
export const useProfiles = useProfile;
