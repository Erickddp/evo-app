
import { isTaxEngineEnabled } from '../../../config/flags';
import type { DashboardDataSnapshot, DashboardStats, DashboardSignals, DashboardTaxSummary } from './types';
import type { EvoProfile } from '../../core/profiles/profileTypes';
import type { RegistroFinanciero } from '../../core/financial/types';
import { computeMonthly } from '../../tax/engine/TaxEngine';

import { isInMonth } from '../utils/month';

export const dashboardDataProvider = {
    getSnapshot(
        month: string,
        context: { profile: EvoProfile; registros: RegistroFinanciero[] }
    ): DashboardDataSnapshot {
        const { profile, registros } = context;
        const monthRecords = this.getMonthlyRecords(registros, month);
        const stats = this.computeStats(monthRecords);
        const signals = this.computeSignals(stats, monthRecords);

        let taxSummary: DashboardTaxSummary | undefined;

        if (isTaxEngineEnabled()) {
            // Sync call - Engine is pure
            const result = computeMonthly({ profile, registros: monthRecords, month });
            taxSummary = {
                baseGravable: result.baseGravable,
                impuestoEstimado: result.impuestoEstimado,
                confidence: result.confidence,
                warnings: result.warnings
            };
        }

        return {
            month,
            stats,
            signals,
            taxSummary,
            lastUpdatedAt: new Date().toISOString()
        };
    },

    getMonthlyRecords(registros: RegistroFinanciero[], month: string): RegistroFinanciero[] {
        // Use robust utility for filtering, checking both English and Spanish keys
        return registros.filter(r => isInMonth(r.date || (r as any).fecha, month));
    },

    computeStats(records: RegistroFinanciero[]): DashboardStats {
        let ingresosTotal = 0;
        let gastosTotal = 0;
        let impuestosTotal = 0;
        let deduciblesTotal = 0;
        let noDeduciblesTotal = 0;
        let unknownClassificationsCount = 0;
        let cfdi = 0, bank = 0, manual = 0, tax = 0;

        for (const r of records) {
            // Normalize fields (Legacy Support)
            const type = r.type || (r as any).tipo;
            const amount = r.amount || (r as any).monto || 0;
            const taxability = r.taxability; // Legacy might not have this or used different enum
            const source = r.source || (r as any).origen;

            // Totals by Type
            if (type === 'ingreso') ingresosTotal += amount;
            else if (type === 'gasto') gastosTotal += amount;
            else if (type === 'impuesto') impuestosTotal += amount;

            // Classification
            if (taxability === 'unknown') unknownClassificationsCount++;
            if (type === 'gasto') {
                if (taxability === 'deducible') deduciblesTotal += amount;
                if (taxability === 'no_deducible') noDeduciblesTotal += amount;
            }

            // Sources
            if (source === 'cfdi') cfdi++;
            else if (source === 'bank') bank++;
            else if (source === 'tax') tax++;
            else manual++; // Fallback: count anything else (manual, ingresos-manager, manual-csv) as manual
        }

        return {
            ingresosTotal,
            gastosTotal,
            impuestosTotal,
            deduciblesTotal,
            noDeduciblesTotal,
            unknownClassificationsCount,
            sourcesCount: { cfdi, bank, manual, tax },
            recordsCount: records.length
        };
    },

    computeSignals(stats: DashboardStats, records?: RegistroFinanciero[]): DashboardSignals {
        return {
            needsCfdiImport: stats.sourcesCount.cfdi === 0,
            needsBankImport: stats.sourcesCount.bank === 0,
            needsClassification: stats.unknownClassificationsCount > 0,
            // Reconcile: Placeholder. For future, check unlinked bank movs.
            needsReconciliation: false
        };
    }
};
