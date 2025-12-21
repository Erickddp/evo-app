import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DollarSign, Plus, Trash2, Download, Search, Filter, X } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { type EvoTransaction, createEvoTransaction, calculateTotals } from '../../core/domain/evo-transaction';
import { evoEvents } from '../../core/events';
import { parseIngresosCsv, loadMovementsFromStore, saveSnapshot, getYear } from './utils';
import { AnalyticsPanel } from './AnalyticsPanel';

// --- Constants ---
const MONTHS = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
];

// --- Helper Functions ---
function todayAsIso(): string {
    return new Date().toISOString().split('T')[0];
}

function formatCurrency(amount: number): string {
    return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// --- Component ---
export const IngresosManagerTool: React.FC = () => {
    // Data State
    const [movements, setMovements] = useState<EvoTransaction[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Refs to control Hydration vs User Action vs Remote Update
    const isHydratingRef = useRef(true);
    const isSavingRef = useRef(false);
    const dirtyRef = useRef(false);

    // Form State
    const [date, setDate] = useState<string>(todayAsIso());
    const [concept, setConcept] = useState('');
    const [amountStr, setAmountStr] = useState<string>('');
    const [type, setType] = useState<EvoTransaction['type']>('gasto');

    // Filter Panel State
    const [filterYear, setFilterYear] = useState<number | ''>('');
    const [filterMonth, setFilterMonth] = useState<number | ''>('');
    const [appliedFilter, setAppliedFilter] = useState<{ year: number; month: number } | null>(null);

    // Global Search State
    const [globalSearch, setGlobalSearch] = useState('');

    // Load initial data
    useEffect(() => {
        const load = () => {
            isHydratingRef.current = true;
            loadMovementsFromStore().then(data => {
                setMovements(data);
                setIsLoaded(true);
                // Mark hydration as done in the next tick loop logic or use effect?
                // Actually, since setMovements triggers re-render, the next effect run will see isHydrating=true
                // if we don't clear it. But we want to clear it AFTER the effect check would have fired.
                // However, dirtyRef is false, so it doesn't matter.
                // We'll set it false here so future edits work.
                isHydratingRef.current = false;
            });
        };

        load();

        const handleDataChanged = () => {
            // If we are currently saving, ignore the event we just emitted
            if (isSavingRef.current) return;

            // Reload data without full reset to avoid flicker
            // We use queueMicrotask to ensure we don't conflict with current render
            queueMicrotask(() => load());
        };

        evoEvents.on('data:changed', handleDataChanged);
        return () => evoEvents.off('data:changed', handleDataChanged);
    }, []);

    // Persist whenever movements change (only after initial load)
    // Persist whenever movements change (only after initial load AND if dirty)
    useEffect(() => {
        const save = async () => {
            if (isLoaded && !isHydratingRef.current && dirtyRef.current && !isSavingRef.current) {
                try {
                    isSavingRef.current = true;
                    // console.log('Saving snapshot...');
                    await saveSnapshot(movements);
                    dirtyRef.current = false;
                } finally {
                    isSavingRef.current = false;
                }
            }
        };
        void save();
    }, [movements, isLoaded]);

    // Available Years for Dropdown
    const availableYears = useMemo(() => {
        const years = new Set(movements.map(m => getYear(m.date)));
        years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
    }, [movements]);

    // Derived State: Filtered Movements
    const finalFilteredMovements = useMemo(() => {
        let result = movements;

        // 1. Time Filter (Year/Month)
        if (appliedFilter) {
            result = result.filter(m => {
                const d = new Date(m.date);
                // getMonth() is 0-indexed, we want 1-indexed to match values
                const mMonth = d.getMonth() + 1;
                const mYear = d.getFullYear();
                return mYear === appliedFilter.year && mMonth === appliedFilter.month;
            });
        }

        // 2. Global Search (Date, Concept, Amount, Type)
        if (globalSearch.trim()) {
            const lowerQuery = globalSearch.toLowerCase();
            result = result.filter(m =>
                m.date.includes(lowerQuery) ||
                m.concept.toLowerCase().includes(lowerQuery) ||
                m.amount.toString().includes(lowerQuery) ||
                m.type.toLowerCase().includes(lowerQuery)
            );
        }

        // Sort by Date Descending
        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [movements, appliedFilter, globalSearch]);

    // Stats based on filtered view
    const stats = useMemo(() => calculateTotals(finalFilteredMovements), [finalFilteredMovements]);

    // Handlers
    const handleAdd = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!concept.trim() || !amountStr) return;

        const parsedAmount = parseFloat(amountStr);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            alert('Ingresa un monto positivo válido.');
            return;
        }

        try {
            const newMovement = createEvoTransaction({
                date,
                concept: concept.trim(),
                amount: parsedAmount,
                type: type,
                source: 'manual'
            });

            setMovements((prev) => {
                dirtyRef.current = true;
                return [newMovement, ...prev];
            });

            // Reset form but keep date and type
            setConcept('');
            setAmountStr('');

            // Focus back on concept input
            const conceptInput = document.getElementById('concept-input');
            conceptInput?.focus();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = (id: string) => {
        dirtyRef.current = true;
        setMovements((prev) => prev.filter((m) => m.id !== id));
    };

    const handleApplyFilters = () => {
        if (filterYear !== '' && filterMonth !== '') {
            setAppliedFilter({ year: Number(filterYear), month: Number(filterMonth) });
        } else {
            alert('Por favor selecciona Año y Mes para filtrar.');
        }
    };

    const handleClearFilters = () => {
        setFilterYear('');
        setFilterMonth('');
        setAppliedFilter(null);
    };

    // CSV Handlers
    const handleExportCsv = () => {
        const header = 'Fecha,Concepto,Ingreso,Gasto';
        let csvContent = header;

        if (finalFilteredMovements.length > 0) {
            const rows = finalFilteredMovements.map((m) => {
                const safeConcept = `"${m.concept.replace(/"/g, '""')}"`;
                let ingreso = '';
                let gasto = '';

                if (m.type === 'ingreso') {
                    ingreso = m.amount.toString();
                } else {
                    gasto = m.amount.toString();
                }

                return `${m.date},${safeConcept},${ingreso},${gasto}`;
            });
            csvContent += '\n' + rows.join('\n');
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `evorix-movimientos-${timestamp}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadTemplate = () => {
        const header = 'Fecha,Concepto,Ingreso,Gasto';
        const blob = new Blob([header], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla-ingresos.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            try {
                const result = parseIngresosCsv(text);
                if (result.movements.length === 0 && result.stats.totalRows > 0) {
                    alert(`No se importaron movimientos.\nTotal filas: ${result.stats.totalRows}\nIgnoradas: ${result.stats.ignored}\nErrores: ${result.stats.errors}`);
                } else if (result.movements.length === 0) {
                    alert('El archivo parece estar vacío o no tiene formato válido.');
                } else {
                    dirtyRef.current = true;
                    setMovements(prev => [...prev, ...result.movements]);
                    let msg = `Se importaron ${result.stats.imported} de ${result.stats.totalRows} filas.`;
                    if (result.stats.ignored > 0) msg += `\n${result.stats.ignored} filas ignoradas.`;
                    if (result.stats.errors > 0) msg += `\n${result.stats.errors} filas con error.`;
                    alert(msg);
                }
            } catch (e: any) {
                alert(e.message || 'Error al importar CSV');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Gestor de Ingresos</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Control de gastos e ingresos.</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800">
                    <div className="text-xs text-green-600 dark:text-green-400 font-medium uppercase">Total Ingresos</div>
                    <div className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(stats.totalIncome)}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">
                    <div className="text-xs text-red-600 dark:text-red-400 font-medium uppercase">Total Gastos</div>
                    <div className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(stats.totalExpense)}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase">Saldo Neto</div>
                    <div className={`text-lg font-bold ${stats.netBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(stats.netBalance)}
                    </div>
                </div>
            </div>

            {/* Analytics - Showing context based on selection or default */}
            <AnalyticsPanel
                movements={movements}
                currentView={appliedFilter ? 'year' : 'historic'}
                selectedYear={appliedFilter ? appliedFilter.year : new Date().getFullYear()}
            />

            {/* Layout: Form + Filter Split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Manual Form */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                        Nuevo Movimiento
                    </h4>
                    <form onSubmit={handleAdd} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as 'ingreso' | 'gasto')}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                                >
                                    <option value="gasto">Gasto</option>
                                    <option value="ingreso">Ingreso</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Concepto</label>
                            <input
                                id="concept-input"
                                type="text"
                                value={concept}
                                onChange={(e) => setConcept(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                                placeholder="Descripción..."
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Monto</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={amountStr}
                                onChange={(e) => setAmountStr(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium mt-2"
                        >
                            <Plus size={16} /> Agregar
                        </button>
                    </form>
                </div>

                {/* Right: Search/Filter Panel */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-center">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                        Buscar movimientos
                    </h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Año</label>
                                <select
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                                >
                                    <option value="">Seleccionar año</option>
                                    {availableYears.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mes</label>
                                <select
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value ? Number(e.target.value) : '')}
                                    disabled={!filterYear}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2 disabled:opacity-50"
                                >
                                    <option value="">Seleccionar mes</option>
                                    {MONTHS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleApplyFilters}
                                className="flex-1 px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Filter size={16} /> Aplicar filtros
                            </button>
                            {appliedFilter && (
                                <button
                                    onClick={handleClearFilters}
                                    className="px-4 py-2 bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                                    title="Limpiar filtros"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Search Bar */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400" />
                </div>
                <input
                    type="text"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white py-3 text-base"
                    placeholder="Buscar por fecha, concepto, monto o tipo..."
                />
            </div>

            {/* CSV Buttons - Prominent Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                    onClick={handleDownloadTemplate}
                    className="flex flex-col md:flex-row items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm group"
                >
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full group-hover:bg-gray-200 dark:group-hover:bg-gray-600">
                        <Download size={20} className="text-gray-600 dark:text-gray-300" />
                    </div>
                    <span className="font-medium text-gray-700 dark:text-gray-200">Plantilla</span>
                </button>

                <label className="flex flex-col md:flex-row items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm cursor-pointer group">
                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportCsv}
                    />
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50">
                        <Download size={20} className="rotate-180 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="font-medium text-gray-700 dark:text-gray-200">Importar CSV</span>
                </label>

                <button
                    onClick={handleExportCsv}
                    disabled={finalFilteredMovements.length === 0}
                    className="flex flex-col md:flex-row items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-full group-hover:bg-green-100 dark:group-hover:bg-green-900/50">
                        <Download size={20} className="text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium text-gray-700 dark:text-gray-200">Exportar CSV</span>
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Concept</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {finalFilteredMovements.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                        No se encontraron movimientos.
                                    </td>
                                </tr>
                            ) : (
                                finalFilteredMovements.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{m.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{m.concept}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium ${m.type === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {formatCurrency(m.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.type === 'ingreso'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                }`}>
                                                {m.type === 'ingreso' ? 'Ingreso' : 'Gasto'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleDelete(m.id)}
                                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const ingresosManagerDefinition: ToolDefinition = {
    meta: {
        id: 'ingresos-manager',
        name: 'Gestor de Ingresos',
        description: 'Track and manage your income sources.',
        icon: DollarSign,
        version: '0.6.0',
    },
    component: IngresosManagerTool,
};
