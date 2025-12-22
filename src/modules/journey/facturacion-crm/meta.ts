import { FileText } from 'lucide-react';
import type { ToolDefinition } from '../../shared/types';
import FacturacionCrmTool from './index';

export const facturacionCrmDefinition: ToolDefinition = {
    meta: {
        id: 'facturacion-crm',
        name: 'Facturación', // Short name for sidebar/journey
        description: 'Gestión de Ingresos y Facturas del Mes',
        icon: FileText,
        version: '2.0.0',
    },
    component: FacturacionCrmTool,
};
