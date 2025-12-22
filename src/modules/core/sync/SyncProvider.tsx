import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { evoEvents } from '../../../core/events';
import { driveClient, type DriveUser } from './drive/driveClient';
import { tokenManager } from './drive/tokenManager';
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
    driveUser?: DriveUser;
    connectDrive: () => Promise<void>;
    // Restore
    openRestore: () => void;
    isRestoring: boolean;
    restoreProgress?: RestoreProgress;
    // Debug / Settings API
    updateAccountStatus: () => Promise<void>;
    refreshBackups: () => Promise<void>;
    lastUserRefreshAt?: number;
    // Smart Sync
    checkForUpdates: () => Promise<void>;
    remoteUpdateAvailable: { id: string; date: Date } | null;
    resolveRemoteUpdate: (action: 'pull' | 'push') => Promise<void>;
}

// Persistence Helpers
const SESSION_KEYS = {
    localTs: (pid: string) => `evoapp:lastLocalBackupTs:${pid}`,
    dirty: (pid: string) => `evoapp:dirty:${pid}`
};

const getLocalTs = (pid: string) => {
    const val = localStorage.getItem(SESSION_KEYS.localTs(pid));
    return val ? parseInt(val, 10) : 0;
};
const setLocalTs = (pid: string, ts: number) => {
    localStorage.setItem(SESSION_KEYS.localTs(pid), ts.toString());
};
const getDirtyFlag = (pid: string) => {
    return localStorage.getItem(SESSION_KEYS.dirty(pid)) === 'true';
};
const setDirtyFlag = (pid: string, isDirty: boolean) => {
    localStorage.setItem(SESSION_KEYS.dirty(pid), isDirty ? 'true' : 'false');
};

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
    const [driveUser, setDriveUser] = useState<DriveUser | undefined>();
    const [lastUserRefreshAt, setLastUserRefreshAt] = useState<number | undefined>();
    const [remoteUpdateAvailable, setRemoteUpdateAvailable] = useState<{ id: string; date: Date } | null>(null);

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

    const markDirty = useCallback(() => {
        setIsDirty(true);
        if (activeProfile?.id) setDirtyFlag(activeProfile.id, true);
    }, [activeProfile?.id]);

    const markClean = useCallback(() => {
        setIsDirty(false);
        if (activeProfile?.id) setDirtyFlag(activeProfile.id, false);
    }, [activeProfile?.id]);

    // Helper to fetch user info
    const fetchDriveUser = useCallback(async () => {
        try {
            const user = await driveClient.getUserInfo();
            setDriveUser(user);
            setLastUserRefreshAt(Date.now());
        } catch (e: any) {
            if (e.message && e.message.includes('401')) {
                tokenManager.clear();
                setIsDriveConnected(false);
                setDriveStatus('disconnected');
            }
            console.error("Failed to fetch drive user info", e);
        }
    }, []);

    // Initialization Effect
    const warnedMissingConfigRef = useRef(false);

    useEffect(() => {
        const masked = getGoogleClientIdMasked();
        const hasConfig = hasGoogleClientId();

        // Diagnostic log (once)
        if (import.meta.env.DEV) {
            console.log(`[SYNC_DIAG] Init SyncProvider. ClientID present: ${hasConfig} (ID: ${masked})`);
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
        }
        // Check if already authenticated via tokenManager
        if (driveClient.isAuthenticated()) {
            console.log('[SYNC_DIAG] Auto-detected existing session.');
            setIsDriveConnected(true);
            setDriveStatus('connected');
            fetchDriveUser();
            // We will check for updates in a separate effect or here
        } else {
            setDriveStatus('disconnected');
        }
    }, [fetchDriveUser]);

    // Smart Sync Check Logic
    const checkForUpdates = useCallback(async () => {
        if (!driveClient.isAuthenticated() || !activeProfile?.id) return;

        try {
            const meta = await driveClient.getLatestBackupMeta(activeProfile.drivePrefix);
            if (!meta) return;

            const remoteTs = new Date(meta.modifiedTime).getTime();
            const localTs = getLocalTs(activeProfile.id);
            const isDirtyLocal = getDirtyFlag(activeProfile.id); // Check LS directly for truth

            console.log(`[SYNC_DIAG] Smart Check. Remote: ${remoteTs}, Local: ${localTs}, Dirty: ${isDirtyLocal}`);

            // Threshold: Remote must be > Local by at least 1 second to count as newer
            if (remoteTs > localTs + 1000) {
                if (!isDirtyLocal) {
                    // Safe to Auto-Restore
                    console.log('[SYNC_DIAG] Auto-restoring newer remote version (Clean local state)...');
                    await restoreFromBackupFile({
                        drive: driveClient,
                        fileId: meta.id,
                        onProgress: (p) => console.log(`[SYNC_DIAG] Auto-Restore: ${p.percent}% ${p.phase}`),
                    });
                    // Update local TS to match remote to prevent loop
                    setLocalTs(activeProfile.id, remoteTs);
                    setDirtyFlag(activeProfile.id, false);
                    setIsDirty(false);
                    setRemoteUpdateAvailable(null);
                    // Reload Window to reflect changes safely? Or just trust React State updates? 
                    // RestoreEngine updates Stores, which emit events. React components should update.
                    // A force reload is sometimes safer but disruptive. Let's rely on Store events.
                    window.location.reload(); // Hard refresh to ensure clean state
                } else {
                    // Conflict / Unsaved Work: Show Banner
                    console.log('[SYNC_DIAG] Remote is newer but Local is Dirty. Showing Banner.');
                    setRemoteUpdateAvailable({ id: meta.id, date: new Date(meta.modifiedTime) });
                }
            } else {
                setRemoteUpdateAvailable(null);
            }

        } catch (e) {
            console.error('[SYNC_DIAG] Check updates failed', e);
        }
    }, [activeProfile]);

    // Periodic Check & Init Check
    useEffect(() => {
        if (isDriveConnected && activeProfile?.id) {
            checkForUpdates();
            const interval = setInterval(checkForUpdates, 90000); // 90s
            return () => clearInterval(interval);
        }
    }, [isDriveConnected, activeProfile?.id, checkForUpdates]);

    const connectDrive = useCallback(async () => {
        if (!hasGoogleClientId()) {
            setDriveStatus('missing-config');
            return;
        }

        setDriveStatus('loading');
        setDriveError(undefined);

        try {
            console.log('[SYNC_DIAG] Connecting Drive...');
            await driveClient.signIn();
            console.log('[SYNC_DIAG] Drive Connected Successfully');
            setIsDriveConnected(true);
            setDriveStatus('connected');
            fetchDriveUser();
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
    }, [fetchDriveUser]);

    const refreshBackups = useCallback(async () => {
        if (!driveClient.isAuthenticated()) return;
        console.log('[SYNC_DIAG] Refreshing backups list...');
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
            console.info(`[SYNC_DIAG] Saving... Reason: ${reason}, Prefix: ${activeProfile.drivePrefix}`);
            const { files } = await buildBackupV2(activeProfile);

            for (const file of files) {
                console.log(`[SYNC_DIAG] Uploading chunk: ${file.name}`);
                await driveClient.uploadToAppData(file.name, file.blob, 'application/json');
            }

            const nowTs = Date.now();
            setLastSavedAt(new Date(nowTs).toISOString());
            setLastSaveStatus('ok');
            setIsDirty(false);
            setDirtyFlag(activeProfile.id, false);
            setLocalTs(activeProfile.id, nowTs);
            // also clear banner if we just overwrote remote (remote logic dictates we are now latest)
            setRemoteUpdateAvailable(null);

            if (reason === 'autosave-idle' || reason === 'autosave-blur') {
                console.info('[SYNC] Autosave completed.');
            }

        } catch (err: any) {
            console.error("[SYNC_DIAG] Save failed", err);
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

        // Visibility & Unload Helpers (Safety Net)
        const handleVisibilityDetails = () => {
            if (document.visibilityState === 'hidden' && stateRef.current.isDirty && stateRef.current.isDriveConnected) {
                console.log('[SYNC_DIAG] Tab hidden + Dirty -> Forcing Save');
                saveNowRef.current({ reason: 'autosave-blur' });
            }
        };
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (stateRef.current.isDirty && stateRef.current.isDriveConnected) {
                // Try to fire one last shot (best effor, fetch keepalive not guaranteed in complex async)
                // Just triggering saveNow here might not finish.
                // We rely on visibilityChange mostly.
                e.preventDefault();
                e.returnValue = 'Tienes cambios sin guardar. ¿Salir?';
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityDetails);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            cleanup();
            document.removeEventListener('visibilitychange', handleVisibilityDetails);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []); // Run ONCE on mount. The engine uses refs/callbacks to get fresh state.

    // --- Restore Logic ---
    const openRestore = useCallback(() => {
        console.log("[SYNC_DIAG] Opening restore modal. Connected:", isDriveConnected);
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
            console.log(`[SYNC_DIAG] Starting restore from file: ${file.id}`);
            await restoreFromBackupFile({
                drive: driveClient,
                fileId: file.id,
                onProgress: (p) => setRestoreProgress(p),
                signal: restoreAbortController.current.signal
            });

            // Success
            markClean();
            setIsRestoreOpen(false);
            const nowTs = Date.now();
            setLastSavedAt(new Date(nowTs).toISOString());
            setLocalTs(activeProfile.id, nowTs); // We are now consistent with "latest" locally
            setRemoteUpdateAvailable(null);
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

    const resolveRemoteUpdate = async (action: 'pull' | 'push') => {
        if (!remoteUpdateAvailable) return;

        if (action === 'pull') {
            try {
                // Manual trigger of auto-restore logic
                setIsRestoring(true);
                await restoreFromBackupFile({
                    drive: driveClient,
                    fileId: remoteUpdateAvailable.id,
                    onProgress: (p) => setRestoreProgress(p),
                });
                setLocalTs(activeProfile.id, remoteUpdateAvailable.date.getTime());
                setDirtyFlag(activeProfile.id, false);
                setIsDirty(false);
                setRemoteUpdateAvailable(null);
                window.location.reload();
            } catch (e: any) {
                setRestoreError(e.message);
                setIsRestoring(false);
            }
        } else {
            // Push: We overwrite remote. Just trigger save.
            await saveNow({ reason: 'manual' });
            // saveNow updates localTs and clears dirty, clearing the conflict state
            setRemoteUpdateAvailable(null);
        }
    };

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
            driveUser,
            connectDrive,
            updateAccountStatus: fetchDriveUser,
            lastUserRefreshAt,
            // Restore
            openRestore,
            isRestoring,
            restoreProgress,
            refreshBackups,
            checkForUpdates,
            remoteUpdateAvailable,
            resolveRemoteUpdate
        }}>
            {remoteUpdateAvailable && (
                <div style={{
                    position: 'fixed',
                    bottom: 20,
                    right: 20,
                    zIndex: 9999,
                    background: '#1e293b',
                    color: 'white',
                    padding: '16px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #3b82f6',
                    maxWidth: '300px'
                }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>Conflicto de Sincronización</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px', opacity: 0.9 }}>
                        Hay una versión más nueva en Drive ({remoteUpdateAvailable.date.toLocaleTimeString()}).
                        Tienes cambios locales sin guardar.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => resolveRemoteUpdate('pull')}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            Bajar Remoto
                        </button>
                        <button
                            onClick={() => resolveRemoteUpdate('push')}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                background: 'transparent',
                                border: '1px solid #475569',
                                color: '#e2e8f0',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            Mantener Local
                        </button>
                    </div>
                </div>
            )}
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
