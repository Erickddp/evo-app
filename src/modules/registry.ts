import type { ToolDefinition } from './shared/types';
export type Tool = ToolDefinition;
import { cfdiValidatorDefinition } from './cfdi-validator';
import { ingresosManagerDefinition } from './ingresos-manager';
import { bankReconcilerDefinition } from './bank-reconciler/meta';
import { taxTrackerDefinition } from './tax-tracker/meta';
import { financialSummaryDefinition } from './financial-summary/meta';
import { facturasDefinition } from './facturas/meta';
import { taxCalculationDefinition } from './tax-calculation';

export const tools: Tool[] = [
    cfdiValidatorDefinition,
    ingresosManagerDefinition,
    bankReconcilerDefinition,
    facturasDefinition,
    taxTrackerDefinition,
    taxCalculationDefinition,
    financialSummaryDefinition,
];

export const toolsRegistry = tools;

export function getToolById(id: string): ToolDefinition | undefined {
    return tools.find((tool) => tool.meta.id === id);
}
