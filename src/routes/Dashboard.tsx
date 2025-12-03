import { useState, useEffect } from 'react';
import { Settings, X, GripVertical, Check } from 'lucide-react';
import { dataStore } from '../core/data/dataStore';
import { registerWidget, getWidget, getAllWidgets } from '../core/dashboard/registry';
import { type DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../core/dashboard/types';

// Import and register widgets
import { QuickStartWidget, SystemStatusWidget } from '../core/dashboard/widgets/SimpleWidgets';
import { FacturasWidget } from '../core/dashboard/widgets/FacturasWidget';
import { CfdiWidget } from '../core/dashboard/widgets/CfdiWidget';
import { FinancialSummaryWidget } from '../core/dashboard/widgets/FinancialSummaryWidget';
import { TaxOverviewWidget } from '../core/dashboard/widgets/TaxOverviewWidget';

// Register widgets (idempotent)
registerWidget({ id: 'quick-start', title: 'Inicio rápido', component: <QuickStartWidget />, defaultSize: 'small' });
registerWidget({ id: 'system-status', title: 'Estado del sistema', component: <SystemStatusWidget />, defaultSize: 'small' });
registerWidget({ id: 'facturas-overview', title: 'Facturación', component: <FacturasWidget />, defaultSize: 'medium' });
registerWidget({ id: 'cfdi-overview', title: 'Validación de CFDI', component: <CfdiWidget />, defaultSize: 'medium' });
registerWidget({ id: 'financial-summary', title: 'Resumen financiero', component: <FinancialSummaryWidget />, defaultSize: 'medium' });
registerWidget({ id: 'tax-overview', title: 'Resumen de impuestos', component: <TaxOverviewWidget />, defaultSize: 'medium' });

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
        <div className="space-y-6 relative">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700 flex-1 mr-4">
                    <div className="relative z-10">
                        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                            EVOAPP
                        </h1>
                        <p className="mt-1 text-base text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                            Entorno de herramientas fiscales y financieras.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsCustomizing(!isCustomizing)}
                    className={`p-2 rounded-lg transition-colors ${isCustomizing ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                    title="Personalizar Dashboard"
                >
                    <Settings size={20} />
                </button>
            </div>

            {/* Customization Drawer/Panel */}
            {isCustomizing && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-lg mb-6 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Personalizar Widgets</h3>
                        <button onClick={() => setIsCustomizing(false)} className="text-gray-400 hover:text-gray-500">
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
                                        ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20'
                                        : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <div className={`flex h-5 w-5 items-center justify-center rounded border ${isVisible ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                        {isVisible && <Check size={12} />}
                                    </div>
                                    <span className={`text-sm font-medium ${isVisible ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {widget.title}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p>No hay widgets visibles.</p>
                    <button onClick={() => setIsCustomizing(true)} className="mt-2 text-indigo-600 hover:underline">
                        Personalizar dashboard
                    </button>
                </div>
            )}
        </div>
    );
}
