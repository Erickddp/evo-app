import { CreditCard } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { BankReconciler } from './index.tsx';

export const bankReconcilerDefinition: ToolDefinition = {
    meta: {
        id: 'bank-reconciler',
        name: 'Bank Reconciler',
        description: 'Import bank CSV movements and classify incomes/expenses.',
        icon: CreditCard,
        version: '0.1.0',
    },
    component: BankReconciler,
};
