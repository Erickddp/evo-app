import { Calculator } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { TaxTrackerTool } from './index';

export const taxTrackerDefinition: ToolDefinition = {
    meta: {
        id: 'tax-tracker',
        name: 'Control Fiscal',
        description: 'Register tax payments and view projections based on income.',
        icon: Calculator,
        version: '0.1.0',
    },
    component: TaxTrackerTool,
};
