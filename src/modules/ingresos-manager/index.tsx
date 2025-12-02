import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Plus, Trash2, Download, Search } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { dataStore } from '../../core/data/dataStore';

// --- Model Definitions ---

export interface Movement {
    id: string;
    date: string;      // ISO date (YYYY-MM-DD)
    concept: string;
    amount: number;    // positive = income, negative = expense
}

interface MovementStats {
    totalIncome: number;
    totalExpense: number; // positive absolute value
    netBalance: number;   // income - expense
}

// --- Helper Functions ---

async function loadMovementsFromStore(): Promise<Movement[]> {
    try {
        const records = await dataStore.listRecords<{ movements: Movement[] }>('ingresos-manager');
        if (records.length === 0) return [];

        // Sort by createdAt descending to get the latest snapshot
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return records[0].payload.movements || [];
    } catch (e) {
        console.error('Failed to load movements from dataStore', e);
        return [];
    }
}

function calculateStats(movements: Movement[]): MovementStats {
    let totalIncome = 0;
    let totalExpense = 0;

    for (const m of movements) {
        if (m.amount > 0) {
            totalIncome += m.amount;
        } else {
            totalExpense += Math.abs(m.amount);
        }
    }

    return {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
    };
}

async function saveSnapshot(movements: Movement[]) {
    const stats = calculateStats(movements);
    try {
        await dataStore.saveRecord('ingresos-manager', {
            movements,
            stats,
            movementsCount: movements.length,
            updatedAt: new Date().toISOString(),
        });
    } catch (e) {
        console.error('Failed to save snapshot to dataStore', e);
    }
}

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
    const [movements, setMovements] = useState<Movement[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [filterText, setFilterText] = useState('');

    // Load initial data
    useEffect(() => {
        loadMovementsFromStore().then(data => {
            setMovements(data);
            setIsLoaded(true);
        });
    }, []);

    // Derived state for stats
    const stats = useMemo(() => calculateStats(movements), [movements]);

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
        if (isNaN(parsedAmount)) return;

        const newMovement: Movement = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            date,
            concept: concept.trim(),
            amount: parsedAmount,
        };

        setMovements((prev) => [newMovement, ...prev]);

        // Reset form but keep date
        setConcept('');
        setAmountStr('');

        // Focus back on concept input for rapid entry
        const conceptInput = document.getElementById('concept-input');
        conceptInput?.focus();
    };

    const handleDelete = (id: string) => {
        setMovements((prev) => prev.filter((m) => m.id !== id));
    };

    const handleExportCsv = () => {
        if (movements.length === 0) return;

        const header = 'Fecha,Concepto,Monto,Tipo';
        const rows = movements.map((m) => {
            const type = m.amount >= 0 ? 'Ingreso' : 'Gasto';
            // Escape quotes in concept
            const safeConcept = `"${m.concept.replace(/"/g, '""')}"`;
            return `${m.date},${safeConcept},${m.amount},${type}`;
        });

        const csvContent = [header, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `evorix-movimientos-${timestamp}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const filteredMovements = movements.filter((m) =>
        m.concept.toLowerCase().includes(filterText.toLowerCase())
    );

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

            {/* Input Form */}
            <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-40">
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
                <div className="w-full md:w-40">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</label>
                    <input
                        type="number"
                        step="0.01"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                        placeholder="-100 or 500"
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
                <button
                    onClick={handleExportCsv}
                    disabled={movements.length === 0}
                    className="w-full md:w-auto px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
                >
                    <Download size={14} /> Exportar CSV
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
                            {filteredMovements.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                        No movements found.
                                    </td>
                                </tr>
                            ) : (
                                filteredMovements.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{m.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{m.concept}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium ${m.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {formatCurrency(m.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.amount >= 0
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                }`}>
                                                {m.amount >= 0 ? 'Ingreso' : 'Gasto'}
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
        name: 'Ingresos Manager',
        description: 'Track and manage your income sources.',
        icon: DollarSign,
        version: '0.5.0',
    },
    component: IngresosManagerTool,
};
