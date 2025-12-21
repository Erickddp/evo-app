
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useDashboardData } from './useDashboardData';
import { Link } from 'react-router-dom';

export function ToolHeaderSignals({ currentToolId }: { currentToolId: string }) {
    // We default to current month for signals in tools, or maybe we read from URL/Store?
    // ToolsHub doesn't have month context yet. 
    // Defaults to "current month" inside the hook if logic matches Dashboard default.
    // Dashboard default was `new Date()...`
    // Let's rely on default behavior or pass explicit "current real month".
    const month = new Date().toISOString().slice(0, 7);
    const { snapshot, isLoading } = useDashboardData(month);

    if (isLoading || !snapshot) return null;

    const { signals, stats } = snapshot;

    // Logic for contextual alerts
    // 1. CFDI Tool Context
    if (currentToolId === 'cfdi-validator') {
        if (!signals.needsCfdiImport) {
            return (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={16} />
                    <span>CFDIs del mes ({stats.sourcesCount.cfdi}) ya importados. ¡Todo listo!</span>
                </div>
            );
        } else {
            // If we are in the tool, we don't need a link to the tool, just status.
            // Maybe no alert needed, as user is here to do it.
            return null;
        }
    }

    // 2. Bank Tool Context (Assuming ID)
    if (currentToolId === 'bank-reconciler') { // Checking ID
        if (!signals.needsBankImport) {
            return (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={16} />
                    <span>Movimientos bancarios ({stats.sourcesCount.bank}) ya importados.</span>
                </div>
            );
        }
    }

    // 3. Classification Tool Context
    if (currentToolId === 'ingresos-manager' || currentToolId === 'tax-tracker') { // Classification tools
        if (signals.needsClassification) {
            return (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-between text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} />
                        <span>Tienes {stats.unknownClassificationsCount} movimientos sin clasificar.</span>
                    </div>
                    {/* If we are NOT in the specific classification tool (if split), give link. 
                         If we ARE in the tool, maybe just highlight?
                         "ingresos-manager" is generic. Let's assume user is where they need to be.
                      */}
                </div>
            );
        } else if (stats.recordsCount > 0) {
            return (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={16} />
                    <span>Todos los movimientos clasificados.</span>
                </div>
            );
        }
    }

    // Generic Signals that might appear elsewhere?
    // "Faltan CFDI" inside Bank Tool? useful context.
    if (currentToolId !== 'cfdi-validator' && signals.needsCfdiImport) {
        return (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between text-amber-400 text-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>Faltan importar facturas de este mes.</span>
                </div>
                <Link to="/tools/cfdi-validator" className="underline hover:text-amber-300">Ir a CFDI</Link>
            </div>
        );
    }

    return null;
}
