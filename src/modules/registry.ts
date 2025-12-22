import type { ToolDefinition } from './shared/types';
export type Tool = ToolDefinition;
import { cfdiValidatorDefinition } from './cfdi-validator';
import { ingresosManagerDefinition } from './ingresos-manager';
import { bankReconcilerDefinition } from './bank-reconciler/meta';
import { taxTrackerDefinition } from './tax-tracker/meta';
import { financialSummaryDefinition } from './financial-summary/meta';
import { facturasDefinition } from './facturas/meta';
import { taxCalculationDefinition } from './tax-calculation';
import { evoLibraryDefinition } from './evo-library/meta';
import { movimientosBancariosDefinition } from './journey/movimientos-bancarios';
import { facturacionCrmDefinition } from './journey/facturacion-crm/meta'; // New module // Assuming this is also new based on the instruction's snippet, though not explicitly stated as "New module"

export const tools: Tool[] = [
    // --- MAIN TOOLS ---
    movimientosBancariosDefinition, // Journey Step 1
    facturacionCrmDefinition,       // Journey Step 2

    // --- LEGACY / OTHER TOOLS ---
    // dashboardDefinition, // This was in the instruction's snippet but not in the original file, so I'm commenting it out or assuming it's not meant to be added without an import.
    cfdiValidatorDefinition,
    ingresosManagerDefinition,
    bankReconcilerDefinition,
    facturasDefinition,
    taxTrackerDefinition,
    taxCalculationDefinition,
    financialSummaryDefinition,
    evoLibraryDefinition,
];

export const toolsRegistry = tools;

export function getToolById(id: string): ToolDefinition | undefined {
    return tools.find((tool) => tool.meta.id === id);
}
