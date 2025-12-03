import { PieChart } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { FinancialSummary } from './index.tsx';

export const financialSummaryDefinition: ToolDefinition = {
    meta: {
        id: 'financial-summary',
        name: 'Estado Financiero',
        description: 'Automatic income statement based on recorded movements and tax payments.',
        icon: PieChart,
        version: '1.0.0',
    },
    component: FinancialSummary,
};
