import type { ToolDefinition } from './shared/types';
import { cfdiValidatorDefinition } from './cfdi-validator';
import { ingresosManagerDefinition } from './ingresos-manager';
import { bankReconcilerDefinition } from './bank-reconciler/meta';
import { taxTrackerDefinition } from './tax-tracker/meta';

export const toolsRegistry: ToolDefinition[] = [
    cfdiValidatorDefinition,
    ingresosManagerDefinition,
    bankReconcilerDefinition,
    taxTrackerDefinition,
];

export function getToolById(id: string): ToolDefinition | undefined {
    return toolsRegistry.find((tool) => tool.meta.id === id);
}
