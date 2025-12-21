import { useState, useEffect } from 'react';
import { Settings, X, Check, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, TrendingUp } from 'lucide-react';
import { evoEvents } from '../core/events';
import { dataStore } from '../core/data/dataStore';
import { registerWidget, getWidget, getAllWidgets } from '../core/dashboard/registry';
import { type DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../core/dashboard/types';
import { useDashboardData } from '../modules/core/data-provider/useDashboardData';
import { Link } from 'react-router-dom';

// Import and register widgets
import { SystemStatusWidget } from '../core/dashboard/widgets/SimpleWidgets';
import { FacturasWidget } from '../core/dashboard/widgets/FacturasWidget';
import { CfdiWidget } from '../core/dashboard/widgets/CfdiWidget';
import { FinancialSummaryWidget } from '../core/dashboard/widgets/FinancialSummaryWidget';
import { TaxOverviewWidget } from '../core/dashboard/widgets/TaxOverviewWidget';
import { IncomeBalanceWidget, IncomeTrendWidget } from '../core/dashboard/widgets/IncomeWidgets';

// Register widgets (idempotent)
// Removed quick-start as requested
registerWidget({ id: 'system-status', title: 'Estado del sistema', component: <SystemStatusWidget />, defaultSize: 'small' });
registerWidget({ id: 'facturas-overview', title: 'Facturación', component: <FacturasWidget />, defaultSize: 'medium' });
registerWidget({ id: 'cfdi-overview', title: 'Validación de CFDI', component: <CfdiWidget />, defaultSize: 'medium' });
registerWidget({ id: 'financial-summary', title: 'Resumen financiero', component: <FinancialSummaryWidget />, defaultSize: 'medium' });
registerWidget({ id: 'tax-overview', title: 'Resumen de impuestos', component: <TaxOverviewWidget />, defaultSize: 'medium' });
registerWidget({ id: 'income-balance', title: 'Balance de Ingresos', component: <IncomeBalanceWidget />, defaultSize: 'medium' });
registerWidget({ id: 'income-trend', title: 'Tendencia de Ingresos', component: <IncomeTrendWidget />, defaultSize: 'medium' });

export function Dashboard() {
    // Month Selection
    const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

    // Data Provider
    const { snapshot, isLoading } = useDashboardData(month);

    const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
    const [isCustomizing, setIsCustomizing] = useState(false);
    const [availableWidgets] = useState(getAllWidgets());

    // Load config from dataStore
    useEffect(() => {
        async function loadConfig() {
            try {
                // Read from current snapshot
                const savedConfig = await dataStore.getSnapshot<DashboardConfig>('dashboard-config');
                if (savedConfig && Array.isArray(savedConfig.visibleWidgets)) {
                    setConfig(savedConfig);
                }
            } catch (e) {
                console.error('Failed to load dashboard config', e);
            }
        }
        void loadConfig();
    }, []);

    const saveConfig = async (newConfig: DashboardConfig) => {
        setConfig(newConfig);
        try {
            await dataStore.setSnapshot('dashboard-config', newConfig);
        } catch (e) {
            console.error('Failed to save dashboard config', e);
        }
    };

    const toggleWidget = (id: string) => {
        const current = new Set(config.visibleWidgets);
        if (current.has(id)) {
            current.delete(id);
        } else {
            current.add(id);
        }
        // Maintain order based on availableWidgets for simplicity in this version
        const newOrder = availableWidgets
            .filter(w => current.has(w.id))
            .map(w => w.id);

        saveConfig({ visibleWidgets: newOrder });
    };

    const handleMonthChange = (delta: number) => {
        const [y, m] = month.split('-').map(Number);
        const date = new Date(y, m - 1 + delta);
        setMonth(date.toISOString().slice(0, 7));
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                {/* Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                            EVOAPP
                        </h1>

                        {/* Month Picker */}
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                            <button onClick={() => handleMonthChange(-1)} className="p-1 hover:bg-slate-800 rounded text-slate-400">
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-3 text-sm font-medium text-slate-200">{month}</span>
                            <button onClick={() => handleMonthChange(1)} className="p-1 hover:bg-slate-800 rounded text-slate-400">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                evoEvents.emit('data:changed');
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-xs font-medium transition-colors duration-200"
                            title="Refrescar datos"
                        >
                            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">Actualizar</span>
                        </button>
                    </div>
                </div>

                {/* --- CENTRALIZED DASHBOARD VIEW (VERDAD ÚNICA) --- */}
                {snapshot && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* 1. Signals */}
                        {(snapshot.signals.needsBankImport || snapshot.signals.needsCfdiImport || snapshot.signals.needsClassification) && (
                            <div className="flex flex-wrap gap-2">
                                {snapshot.signals.needsCfdiImport && (
                                    <Link to="/tools/cfdi" className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm rounded-full flex items-center gap-2 hover:bg-amber-500/20">
                                        <AlertTriangle size={14} />
                                        <span>Faltan CFDI del mes</span>
                                    </Link>
                                )}
                                {snapshot.signals.needsBankImport && (
                                    <Link to="/tools/bank" className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm rounded-full flex items-center gap-2 hover:bg-blue-500/20">
                                        <AlertCircle size={14} />
                                        <span>Faltan movimientos bancarios</span>
                                    </Link>
                                )}
                                {snapshot.signals.needsClassification && (
                                    <Link to="/tools/classify" className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-full flex items-center gap-2 hover:bg-rose-500/20">
                                        <AlertCircle size={14} />
                                        <span>{snapshot.stats.unknownClassificationsCount} movimientos sin clasificar</span>
                                    </Link>
                                )}
                            </div>
                        )}

                        {/* 2. Key Metrics Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ingresos (Cobrado)</span>
                                <div className="text-2xl font-bold text-emerald-400">
                                    ${snapshot.stats.ingresosTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-slate-500 mt-2">
                                    {snapshot.stats.sourcesCount.cfdi} facturas, {snapshot.stats.sourcesCount.manual} manuales
                                </div>
                            </div>

                            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gastos (Pagado)</span>
                                <div className="text-2xl font-bold text-slate-200">
                                    ${snapshot.stats.gastosTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="flex gap-3 text-xs text-slate-500 mt-2">
                                    <span className="text-emerald-500/80">Ded: ${snapshot.stats.deduciblesTotal.toLocaleString()}</span>
                                    <span className="text-rose-500/80">No Ded: ${snapshot.stats.noDeduciblesTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Tax Estimation or Journey Status */}
                            {snapshot.taxSummary ? (
                                <div className="p-5 rounded-xl bg-indigo-900/20 border border-indigo-500/20 shadow-sm flex flex-col gap-1 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                        <TrendingUp size={48} />
                                    </div>
                                    <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                                        Estimación Fiscal
                                        {snapshot.taxSummary.confidence < 0.8 && <AlertTriangle size={12} className="text-amber-500" />}
                                    </span>
                                    <div className="text-2xl font-bold text-indigo-200">
                                        ${snapshot.taxSummary.impuestoEstimado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-indigo-400/70 mt-2">
                                        Base: ${snapshot.taxSummary.baseGravable.toLocaleString()}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex flex-col gap-1 justify-center items-start">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cierre Mensual</span>
                                    <Link to={`/journey/close-month/${month}`} className="mt-2 text-sm font-medium text-blue-400 hover:underline flex items-center gap-1">
                                        Ir al Journey <ChevronRight size={14} />
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="border-t border-slate-800/50 my-6"></div>

                {/* Legacy Widgets (Collapsible or Optional?) - Keeping them as requested but they are secondary now */}
                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 opacity-80 hover:opacity-100 transition-opacity">
                    {config.visibleWidgets.map(widgetId => {
                        const widget = getWidget(widgetId);
                        if (!widget) return null;

                        const colSpan = widget.defaultSize === 'medium' || widget.defaultSize === 'large' || widget.defaultSize === 'full'
                            ? 'md:col-span-2'
                            : '';

                        return (
                            <div key={widget.id} className={`${colSpan} animate-in fade-in zoom-in-95 duration-300`}>
                                {widget.component}
                            </div>
                        );
                    })}
                </div>

                {config.visibleWidgets.length === 0 && (
                    <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                        <p>No hay widgets visibles.</p>
                        <button onClick={() => setIsCustomizing(true)} className="mt-2 text-indigo-400 hover:underline">
                            Personalizar dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
