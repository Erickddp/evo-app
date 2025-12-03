import { FileText } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import FacturasModule from './index';

export const facturasDefinition: ToolDefinition = {
    meta: {
        id: 'facturas-manager',
        name: 'Facturación y Clientes',
        description: 'Mini CRM para clientes y facturas de ingresos.',
        icon: FileText,
    },
    component: FacturasModule,
};
