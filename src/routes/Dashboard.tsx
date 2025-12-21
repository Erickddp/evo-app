import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, TrendingUp, ArrowRight, Check, Clock, Lock } from 'lucide-react';
import { evoEvents } from '../core/events';
import { dataStore } from '../core/data/dataStore';
import { registerWidget, getWidget } from '../core/dashboard/registry';
import { type DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../core/dashboard/types';
import { useDashboardData } from '../modules/core/data-provider/useDashboardData';
import { Link } from 'react-router-dom';
import { useProfiles } from '../modules/core/profiles/ProfileProvider';
import { isJourneyEnabled } from '../config/flags';
import { journeyStore } from '../modules/core/journey/JourneyStore';
import { journeyEngine } from '../modules/core/journey/JourneyEngine';
import type { DashboardDataSnapshot } from '../modules/core/data-provider/types';
import type { EvoProfile } from '../modules/core/profiles/profileTypes';

// Import and register widgets
import { SystemStatusWidget } from '../core/dashboard/widgets/SimpleWidgets';
import { FacturasWidget } from '../core/dashboard/widgets/FacturasWidget';
import { CfdiWidget } from '../core/dashboard/widgets/CfdiWidget';
import { FinancialSummaryWidget } from '../core/dashboard/widgets/FinancialSummaryWidget';
import { TaxOverviewWidget } from '../core/dashboard/widgets/TaxOverviewWidget';
import { IncomeBalanceWidget, IncomeTrendWidget } from '../core/dashboard/widgets/IncomeWidgets';

// Register widgets (idempotent)
// Removed quick-start as requested
registerWidget({ id: 'system-status', title: 'Tu información', component: <SystemStatusWidget />, defaultSize: 'medium' });
registerWidget({ id: 'facturas-overview', title: 'Facturación', component: <FacturasWidget />, defaultSize: 'medium' });
registerWidget({ id: 'cfdi-overview', title: 'Validación de CFDI', component: <CfdiWidget />, defaultSize: 'medium' });
registerWidget({ id: 'financial-summary', title: 'Resumen financiero', component: <FinancialSummaryWidget />, defaultSize: 'medium' });
registerWidget({ id: 'tax-overview', title: 'Resumen de impuestos', component: <TaxOverviewWidget />, defaultSize: 'medium' });
registerWidget({ id: 'income-balance', title: 'Balance de Ingresos', component: <IncomeBalanceWidget />, defaultSize: 'medium' });
registerWidget({ id: 'income-trend', title: 'Tendencia de Ingresos', component: <IncomeTrendWidget />, defaultSize: 'medium' });

// --- New Journey Progress Component ---
function JourneyProgressCard({ snapshot, profile, month }: { snapshot: DashboardDataSnapshot; profile: EvoProfile; month: string }) {
    // 1. Purely derive the journey state from the snapshot. No side effects.
    const journey = useMemo(() => {
        const initial = journeyStore.createInitialState(month);
        return journeyEngine.computeDerivedState(initial, snapshot, profile);
    }, [snapshot, month, profile]);

    // 2. Compute progress stats
    const totalSteps = journey.steps.length;
    const completedSteps = journey.steps.filter(s => s.status === 'done').length;
    const nextStep = journeyEngine.getNextAction(journey);

    // 3. Helper to get step status icon
    const getStatusIcon = (stepId: string) => {
        const step = journey.steps.find(s => s.id === stepId);
        if (!step) return <span className="w-2 h-2 rounded-full bg-slate-600" />;
        if (step.status === 'done') return <Check size={14} className="text-emerald-400" />;
        if (step.status === 'blocked') return <Lock size={13} className="text-slate-600" />;
        return <Clock size={13} className="text-blue-400" />;
    };

    return (
        <div className="p-5 rounded-xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 shadow-xl shadow-black/20 flex flex-col relative overflow-hidden group hover:border-blue-500/30 transition-all">
            {/* Header */}
            <div className="flex justify-between items-start mb-4 relative z-10">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                    Cierre Mensual
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {completedSteps}/{totalSteps} Pasos
                </span>
            </div>

            {/* Next Best Action */}
            <div className="flex-1 mb-4 relative z-10">
                {nextStep ? (
                    <>
                        <div className="text-xs text-slate-500 mb-1">Siguiente paso:</div>
                        <h3 className="text-lg font-medium text-slate-100 mb-2 truncate">
                            {nextStep.title}
                        </h3>
                        <Link
                            to={nextStep.cta || `/journey/close-month/${month}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-900/20 transition-all w-full justify-center"
                        >
                            Continuar <ArrowRight size={14} />
                        </Link>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-emerald-400 gap-2">
                        <Check size={32} />
                        <span className="font-medium">¡Cierre Completado!</span>
                    </div>
                )}
            </div>

            {/* Mini Steps List */}
            <div className="space-y-2 relative z-10 border-t border-slate-800/50 pt-3">
                {/* Bank */}
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-2">
                        {getStatusIcon('import-bank')} Banco
                    </span>
                </div>
                {/* CFDI */}
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-2">
                        {getStatusIcon('import-cfdi')} CFDI
                    </span>
                </div>
                {/* Classify */}
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-2">
                        {getStatusIcon('classify')} Clasificación
                    </span>
                    {(journey.steps.find(s => s.id === 'classify')?.status === 'pending' && snapshot.stats.unknownClassificationsCount > 0) && (
                        <span className="text-rose-400 font-medium">{snapshot.stats.unknownClassificationsCount}</span>
                    )}
                </div>
            </div>

            {/* Background Decor */}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <RefreshCw size={100} />
            </div>
        </div>
    );
}

export function Dashboard() {
    // Month Selection
    const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const { activeProfile } = useProfiles();

    // Data Provider
    const { snapshot, isLoading, error } = useDashboardData(month);

    // Feature Flag Check
    const journeyEnabled = isJourneyEnabled(activeProfile);

    // Debug logging (DEV only)
    useEffect(() => {
        if (import.meta.env.DEV && snapshot) {
            console.debug('[DASHBOARD] Telemetry', {
                month,
                totalRecords: snapshot.stats.recordsCount,
                sources: snapshot.stats.sourcesCount,
                signals: snapshot.signals,
                // Deep dive into correctness:
                // Check if we have 0 records but expect some?
                hasData: snapshot.stats.recordsCount > 0
            });
        }
    }, [month, snapshot, activeProfile]);

    const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);

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

                {/* --- LOADING / ERROR STATES --- */}
                {isLoading && !snapshot && (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-500 animate-pulse">
                        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                        <p>Cargando información del dashboard...</p>
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <div>
                            <p className="font-medium text-sm">Error al cargar datos</p>
                            <p className="text-xs opacity-80">{error.message}</p>
                        </div>
                    </div>
                )}

                {/* --- CENTRALIZED DASHBOARD VIEW (VERDAD ÚNICA) --- */}
                {snapshot && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* 1. Contextual Signals (Chips) */}
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Missing Data Signals */}
                            {snapshot.signals.needsCfdiImport && (
                                <Link to={`/tools/cfdi?month=${month}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-full text-xs font-medium text-amber-400 transition-colors">
                                    <AlertTriangle size={14} />
                                    <span>Faltan CFDI del mes</span>
                                </Link>
                            )}
                            {snapshot.signals.needsBankImport && (
                                <Link to={`/tools/bank?month=${month}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-full text-xs font-medium text-blue-400 transition-colors">
                                    <AlertCircle size={14} />
                                    <span>Faltan movimientos bancarios</span>
                                </Link>
                            )}
                            {/* Classification Signal */}
                            {snapshot.signals.needsClassification && (
                                <Link to={`/tools/classify?month=${month}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-full text-xs font-medium text-rose-400 transition-colors">
                                    <AlertCircle size={14} />
                                    <span>{snapshot.stats.unknownClassificationsCount} movimientos sin clasificar</span>
                                </Link>
                            )}

                            {/* All Good State */}
                            {!snapshot.signals.needsBankImport && !snapshot.signals.needsCfdiImport && !snapshot.signals.needsClassification && (snapshot.stats.sourcesCount.cfdi + snapshot.stats.sourcesCount.manual) > 0 && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-medium text-emerald-400">
                                    <RefreshCw size={14} className="text-emerald-500" />
                                    <span>Todo en orden para este mes</span>
                                </div>
                            )}
                        </div>

                        {/* 2. Key Metrics Cards (Financial Summary) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                            {/* Ingresos */}
                            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex flex-col justify-between group hover:border-slate-700 transition-colors">
                                <div>
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ingresos</span>
                                    <div className="text-2xl font-bold text-emerald-400 mt-1">
                                        ${snapshot.stats.ingresosTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-800/50 mt-4 flex justify-between items-center text-xs text-slate-400">
                                    <span>{snapshot.stats.sourcesCount.cfdi} facturas</span>
                                    <TrendingUp size={14} className="text-emerald-500/50" />
                                </div>
                            </div>

                            {/* Gastos y Movimientos */}
                            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex flex-col justify-between group hover:border-slate-700 transition-colors">
                                <div>
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gastos</span>
                                    <div className="text-2xl font-bold text-slate-200 mt-1">
                                        ${snapshot.stats.gastosTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-800/50 mt-4 flex flex-col gap-1 text-xs">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Total Movimientos</span>
                                        <span className="text-slate-300">{(snapshot.stats.sourcesCount.cfdi + snapshot.stats.sourcesCount.manual)}</span>
                                    </div>
                                    {snapshot.stats.unknownClassificationsCount > 0 ? (
                                        <div className="flex justify-between text-rose-400 font-medium">
                                            <span>Por clasificar</span>
                                            <span>{snapshot.stats.unknownClassificationsCount}</span>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between text-emerald-500/70">
                                            <span>Clasificación</span>
                                            <span>Completa</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. Journey / Journey Progress Summary */}
                            {journeyEnabled ? (
                                <JourneyProgressCard
                                    snapshot={snapshot}
                                    profile={activeProfile}
                                    month={month}
                                />
                            ) : (
                                /* Fallback: Tax Estimation (Only if Journey disabled) */
                                snapshot.taxSummary ? (
                                    <div className="p-5 rounded-xl bg-indigo-900/20 border border-indigo-500/20 shadow-sm flex flex-col justify-between relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-2 opacity-10">
                                            <TrendingUp size={48} />
                                        </div>
                                        <div>
                                            <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                                                Estimación Fiscal
                                                {snapshot.taxSummary.confidence < 0.8 && <AlertTriangle size={12} className="text-amber-500" />}
                                            </span>
                                            <div className="text-2xl font-bold text-indigo-200 mt-1">
                                                ${snapshot.taxSummary.impuestoEstimado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                        <div className="pt-4 mt-auto text-xs text-indigo-400/70">
                                            Base: ${snapshot.taxSummary.baseGravable.toLocaleString()}
                                        </div>
                                    </div>
                                ) : (
                                    /* Empty Spacer/Call to Action */
                                    <div className="hidden sm:flex p-5 rounded-xl border border-dashed border-slate-800 items-center justify-center text-slate-600 text-sm">
                                        Sin actividad reciente
                                    </div>
                                )
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
                    </div>
                )}
            </div>
        </div>
    );
}
