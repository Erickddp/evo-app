// import { journeyStore } from './JourneyStore'; // Removed dependency
import { isTaxEngineEnabled } from '../../../config/flags';
import type { JourneyState, JourneyStep } from '../../../core/evoappDataModel';
import type { DashboardDataSnapshot } from '../data-provider/types';
import type { EvoProfile } from '../profiles/profileTypes';

export const journeyEngine = {
    /**
     * Pure function to compute the derived state of the journey based on data snapshot.
     * Does NOT persist changes.
     */
    computeDerivedState(currentState: JourneyState, snapshot: DashboardDataSnapshot, profile: EvoProfile): JourneyState {
        return this.evaluateState(currentState, snapshot, profile);
    },

    evaluateState(currentState: JourneyState, snapshot: DashboardDataSnapshot, profile: EvoProfile): JourneyState {
        const steps: JourneyStep[] = JSON.parse(JSON.stringify(currentState.steps));
        const { stats, taxSummary } = snapshot;
        // ... rest of logic remains the same, assuming it's pure

        // Helper
        const setStatus = (id: string, status: JourneyStep['status']) => {
            const idx = steps.findIndex(s => s.id === id);
            if (idx >= 0) steps[idx].status = status;
        };

        // 1. Select Month - Always Done
        setStatus('select-month', 'done');

        // 2. Imports
        const bankDone = stats.sourcesCount.bank > 0;
        const cfdiDone = stats.sourcesCount.cfdi > 0;
        setStatus('import-bank', bankDone ? 'done' : 'pending');
        setStatus('import-cfdi', cfdiDone ? 'done' : 'pending');

        // 3. Classify
        const hasRecords = stats.recordsCount > 0;
        const fullyClassified = stats.unknownClassificationsCount === 0;
        const classifyDone = hasRecords && fullyClassified;
        setStatus('classify', classifyDone ? 'done' : 'pending');

        // 4. Reconcile
        // 4. Reconcile
        // Done if we have bank records AND invoice records AND pending count is 0
        const hasBank = stats.sourcesCount.bank > 0;
        const hasCfdi = stats.sourcesCount.cfdi > 0;
        const allReconciled = stats.reconcilePendingCount === 0;
        const reconcileDone = hasBank && hasCfdi && allReconciled;

        setStatus('reconcile', reconcileDone ? 'done' : 'pending');

        // 5. Fiscal Preview
        const taxEnabled = isTaxEngineEnabled(profile);
        if (!taxEnabled) {
            setStatus('fiscal-preview', 'blocked');
        } else {
            const taxDone = !!taxSummary && taxSummary.confidence > 0;
            setStatus('fiscal-preview', taxDone ? 'done' : 'pending');
        }

        // 6. Backup - Manual
        // IMPORTANT: We preserve manual status from currentState for Backup if it was explicitly done?
        // Current logic in previous file: "setStatus('backup', 'pending');" -> This overrides any saved 'done'.
        // To support "Mark as done", we should check if it was already DONE in currentState and preserve it unless we want to force re-check.
        // For Backup, it's an action. If done, it stays done? Or resets on data change? 
        // Ideally resets if data changes significantly, but for V1 let's assume manual toggle.
        // But the previous logic OVERWROTE it to pending. 
        // I will change logic: If currentState has backup as done, keep it done?
        // But `steps` is cloned from `currentState`, so it starts with current status.
        // `setStatus` overwrites. 
        // So I should ONLY set status if I'm deriving it. 
        // For steps 1-5, we derive from Snapshot (source of truth).
        // For step 6 (Backup), it's manual. We should NOT overwrite it with 'pending' if it is 'done'.

        // FIX: Remove generic overwrite for Backup.
        // But wait, step 6 logic above: "setStatus('backup', 'pending');".
        // I should remove that line to respect persistence.

        // --- DEPENDENCY LOGIC ---
        // (This logic might un-block things, but shouldn't un-done things?)

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];

            // Don't auto-block 'select-month' (idx 0)
            if (step.id === 'select-month') continue;

            if (step.blockedBy && step.blockedBy.length > 0) {
                const blockers = steps.filter(s => step.blockedBy!.includes(s.id));
                const allBlockersDone = blockers.every(b => b.status === 'done');

                if (!allBlockersDone) {
                    step.status = 'blocked';
                } else {
                    // Blockers Done.
                    if (step.status === 'blocked') {
                        // Unblock
                        if (step.id === 'fiscal-preview' && !taxEnabled) {
                            // keep blocked
                        } else {
                            step.status = 'pending';
                        }
                    }
                }
            }
        }

        return {
            ...currentState,
            steps,
            updatedAt: new Date().toISOString()
        };
    },

    getNextAction(journey: JourneyState): JourneyStep | null {
        return journey.steps.find(s => s.status === 'pending') || null;
    }
};
