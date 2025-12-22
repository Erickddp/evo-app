import { evoEvents } from '../../../core/events';

export type SaveReason = 'manual' | 'autosave-idle' | 'autosave-blur' | 'switch-profile';

interface AutosaveParams {
    enabled: boolean;
    isDirty: () => boolean;
    isSaving: () => boolean;
    isAuthenticated: () => boolean;
    isOnline: () => boolean;
    saveNow: (opts: { reason: SaveReason }) => Promise<void>;
    getLastSavedAt: () => number | null; // Timestamp
    onLog?: (msg: string) => void;
}

export function setupAutosave(params: AutosaveParams): () => void {
    const { enabled, isDirty, isSaving, isAuthenticated, isOnline, saveNow, getLastSavedAt, onLog } = params;

    if (!enabled) return () => { };

    let idleTimeout: any = null;
    const IDLE_DELAY_MS = 8000; // 8 seconds
    const THROTTLE_MS = 60000; // 60 seconds

    const log = (msg: string) => onLog && onLog(`[SYNC_DIAG] [Autosave] ${msg}`);

    let warnedNotAuth = false;

    const attemptAutosave = async (reason: SaveReason) => {
        // Validation Barriers
        if (!isDirty()) {
            return;
        }
        if (isSaving()) {
            log('Skipping: already saving');
            return;
        }
        if (!isAuthenticated()) {
            if (!warnedNotAuth) {
                log('Skipping: not authenticated (will not log again)');
                warnedNotAuth = true;
            }
            return;
        }
        // Reset warning if auth succeeds (or we passed check) - actually we are here means authenticated
        warnedNotAuth = false;

        if (!isOnline()) {
            log('Skipping: offline');
            return;
        }

        // Throttle Check
        const lastSaved = getLastSavedAt();
        const now = Date.now();

        if (lastSaved && (now - lastSaved < THROTTLE_MS)) {
            log(`Skipping: throttled (last save ${(now - lastSaved) / 1000}s ago)`);
            return;
        }

        try {
            log(`Triggering autosave (${reason})...`);
            await saveNow({ reason });
        } catch (e) {
            console.error('[Autosave] Failed', e);
        }
    };

    // 1. Data Changed Listener (Reset Idle Timer)
    const handleDataChanged = () => {
        if (idleTimeout) clearTimeout(idleTimeout);

        // We don't check isDirty here because data:changed implies dirty-ness typically,
        // but we rely on the attemptAutosave check for the execution phase.
        // Actually, we should trigger the timer only if dirty.
        // SyncProvider marks dirty on this event too.

        idleTimeout = setTimeout(() => {
            attemptAutosave('autosave-idle');
        }, IDLE_DELAY_MS);
    };

    // 2. Blur / Visibility Listeners (Immediate attempt)
    const handleBlur = () => {
        attemptAutosave('autosave-blur');
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            handleBlur();
        }
    };

    evoEvents.on('data:changed', handleDataChanged);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    log('Engine started.');

    // Cleanup function
    return () => {
        if (idleTimeout) clearTimeout(idleTimeout);
        evoEvents.off('data:changed', handleDataChanged);
        window.removeEventListener('blur', handleBlur);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        log('Engine stopped.');
    };
}
