
import { isTaxEngineEnabled } from '../../../config/flags';
import type { DashboardDataSnapshot, DashboardStats, DashboardSignals, DashboardTaxSummary } from './types';
import type { EvoProfile } from '../../core/profiles/profileTypes';
import type { RegistroFinanciero } from '../../core/financial/types';
import { computeMonthly } from '../../tax/engine/TaxEngine';

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
        // Robust check? Assume ISO format YYYY-MM-DD
        return registros.filter(r => r.date.startsWith(month));
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
            // Totals by Type
            if (r.type === 'ingreso') ingresosTotal += r.amount;
            else if (r.type === 'gasto') gastosTotal += r.amount;
            else if (r.type === 'impuesto') impuestosTotal += r.amount;

            // Classification
            if (r.taxability === 'unknown') unknownClassificationsCount++;
            if (r.type === 'gasto') {
                if (r.taxability === 'deducible') deduciblesTotal += r.amount;
                if (r.taxability === 'no_deducible') noDeduciblesTotal += r.amount;
            }

            // Sources
            switch (r.source) {
                case 'cfdi': cfdi++; break;
                case 'bank': bank++; break;
                case 'manual': manual++; break;
                case 'tax': tax++; break;
            }
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
