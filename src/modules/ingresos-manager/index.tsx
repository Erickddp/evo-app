import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Plus, Trash2, Download, Search } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { type EvoTransaction, createEvoTransaction, calculateTotals } from '../../core/domain/evo-transaction';
// TODO: Refactor to use 'RegistroFinanciero' from src/core/evoappDataModel.ts in Phase 2

import { parseIngresosCsv, loadMovementsFromStore, saveSnapshot } from './utils';
import { useIncomeAnalytics } from './useIncomeAnalytics';
import { AnalyticsPanel } from './AnalyticsPanel';

// --- Helper Functions ---

function todayAsIso(): string {
    return new Date().toISOString().split('T')[0];
}

function formatCurrency(amount: number): string {
    return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// --- Component ---

export const IngresosManagerTool: React.FC = () => {
    const [date, setDate] = useState<string>(todayAsIso());
    const [concept, setConcept] = useState('');
    const [amountStr, setAmountStr] = useState<string>('');
    const [type, setType] = useState<EvoTransaction['type']>('gasto');
    const [movements, setMovements] = useState<EvoTransaction[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [filterText, setFilterText] = useState('');

    // Analytics Hook
    const {
        view,
        setView,
        selectedYear,
        setSelectedYear,
        filteredMovements: timeFilteredMovements,
        availableYears
    } = useIncomeAnalytics(movements);

    // Load initial data
    useEffect(() => {
        loadMovementsFromStore().then(data => {
            setMovements(data);
            setIsLoaded(true);
        });
    }, []);

    // Apply text filter on top of time filter
    const finalFilteredMovements = useMemo(() => {
        return timeFilteredMovements.filter((m) =>
            m.concept.toLowerCase().includes(filterText.toLowerCase())
        );
    }, [timeFilteredMovements, filterText]);

    // Derived state for stats (based on current view)
    const stats = useMemo(() => calculateTotals(finalFilteredMovements), [finalFilteredMovements]);

    // Persist whenever movements change (only after initial load)
    useEffect(() => {
        if (isLoaded) {
            void saveSnapshot(movements);
        }
    }, [movements, isLoaded]);

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

            setMovements((prev) => [newMovement, ...prev]);

            // Reset form but keep date and type
            setConcept('');
            setAmountStr('');

            // Focus back on concept input for rapid entry
            const conceptInput = document.getElementById('concept-input');
            conceptInput?.focus();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = (id: string) => {
        setMovements((prev) => prev.filter((m) => m.id !== id));
    };

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
        link.download = `evorix-movimientos-${view}-${timestamp}.csv`;
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
                    alert(`No se importaron movimientos. 
Total filas: ${result.stats.totalRows}
Ignoradas: ${result.stats.ignored}
Errores: ${result.stats.errors}`);
                } else if (result.movements.length === 0) {
                    alert('El archivo parece estar vacío o no tiene formato válido.');
                    return;
                } else {
                    setMovements(prev => [...prev, ...result.movements]);

                    let msg = `Se importaron ${result.stats.imported} de ${result.stats.totalRows} filas.`;
                    if (result.stats.ignored > 0) msg += `\n${result.stats.ignored} filas ignoradas (sin importe).`;
                    if (result.stats.errors > 0) msg += `\n${result.stats.errors} filas con error.`;

                    alert(msg);
                }

                if (result.stats.errors > 0) {
                    console.warn('Detalle de errores de importación:', result.stats.errorDetails);
                }

            } catch (e: any) {
                alert(e.message || 'Error al importar CSV');
            }

            // Reset file input
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Movements Manager</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track income and expenses.</p>
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

            {/* Analytics Panel */}
            <AnalyticsPanel
                movements={movements}
                currentView={view}
                selectedYear={selectedYear}
            />

            {/* View Controls */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
                <button
                    onClick={() => setView('current-month')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'current-month'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Mes Actual
                </button>
                <button
                    onClick={() => setView('prev-month')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'prev-month'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Mes Anterior
                </button>
                <button
                    onClick={() => setView('last-3-months')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'last-3-months'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Últimos 3 Meses
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setView('year')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'year'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                    >
                        Por Año
                    </button>
                    {view === 'year' && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white py-1"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    )}
                </div>
                <button
                    onClick={() => setView('historic')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'historic'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Histórico
                </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-32">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                        required
                    />
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Concept</label>
                    <input
                        id="concept-input"
                        type="text"
                        value={concept}
                        onChange={(e) => setConcept(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                        placeholder="Description..."
                        required
                    />
                </div>
                <div className="w-full md:w-32">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as 'ingreso' | 'gasto')}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                    >
                        <option value="gasto">Gasto</option>
                        <option value="ingreso">Ingreso</option>
                    </select>
                </div>
                <div className="w-full md:w-32">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</label>
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
                    className="w-full md:w-auto px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                    <Plus size={16} /> Add
                </button>
            </form>

            {/* Filter & Export */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={14} className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="pl-9 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                        placeholder="Filtrar por concepto..."
                    />
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                    <span className="text-xs text-gray-400 hidden lg:inline-block mr-2" title="El CSV debe tener columnas: Fecha, Concepto, Ingreso, Gasto">
                        Formato: Fecha, Concepto, Ingreso, Gasto
                    </span>
                    <button
                        onClick={handleDownloadTemplate}
                        className="w-full md:w-auto px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm"
                        title="Descargar plantilla vacía"
                    >
                        <Download size={14} /> Plantilla
                    </button>
                    <input
                        type="file"
                        accept=".csv"
                        id="csv-upload-input"
                        style={{ display: 'none' }}
                        onChange={handleImportCsv}
                    />
                    <button
                        onClick={() => document.getElementById('csv-upload-input')?.click()}
                        className="w-full md:w-auto px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <Download size={14} className="rotate-180" /> Importar CSV
                    </button>
                    <button
                        onClick={handleExportCsv}
                        className="w-full md:w-auto px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <Download size={14} /> Exportar CSV
                    </button>
                </div>
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
                                        No movements found.
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
        version: '0.5.0',
    },
    component: IngresosManagerTool,
};
