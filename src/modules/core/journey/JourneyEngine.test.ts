import { describe, it, expect, vi } from 'vitest';
import { journeyEngine } from './JourneyEngine';
import type { JourneyState } from '../../../core/evoappDataModel';
import type { DashboardDataSnapshot } from '../data-provider/types';
import type { EvoProfile } from '../profiles/profileTypes';

// Prevent IndexedDB initialization error
vi.mock('../../../core/evoappDataStore', () => ({
    evoStore: {}
}));
vi.mock('../../../core/data/dataStore', () => ({
    dataStore: {}
}));
vi.mock('./JourneyStore', () => ({
    journeyStore: {
        get: vi.fn(),
        save: vi.fn(),
        createInitialState: vi.fn()
    }
}));

// Initial state helper (mocking what createInitialState would return)
const getInitialState = (): JourneyState => ({
    id: 'test-journey',
    journeyId: 'monthly-close',
    month: '2024-01',
    updatedAt: new Date().toISOString(),
    steps: [
        { id: 'select-month', title: 'Start', status: 'done' },
        { id: 'import-bank', title: 'Bank', status: 'pending' },
        { id: 'import-cfdi', title: 'CFDI', status: 'pending' },
        { id: 'classify', title: 'Classify', status: 'pending', blockedBy: ['import-bank', 'import-cfdi'] },
        { id: 'reconcile', title: 'Reconcile', status: 'pending', blockedBy: ['classify'] },
        { id: 'fiscal-preview', title: 'Tax', status: 'pending', blockedBy: ['reconcile'] },
        { id: 'backup', title: 'Backup', status: 'pending', blockedBy: ['fiscal-preview'] }
    ]
});

// Mock Snapshot
const emptySnapshot: DashboardDataSnapshot = {
    monthKey: '2024-01',
    stats: {
        income: 0,
        expenses: 0,
        recordsCount: 0,
        unknownClassificationsCount: 0,
        sourcesCount: { bank: 0, cfdi: 0, manual: 0 },
        missingCfdiCount: 0
    },
    signals: [],
    lastUpdated: new Date().toISOString()
};

// Mock Profile
const defaultProfile: EvoProfile = {
    id: 'test',
    name: 'Test',
    drivePrefix: '',
    dbPrefix: '',
    createdAt: '',
    featureFlags: {
        journeyV1: true,
        taxEngineV1: true
    }
};

describe('JourneyEngine V1 Logic', () => {

    it('should marking import steps as done when sources exist', () => {
        const snapshot = {
            ...emptySnapshot,
            stats: {
                ...emptySnapshot.stats,
                sourcesCount: { bank: 5, cfdi: 3, manual: 0 }
            }
        };

        const result = journeyEngine.evaluateState(getInitialState(), snapshot, defaultProfile);

        expect(result.steps.find(s => s.id === 'import-bank')?.status).toBe('done');
        expect(result.steps.find(s => s.id === 'import-cfdi')?.status).toBe('done');
    });

    it('should unlock classify when imports are done', () => {
        // Technically classify is blocked by imports.
        // If imports are done, classify should be pending (or done).
        // If imports are NOT done, classify should be blocked.

        const snapshot = {
            ...emptySnapshot,
            stats: {
                ...emptySnapshot.stats,
                sourcesCount: { bank: 5, cfdi: 5, manual: 0 }
            }
        };

        const result = journeyEngine.evaluateState(getInitialState(), snapshot, defaultProfile);

        // Imports done => Classify Unlocked (Pending)
        expect(result.steps.find(s => s.id === 'classify')?.status).toBe('pending');
    });

    it('should mark classify as done when fully classified', () => {
        const snapshot = {
            ...emptySnapshot,
            stats: {
                ...emptySnapshot.stats,
                sourcesCount: { bank: 5, cfdi: 5, manual: 0 },
                recordsCount: 10,
                unknownClassificationsCount: 0 // All clean
            }
        };

        const result = journeyEngine.evaluateState(getInitialState(), snapshot, defaultProfile);
        expect(result.steps.find(s => s.id === 'classify')?.status).toBe('done');
    });

    it('should block fiscal-preview if feature flag is disabled', () => {
        const profileDisabled: EvoProfile = {
            ...defaultProfile,
            featureFlags: { journeyV1: true, taxEngineV1: false }
        };

        // Even with perfect data
        const snapshot = {
            ...emptySnapshot,
            stats: {
                ...emptySnapshot.stats,
                sourcesCount: { bank: 1, cfdi: 1, manual: 0 },
                recordsCount: 2,
                unknownClassificationsCount: 0
            },
            taxSummary: { taxDue: 0, confidence: 1, details: {} }
        };

        const result = journeyEngine.evaluateState(getInitialState(), snapshot, profileDisabled);
        expect(result.steps.find(s => s.id === 'fiscal-preview')?.status).toBe('blocked');
    });

    it('should mark fiscal-preview done if summary exists and flag enabled', () => {
        // Needs clean data so PREVIOUS steps (classify -> reconcile) are done
        const snapshot = {
            ...emptySnapshot,
            stats: {
                ...emptySnapshot.stats,
                sourcesCount: { bank: 5, cfdi: 5, manual: 0 },
                recordsCount: 10,
                unknownClassificationsCount: 0 // Classify = done => Reconcile = done
            },
            taxSummary: { taxDue: 100, confidence: 0.9, details: {} }
        };

        const result = journeyEngine.evaluateState(getInitialState(), snapshot, defaultProfile);

        const fiscalStep = result.steps.find(s => s.id === 'fiscal-preview');
        expect(fiscalStep?.status).toBe('done');
    });
});
