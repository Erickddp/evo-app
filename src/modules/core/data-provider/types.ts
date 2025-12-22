
export type DashboardMonthKey = string; // 'YYYY-MM'

export interface DashboardStats {
    ingresosTotal: number;
    gastosTotal: number;
    impuestosTotal: number;
    // Granularity
    deduciblesTotal: number;
    noDeduciblesTotal: number;
    unknownClassificationsCount: number;
    // Source breakdown
    sourcesCount: {
        cfdi: number;
        bank: number;
        manual: number;
        tax: number;
    };
    recordsCount: number;
    reconcilePendingCount: number;
}

export interface DashboardSignals {
    needsCfdiImport: boolean;
    needsBankImport: boolean;
    needsClassification: boolean;
    needsReconciliation: boolean;
}

export interface DashboardTaxSummary {
    baseGravable: number;
    impuestoEstimado: number;
    confidence: number;
    warnings: string[];
}

export interface DashboardDataSnapshot {
    month: DashboardMonthKey;
    stats: DashboardStats;
    signals: DashboardSignals;
    taxSummary?: DashboardTaxSummary; // Only if ENABLE_TAX_ENGINE_V1
    lastUpdatedAt: string; // ISO
}
