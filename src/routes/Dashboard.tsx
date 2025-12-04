import { useState, useEffect } from 'react';
import { Settings, X, Check } from 'lucide-react';
import { dataStore } from '../core/data/dataStore';
import { registerWidget, getWidget, getAllWidgets } from '../core/dashboard/registry';
import { type DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../core/dashboard/types';

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
    const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
    const [isCustomizing, setIsCustomizing] = useState(false);
    const [availableWidgets] = useState(getAllWidgets());

    // Load config from dataStore
    useEffect(() => {
        async function loadConfig() {
            try {
                const records = await dataStore.listRecords<DashboardConfig>('dashboard-config');
                if (records.length > 0) {
                    const savedConfig = records[records.length - 1].payload;
                    if (savedConfig && Array.isArray(savedConfig.visibleWidgets)) {
                        setConfig(savedConfig);
                    }
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
            await dataStore.saveRecord('dashboard-config', newConfig);
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

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                        EVOAPP
                    </h1>
                    <button
                        onClick={() => setIsCustomizing(!isCustomizing)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors duration-200 ${isCustomizing
                                ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                                : 'border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-400'
                            }`}
                        title="Personalizar Dashboard"
                    >
                        <Settings size={14} />
                        <span>Personalizar</span>
                    </button>
                </div>

                {/* Customization Drawer/Panel */}
                {isCustomizing && (
                    <div className="p-6 rounded-xl shadow-md bg-white/10 dark:bg-gray-900/40 border border-indigo-500/30 backdrop-blur-lg mb-6 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-indigo-300 tracking-wide">Personalizar Widgets</h3>
                            <button onClick={() => setIsCustomizing(false)} className="text-slate-400 hover:text-slate-300">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {availableWidgets.map(widget => {
                                const isVisible = config.visibleWidgets.includes(widget.id);
                                return (
                                    <button
                                        key={widget.id}
                                        onClick={() => toggleWidget(widget.id)}
                                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${isVisible
                                            ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-100'
                                            : 'border-slate-700 bg-slate-800/50 text-slate-400 opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <div className={`flex h-5 w-5 items-center justify-center rounded border ${isVisible ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-600 bg-slate-800'}`}>
                                            {isVisible && <Check size={12} />}
                                        </div>
                                        <span className="text-sm font-medium">
                                            {widget.title}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
