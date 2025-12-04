import type { ReactNode } from 'react';

export interface DashboardWidget {
    id: string;
    title: string;
    description?: string;
    component: ReactNode;
    defaultSize: 'small' | 'medium' | 'large' | 'full'; // small=1col, medium=2cols, large=3cols, full=4cols
}

export interface DashboardConfig {
    visibleWidgets: string[]; // Array of widget IDs in order
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
    visibleWidgets: [
        'quick-start',
        'system-status',
        'financial-summary',
        'facturas-overview',
        'tax-overview',
        'cfdi-overview',
        'income-balance',
        'income-trend'
    ]
};
