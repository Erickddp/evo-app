import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { evoEvents } from '../../../core/events';
import { driveClient } from './drive/driveClient';
import { buildBackupV2 } from './backupSerializer';
import { restoreFromBackupFile, type RestoreProgress } from './restoreEngine';
import { RestoreModal } from './RestoreModal';
import { useProfile } from '../profiles/ProfileProvider';
import { setupAutosave, type SaveReason } from './autosaveEngine';

type SaveStatus = 'ok' | 'error' | undefined;

// Re-import helper from refined config
import { getGoogleClientIdMasked, hasGoogleClientId } from './drive/driveConfig';

export type DriveStatus = 'disconnected' | 'connected' | 'error' | 'missing-config' | 'loading';

interface SyncContextValue {
    isDirty: boolean;
    isSaving: boolean;
    lastSavedAt?: string;
    lastSaveStatus?: SaveStatus;
    lastError?: string;
    saveNow: (opts?: { reason?: SaveReason }) => Promise<void>;
    markDirty: (reason?: string) => void;
    markClean: () => void;
    isDriveConnected: boolean;
    driveStatus: DriveStatus;
    driveError?: string;
    connectDrive: () => Promise<void>;
    // Restore
    openRestore: () => void;
    isRestoring: boolean;
    restoreProgress?: RestoreProgress;
    // Debug / Settings API
    refreshBackups: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Save State
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
    const [lastSaveStatus, setLastSaveStatus] = useState<SaveStatus>();
    const [lastError, setLastError] = useState<string | undefined>();


    // Auth State
    const [isDriveConnected, setIsDriveConnected] = useState(false);
    // Initialize status based on whether we have a token AND config
    const [driveStatus, setDriveStatus] = useState<DriveStatus>('disconnected');
    const [driveError, setDriveError] = useState<string | undefined>();

    // Restore State
    const [isRestoreOpen, setIsRestoreOpen] = useState(false);
    const [backups, setBackups] = useState<any[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [errorBackups, setErrorBackups] = useState<string>();
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreProgress, setRestoreProgress] = useState<RestoreProgress>();
    const [restoreError, setRestoreError] = useState<string>();

    const restoreAbortController = useRef<AbortController | null>(null);

    // Profile Context (we are inside ProfileProvider now)
    const { activeProfile } = useProfile();

    // Refs for Autosave Engine (to access latest state without re-running effect)
    const stateRef = useRef({
        isDirty,
        isSaving,
        isDriveConnected,
        lastSavedAt
    });

    useEffect(() => {
        stateRef.current = { isDirty, isSaving, isDriveConnected, lastSavedAt };
    }, [isDirty, isSaving, isDriveConnected, lastSavedAt]);

    const markDirty = useCallback(() => setIsDirty(true), []);
    const markClean = useCallback(() => setIsDirty(false), []);

    // Initialization Effect
    const warnedMissingConfigRef = useRef(false);

    useEffect(() => {
        const masked = getGoogleClientIdMasked();
        const hasConfig = hasGoogleClientId();

        // Diagnostic log (once)
        if (import.meta.env.DEV) {
            console.log(`[DRIVE] client id present: ${hasConfig} (ID: ${masked})`);
        }

        if (!hasConfig) {
            setDriveStatus('missing-config');
            if (!warnedMissingConfigRef.current) {
                console.warn(`[DRIVE] VITE_GOOGLE_CLIENT_ID missing (ID: ${masked}) - this warning is shown only once`);
                warnedMissingConfigRef.current = true;
            }
            // We set error but we don't spam console
            setDriveError('Falta configurar VITE_GOOGLE_CLIENT_ID');
        } else {
            if (import.meta.env.DEV) {
                console.info('[DRIVE] client_id loaded:', masked);
            }
            // Check if already authenticated via tokenManager
            if (driveClient.isAuthenticated()) {
                setIsDriveConnected(true);
                setDriveStatus('connected');
            } else {
                setDriveStatus('disconnected');
            }
        }
    }, []);

    const connectDrive = useCallback(async () => {
        if (!hasGoogleClientId()) {
            setDriveStatus('missing-config');
            return;
        }

        setDriveStatus('loading');
        setDriveError(undefined);

        try {
            await driveClient.signIn();
            setIsDriveConnected(true);
            setDriveStatus('connected');
        } catch (err: any) {
            console.error("Connect failed", err);
            const msg = err.message || "Error al conectar Google Drive";

            if (msg === 'GOOGLE_CLIENT_ID_MISSING' || msg.includes('missing')) {
                setDriveError('Falta configurar VITE_GOOGLE_CLIENT_ID');
                setDriveStatus('missing-config');
            } else if (msg === 'GIS_NOT_READY') {
                setDriveError('Google Services no cargó. Recarga la página.');
                setDriveStatus('error');
            } else {
                setLastError(msg);
                setDriveError(msg);
                setDriveStatus('error');
            }
        }
    }, []);

    const refreshBackups = useCallback(async () => {
        if (!driveClient.isAuthenticated()) return;
        setLoadingBackups(true);
        setErrorBackups(undefined);
        try {
            console.info('[SYNC] Listing backups for prefix:', activeProfile.drivePrefix);
            const list = await driveClient.listBackups(activeProfile.drivePrefix);
            setBackups(list);
        } catch (err: any) {
            console.error("List backups failed", err);
            setErrorBackups(err.message || "Error al listar backups");
        } finally {
            setLoadingBackups(false);
        }
    }, [activeProfile]);

    // --- Save Logic ---
    const saveNow = useCallback(async (opts?: { reason?: SaveReason }) => {
        const reason = opts?.reason || 'manual';

        // 1. Check Offline
        if (!navigator.onLine) {
            console.warn(`[SYNC] Save requested (${reason}) but offline. Keeping dirty.`);
            setLastError("Sin conexión. Pendiente.");
            setLastSaveStatus('error');
            return;
        }

        // 2. Check Auth
        if (!driveClient.isAuthenticated()) {
            setLastError("No conectado a Drive");
            return;
        }

        // 3. Check Collision
        if (stateRef.current.isSaving) {
            console.log(`[SYNC] Already saving. Ignoring ${reason} request.`);
            return;
        }

        setIsSaving(true);
        setLastSaveStatus(undefined);
        setLastError(undefined);

        try {
            console.info(`[SYNC] Saving... Reason: ${reason}, Prefix: ${activeProfile.drivePrefix}`);
            const { files } = await buildBackupV2(activeProfile);

            for (const file of files) {
                await driveClient.uploadToAppData(file.name, file.blob, 'application/json');
            }

            setLastSavedAt(new Date().toISOString());
            setLastSaveStatus('ok');
            setIsDirty(false);

            if (reason === 'autosave-idle' || reason === 'autosave-blur') {
                console.info('[SYNC] Autosave completed.');
            }

        } catch (err: any) {
            console.error("Save failed", err);
            setLastSaveStatus('error');
            setLastError(err.message || "Error al guardar en Drive");

            if (err.message && err.message.includes('401')) {
                setIsDriveConnected(false);
            }
        } finally {
            setIsSaving(false);
        }
    }, [activeProfile]); // Stable dependency on activeProfile

    // --- Autosave Setup ---
    // We use a ref for saveNow to pass to engine, although saveNow is stable-ish (depends on activeProfile).
    const saveNowRef = useRef(saveNow);
    useEffect(() => { saveNowRef.current = saveNow; }, [saveNow]);

    useEffect(() => {
        console.log('[SYNC] Initializing Autosave Engine');
        const cleanup = setupAutosave({
            enabled: true,
            isDirty: () => stateRef.current.isDirty,
            isSaving: () => stateRef.current.isSaving,
            isAuthenticated: () => stateRef.current.isDriveConnected,
            isOnline: () => navigator.onLine,
            saveNow: (opts) => saveNowRef.current(opts),
            getLastSavedAt: () => stateRef.current.lastSavedAt ? new Date(stateRef.current.lastSavedAt).getTime() : null,
            onLog: (msg) => console.log(msg)
        });
        return cleanup;
    }, []); // Run ONCE on mount. The engine uses refs/callbacks to get fresh state.

    // --- Restore Logic ---
    const openRestore = useCallback(() => {
        console.log("Opening restore modal...", isDriveConnected);
        if (!isDriveConnected) {
            alert("Conecta Google Drive primero para restaurar.");
            return;
        }
        setIsRestoreOpen(true);
        refreshBackups();
    }, [isDriveConnected, refreshBackups]);


    const handleRestore = async (file: any) => {
        if (isRestoring) return;
        if (!confirm(`¿Restaurar desde "${file.name}"?\nSe reemplazarán los datos locales actuales.`)) {
            return;
        }

        setIsRestoring(true);
        setRestoreError(undefined);
        setRestoreProgress({ phase: 'downloading', percent: 0, message: 'Iniciando...' });

        restoreAbortController.current = new AbortController();

        try {
            await restoreFromBackupFile({
                drive: driveClient,
                fileId: file.id,
                onProgress: (p) => setRestoreProgress(p),
                signal: restoreAbortController.current.signal
            });

            // Success
            markClean();
            setIsRestoreOpen(false);
            setLastSavedAt(new Date().toISOString());
            setLastSaveStatus('ok');
            setLastSaveStatus(undefined);

        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setRestoreError(err.message || "Error desconocido al restaurar");
        } finally {
            setIsRestoring(false);
            restoreAbortController.current = null;
        }
    };

    const cancelRestore = () => {
        if (restoreAbortController.current) {
            restoreAbortController.current.abort();
        }
        setIsRestoring(false);
    };

    // --- Effects ---

    // Data Bus
    useEffect(() => {
        const handleDataChange = () => markDirty();
        evoEvents.on('data:changed', handleDataChange);
        return () => evoEvents.off('data:changed', handleDataChange);
    }, [markDirty]);

    // Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+G: Save
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (isDirty && !isSaving && isDriveConnected) {
                    saveNow({ reason: 'manual' });
                }
            }
            // Ctrl+O: Open
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                if (isDriveConnected && !isRestoreOpen) {
                    openRestore();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDirty, isSaving, saveNow, isDriveConnected, isRestoreOpen, openRestore]);

    // Before Unload
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    return (
        <SyncContext.Provider value={{
            isDirty,
            isSaving,
            lastSavedAt,
            lastSaveStatus,
            lastError,
            saveNow,
            markDirty,
            markClean,
            isDriveConnected,
            driveStatus,
            driveError,
            connectDrive,
            // Restore
            openRestore,
            isRestoring,
            restoreProgress,
            refreshBackups
        }}>
            {children}

            <RestoreModal
                open={isRestoreOpen}
                onClose={() => !isRestoring && setIsRestoreOpen(false)}
                onRestore={handleRestore}
                backups={backups}
                loadingBackups={loadingBackups}
                errorBackups={errorBackups}
                refreshBackups={refreshBackups}
                isRestoring={isRestoring}
                restoreProgress={restoreProgress}
                restoreError={restoreError}
                onCancelRestore={cancelRestore}
            />
        </SyncContext.Provider>
    );
};

export const useSync = () => {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error("useSync must be used within SyncProvider");
    }
    return context;
};
