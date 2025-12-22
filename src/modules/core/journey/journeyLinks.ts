
/**
 * Journey Routing Configuration
 * 
 * Central definition of links between Journey Steps and Tools.
 * Ensures consistent navigation with mandatory month context.
 */

export const JOURNEY_LINKS: Record<string, { path: string; label: string; icon?: string }> = {
    'import-bank': {
        path: '/tools/bank-reconciler',
        label: 'Importar Banco'
    },
    'import-cfdi': {
        path: '/tools/cfdi-validator',
        label: 'Validar CFDI'
    },
    'classify': {
        path: '/tools/ingresos-manager', // Mapped to Ingresos Manager for classification/editing
        label: 'Clasificar'
    },
    'reconcile': {
        path: '/tools/bank-reconciler', // Bank Reconciler handles reconciliation loop
        label: 'Conciliar'
    },
    'fiscal-preview': {
        path: '/tools/tax-calculation',
        label: 'Cálculo de Impuestos'
    },
    'backup': {
        path: '/settings',
        label: 'Respaldo'
    }
};

/**
 * Helper to build a link with the mandatory month param.
 */
export function getJourneyLink(stepId: string, month: string): string {
    const config = JOURNEY_LINKS[stepId];
    if (!config) return '#';
    return `${config.path}?month=${month}`;
}
