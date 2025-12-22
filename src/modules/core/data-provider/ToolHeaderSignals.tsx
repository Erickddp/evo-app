
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useDashboardData } from './useDashboardData';
import { Link, useSearchParams } from 'react-router-dom';
import { getJourneyLink } from '../journey/journeyLinks';

export function ToolHeaderSignals({ currentToolId }: { currentToolId: string }) {
    const [searchParams] = useSearchParams();
    const urlMonth = searchParams.get('month');
    const month = urlMonth || new Date().toISOString().slice(0, 7);
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
            return null;
        }
    }

    // 2. Bank Tool Context
    if (currentToolId === 'bank-reconciler') {
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
    if (currentToolId === 'ingresos-manager' || currentToolId === 'tax-tracker') {
        if (signals.needsClassification) {
            return (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-between text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} />
                        <span>Tienes {stats.unknownClassificationsCount} movimientos sin clasificar.</span>
                    </div>
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

    // Generic Signals
    if (currentToolId !== 'cfdi-validator' && signals.needsCfdiImport) {
        return (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between text-amber-400 text-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>Faltan importar facturas de este mes.</span>
                </div>
                <Link to={getJourneyLink('import-cfdi', month)} className="underline hover:text-amber-300">Ir a CFDI</Link>
            </div>
        );
    }

    return null;
}
