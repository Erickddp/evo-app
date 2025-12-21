
import { computeMonthly, TaxComputationParams } from './TaxEngine';
import type { EvoProfile } from '../../core/profiles/profileTypes';
import type { RegistroFinanciero } from '../../core/financial/types';

// Mock dependencies
// We need to mock isTaxEngineEnabled. Since it's imported from flags, we can rely on jest.mock 
// or simpler, we can assume functionality based on providing the flag logic if we could, 
// but flags.ts is a real file.
// Ideally usage of `jest.mock` is standard. 
// However, the test runner "env" here is manual.
// I can't easily mock imports in this "Agent" environment without a real runner.
// But I can rely on the fact that I control the code. 
// Actually, `src/config/flags.ts` has specific values. `ENABLE_TAX_ENGINE_V1: false`.
// So `computeMonthly` should always return empty unless I change the flag or mock it.
// Since I can't change the flag file easily without affecting the user state,
// I will just test the "Disabled" state first.
// Then I'll modify the code under test to allow injection of flag? 
// No, I should stick to the requested "Tests" which implies I might need to enable it TEMPORARILY
// or check that it handles disabled state correctly.
// The instructions say "Si ENABLE_TAX_ENGINE_V1 está apagado: computeMonthly debe lanzar error... o warning".
// AND "Tests mínimos: Flag apagado => no ejecuta cálculo."
// So ensuring it respects the flag IS the test.

// But wait, "Tests mínimos... PF_RESICO con ingresos simples" IMPLIES I need to verify logic too.
// If the flag is OFF, I cannot test logic unless I bypass the check or mock the check.
// I will create a test that sets up the scenario. 
// Since I can't run `jest` here returning results to me, I am writing the test file for the USER repo.
// I should write a proper Jest/Vitest test file.
// I will check if the user has a test runner. `package.json` was not checked but typically standard.
// I will mock the module `../../../config/flags`.

/*
    import { computeMonthly } from './TaxEngine';
    import { isTaxEngineEnabled } from '../../../config/flags';
    
    jest.mock('../../../config/flags', () => ({
        isTaxEngineEnabled: jest.fn()
    }));
*/

// I will write the test assuming Jest/Vitest.

import { isTaxEngineEnabled } from '../../../config/flags';

jest.mock('../../../config/flags', () => ({
    isTaxEngineEnabled: jest.fn()
}));

const mockIsTaxEngineEnabled = isTaxEngineEnabled as jest.Mock;

describe('TaxEngine V1', () => {

    const mockProfile: EvoProfile = {
        id: 'p1',
        name: 'Test',
        drivePrefix: '',
        dbPrefix: '',
        createdAt: '',
        taxRegime: 'PF_RESICO',
        taxYear: 2024
    };

    const mockRecords: RegistroFinanciero[] = [
        {
            id: '1', date: '2024-01-15', amount: 10000, type: 'ingreso', source: 'cfdi', taxability: 'deducible',
            createdAt: '', updatedAt: ''
        },
        {
            id: '2', date: '2024-01-20', amount: 5000, type: 'ingreso', source: 'manual', taxability: 'unknown',
            createdAt: '', updatedAt: ''
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return warning and empty result if flag is disabled', () => {
        mockIsTaxEngineEnabled.mockReturnValue(false);
        const res = computeMonthly({ profile: mockProfile, registros: mockRecords, month: '2024-01' });
        expect(res.impuestoEstimado).toBe(0);
        expect(res.warnings).toContain('El motor de impuestos V1 no está habilitado.');
    });

    it('should calculate PF_RESICO correctly when enabled', () => {
        mockIsTaxEngineEnabled.mockReturnValue(true);
        // Total Income: 15,000. RESICO tax for <25k is 1% (0.01) -> 150.
        // But record 2 is manual & unknown taxability.
        // It is type='ingreso', source!='tax'. Included in base (15000).
        // Confidence should be < 1.

        const res = computeMonthly({ profile: mockProfile, registros: mockRecords, month: '2024-01' });

        expect(res.ingresos).toBe(15000);
        expect(res.baseGravable).toBe(15000);
        expect(res.tasaAplicada).toBe(0.01);
        expect(res.impuestoEstimado).toBe(150);
        expect(res.confidence).toBeLessThan(1);
        expect(res.warnings.length).toBeGreaterThan(0); // Low confidence or unknown taxability
    });

    it('should calculate PM correctly', () => {
        mockIsTaxEngineEnabled.mockReturnValue(true);
        const pmProfile = { ...mockProfile, taxRegime: 'PM' } as EvoProfile;

        // Income: 10000 (cfdi). Expense: 2000 (deducible).
        // Base: 8000. Rate: 0.30 -> 2400.
        const pmRecords = [
            mockRecords[0], // 10000 income
            {
                id: '3', date: '2024-01-10', amount: 2000, type: 'gasto', source: 'cfdi', taxability: 'deducible',
                createdAt: '', updatedAt: ''
            } as RegistroFinanciero
        ];

        const res = computeMonthly({ profile: pmProfile, registros: pmRecords, month: '2024-01' });

        expect(res.ingresos).toBe(10000);
        expect(res.gastosDeducibles).toBe(2000);
        expect(res.baseGravable).toBe(8000);
        expect(res.impuestoEstimado).toBe(2400); // 8000 * 0.3
        expect(res.confidence).toBe(1); // All cfdi/deducible (known)
    });
});
