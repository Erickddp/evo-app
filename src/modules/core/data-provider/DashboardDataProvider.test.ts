import { dashboardDataProvider } from './DashboardDataProvider';
import type { RegistroFinanciero } from '../../core/financial/types';
import type { EvoProfile } from '../../core/profiles/profileTypes';
import { isTaxEngineEnabled } from '../../../config/flags';

// Mock dependencies
jest.mock('../../../config/flags', () => ({
    isTaxEngineEnabled: jest.fn()
}));

jest.mock('../../tax/engine/TaxEngine', () => ({
    computeMonthly: jest.fn().mockReturnValue({
        baseGravable: 1000,
        impuestoEstimado: 300,
        confidence: 0.9,
        warnings: []
    })
}));

describe('DashboardDataProvider', () => {
    const mockProfile: EvoProfile = {
        id: 'p1', name: 'Test', drivePrefix: '', dbPrefix: '', createdAt: ''
    };

    const mockRecords: RegistroFinanciero[] = [
        { id: '1', date: '2024-01-10', amount: 100, type: 'ingreso', source: 'cfdi', taxability: 'unknown', createdAt: '', updatedAt: '' },
        { id: '2', date: '2024-01-20', amount: 50, type: 'gasto', source: 'bank', taxability: 'deducible', createdAt: '', updatedAt: '' },
        { id: '3', date: '2024-02-01', amount: 1000, type: 'ingreso', source: 'manual', taxability: 'unknown', createdAt: '', updatedAt: '' }, // Other month
    ];

    it('filters records by month and computes stats correctly', () => {
        const snapshot = dashboardDataProvider.getSnapshot('2024-01', {
            profile: mockProfile,
            registros: mockRecords
        });

        expect(snapshot.month).toBe('2024-01');
        expect(snapshot.stats.recordsCount).toBe(2);

        // Income
        expect(snapshot.stats.ingresosTotal).toBe(100);
        // Expense
        expect(snapshot.stats.gastosTotal).toBe(50);
        // Sources
        expect(snapshot.stats.sourcesCount.cfdi).toBe(1);
        expect(snapshot.stats.sourcesCount.bank).toBe(1);
        expect(snapshot.stats.sourcesCount.manual).toBe(0); // This was Feb
    });

    it('generates correct signals', () => {
        const snapshot = dashboardDataProvider.getSnapshot('2024-01', {
            profile: mockProfile,
            registros: mockRecords
        });

        // We have CFDI and Bank, so imports not needed
        expect(snapshot.signals.needsCfdiImport).toBe(false);
        expect(snapshot.signals.needsBankImport).toBe(false);

        // We have unknown classification (record 1)
        expect(snapshot.stats.unknownClassificationsCount).toBe(1);
        expect(snapshot.signals.needsClassification).toBe(true);
    });

    it('omits tax summary if flag is disabled', () => {
        (isTaxEngineEnabled as jest.Mock).mockReturnValue(false);
        const snapshot = dashboardDataProvider.getSnapshot('2024-01', {
            profile: mockProfile,
            registros: mockRecords
        });
        expect(snapshot.taxSummary).toBeUndefined();
    });

    it('includes tax summary if flag is enabled', () => {
        (isTaxEngineEnabled as jest.Mock).mockReturnValue(true);
        const snapshot = dashboardDataProvider.getSnapshot('2024-01', {
            profile: mockProfile,
            registros: mockRecords
        });
        expect(snapshot.taxSummary).toBeDefined();
        expect(snapshot.taxSummary?.impuestoEstimado).toBe(300);
    });
});
