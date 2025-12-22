import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Landmark, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, Wallet, Search, X, Filter, FileUp, FileDown, Download, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import type { ToolDefinition } from '../../shared/types';
import { JourneyToolHeader } from '../../core/journey/components/JourneyToolHeader';
import {
    calculateTotals,
    loadMovimientosFromStore,
    normalizeMovimientoToRegistro,
    saveMovimientosSnapshot,
    deleteMovimientoFromStore,
    formatCurrency,
    downloadTemplate,
    exportToCsv,
    parseMovimientosCsv,
    saveImportedMovimientos,
    normalizeDate,
    type CsvImportResult,
    type CsvRowError
} from './utils';
import { type EvoTransaction } from '../../../core/domain/evo-transaction';

export const MovimientosBancariosTool: React.FC = () => {
    // --- State ---
    const [movements, setMovements] = useState<EvoTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // --- Import State ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const actionsButtonRef = useRef<HTMLButtonElement>(null);
    const [importPreview, setImportPreview] = useState<CsvImportResult | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showErrorDetails, setShowErrorDetails] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    // --- Filter State (Month, Search, Type) ---
    const [searchParams, setSearchParams] = useSearchParams();
    const urlMonth = searchParams.get('month');
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = urlMonth || today.substring(0, 7);

    // --- Helper for Month Navigation ---
    const addMonths = (yyyyMM: string, delta: number) => {
        const [year, month] = yyyyMM.split('-').map(Number);
        const date = new Date(year, month - 1 + delta, 1);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    };

    const handlePrevMonth = () => {
        const newMonth = addMonths(currentMonth, -1);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('month', newMonth);
            return next;
        });
    };

    const handleNextMonth = () => {
        const newMonth = addMonths(currentMonth, 1);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('month', newMonth);
            return next;
        });
    };

    // --- Actions Menu State ---
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

    const toggleActionsMenu = () => {
        if (!showActionsMenu && actionsButtonRef.current) {
            const rect = actionsButtonRef.current.getBoundingClientRect();
            // Calculate position to align right-edge of menu with right-edge of button
            // Menu width is roughly 240px (w-60)
            setMenuPosition({
                top: rect.bottom + window.scrollY + 8,
                left: Math.max(16, rect.right - 240)
            });
        }
        setShowActionsMenu(!showActionsMenu);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowActionsMenu(false);
        };
        if (showActionsMenu) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showActionsMenu]);


    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'ingreso' | 'gasto'>('all');

    // --- Form State ---
    const [formDate, setFormDate] = useState(today);
    const [formType, setFormType] = useState<'ingreso' | 'gasto'>('gasto');
    const [formConcept, setFormConcept] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    // --- Load Data ---
    const loadData = async () => {
        setIsLoading(true);
        const data = await loadMovimientosFromStore();
        setMovements(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []); // Only on mount

    // --- Derived Data ---
    const filteredMovements = useMemo(() => {
        let result = movements;

        // 1. Month Filter (always active as base scope)
        result = result.filter(m => m.date.startsWith(currentMonth));

        // 2. Type Filter
        if (filterType !== 'all') {
            result = result.filter(m => m.type === filterType);
        }

        // 3. Search Filter
        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(m =>
                m.concept.toLowerCase().includes(lowerTerm) ||
                m.amount.toString().includes(lowerTerm) ||
                m.date.includes(lowerTerm)
            );
        }

        // 4. Sort (Date DESC)
        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [movements, currentMonth, filterType, searchTerm]);

    const stats = useMemo(() => calculateTotals(filteredMovements), [filteredMovements]);

    // --- Handlers ---
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const amountVal = parseFloat(formAmount);

        // Validations
        const dateCheck = normalizeDate(formDate);
        if (!dateCheck.ok || !dateCheck.value) return setFormError('Fecha inválida. Usa el selector.');

        const finalDate = dateCheck.value; // Guaranteed YYYY-MM-DD

        if (!formConcept.trim() || formConcept.length < 2) return setFormError('El concepto debe tener al menos 2 caracteres.');
        if (isNaN(amountVal) || amountVal <= 0) return setFormError('El monto debe ser mayor a 0.');

        // Temp log for verification
        console.log('Saving Manual Movement Date:', finalDate);

        const raw = {
            date: finalDate,
            concept: formConcept,
            amount: amountVal,
            type: formType,
            id: crypto.randomUUID()
        };

        const registro = normalizeMovimientoToRegistro(raw);
        if (registro) {
            const uiTx: EvoTransaction = {
                id: raw.id,
                date: raw.date,
                amount: amountVal,
                type: formType,
                concept: raw.concept,
                source: 'manual'
            };

            await saveMovimientosSnapshot(uiTx);

            setMovements(prev => [uiTx, ...prev]);

            // Reset & Close
            setFormConcept('');
            setFormAmount('');
            setShowForm(false);
            setFormError(null);

            loadData();
        } else {
            setFormError('Error al procesar el movimiento.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este movimiento?')) return;
        await deleteMovimientoFromStore(id);
        const newData = movements.filter(m => m.id !== id);
        setMovements(newData);
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterType('all');
    };

    // --- CSV Actions ---
    const handleDownloadTemplate = () => {
        downloadTemplate();
    };

    const handleExportCsv = () => {
        exportToCsv(filteredMovements, currentMonth);
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const result = await parseMovimientosCsv(text);

        setImportPreview(result);
        setShowImportModal(true);
        setShowErrorDetails(false);
    };

    const confirmImport = async () => {
        if (!importPreview) return;

        setIsImporting(true);
        await saveImportedMovimientos(importPreview.valid);

        setIsImporting(false);
        setShowImportModal(false);
        setImportPreview(null);

        // Reload
        await loadData();
        alert('Importación completada exitosamente.');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative min-h-screen pb-20">

            <JourneyToolHeader
                currentMonth={currentMonth}
                title="Movimientos Bancarios"
                subtitle="Conciliación y registro de cargos y abonos."
                hideMonthBadge={true}
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Abonos</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(stats.totalIncome)}</p>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-full">
                        <ArrowUpCircle className="text-green-600 dark:text-green-400" size={24} />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Cargos</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatCurrency(stats.totalExpense)}</p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full">
                        <ArrowDownCircle className="text-red-600 dark:text-red-400" size={24} />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Saldo Periodo</p>
                        <p className={`text-2xl font-bold mt-1 ${stats.netBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>
                            {formatCurrency(stats.netBalance)}
                        </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-full">
                        <Wallet className="text-gray-600 dark:text-gray-300" size={24} />
                    </div>
                </div>
            </div>

            {/* Period Selector (Full Width Hero Row) */}
            <div className="flex w-full items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mb-4">
                <button
                    onClick={handlePrevMonth}
                    className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors border border-gray-100 dark:border-gray-700 shadow-sm bg-gray-50/50 dark:bg-gray-900/50"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Periodo de Operación</span>
                    <span className="text-xl font-mono font-bold text-gray-900 dark:text-white mt-1">{currentMonth}</span>
                </div>
                <button
                    onClick={handleNextMonth}
                    className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors border border-gray-100 dark:border-gray-700 shadow-sm bg-gray-50/50 dark:bg-gray-900/50"
                >
                    <ChevronRight size={24} />
                </button>
            </div>

            {/* Toolbar: Search, Filter, Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">

                {/* Left: Search & Filters */}
                <div className="flex flex-1 flex-col md:flex-row gap-3 w-full md:w-auto">

                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Search className="h-4 w-4" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar..."
                            className="pl-9 w-full text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500 h-9"
                        />
                    </div>

                    {/* Filter Type */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500 h-9"
                        >
                            <option value="all">Todos</option>
                            <option value="ingreso">Abonos</option>
                            <option value="gasto">Cargos</option>
                        </select>

                        {(searchTerm || filterType !== 'all') && (
                            <button
                                onClick={handleClearFilters}
                                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline px-2"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">

                    {/* Unified Actions Dropdown (Portal-based Anti-Clip) */}
                    <button
                        ref={actionsButtonRef}
                        onClick={toggleActionsMenu}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-medium z-20 relative"
                    >
                        <MoreVertical size={18} className="md:hidden" />
                        <span className="hidden md:inline">Acciones</span>
                        <span className="md:hidden">CSV</span>
                    </button>

                    {showActionsMenu && createPortal(
                        <>
                            {/* Global Overlay for closing */}
                            <div className="fixed inset-0 z-[9999]" onClick={() => setShowActionsMenu(false)} />

                            {/* Menu content */}
                            <div
                                className="fixed z-[10000] w-60 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1 overflow-hidden animate-in zoom-in-95 duration-100"
                                style={{
                                    top: `${menuPosition.top}px`,
                                    left: `${menuPosition.left}px`
                                }}
                            >
                                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-900/50">
                                    Opciones CSV
                                </div>
                                <button
                                    onClick={() => { handleDownloadTemplate(); setShowActionsMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center gap-3 transition-colors group"
                                >
                                    <FileDown size={18} className="group-hover:text-indigo-600 transition-colors" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">Plantilla</span>
                                        <span className="text-[10px] text-gray-400">Layout Evo o Banco</span>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { handleImportClick(); setShowActionsMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center gap-3 transition-colors group"
                                >
                                    <FileUp size={18} className="group-hover:text-indigo-600 transition-colors" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">Importar CSV</span>
                                        <span className="text-[10px] text-gray-400">Cargar movimientos</span>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { handleExportCsv(); setShowActionsMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center gap-3 transition-colors group"
                                >
                                    <Download size={18} className="group-hover:text-indigo-600 transition-colors" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">Exportar</span>
                                        <span className="text-[10px] text-gray-400">Descargar actual</span>
                                    </div>
                                </button>
                            </div>
                        </>,
                        document.body
                    )}

                    {/* Shared File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv"
                        className="hidden"
                    />

                    <button
                        onClick={() => setShowForm(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium"
                    >
                        <Plus size={18} />
                        <span>Nuevo</span>
                    </button>
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-700">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Nuevo Movimiento</h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-md border border-red-100 dark:border-red-800 font-medium">
                                    {formError}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</label>
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={e => setFormDate(e.target.value)}
                                        className="w-full rounded-lg border-gray-300 text-sm p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        autoFocus
                                    />
                                    <p className="text-[10px] text-gray-400">
                                        Fecha (MX): <span className="font-medium text-gray-600 dark:text-gray-300">
                                            {formDate.split('-').reverse().join('/')}
                                        </span>
                                        <span className="mx-1 text-gray-300">|</span>
                                        Guardado: <span className="font-mono text-gray-500">{formDate}</span>
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={formAmount}
                                        onChange={e => setFormAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full rounded-lg border-gray-300 text-sm p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de Movimiento</label>
                                <div className="flex rounded-lg shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setFormType('gasto')}
                                        className={`flex-1 py-2.5 text-sm border rounded-l-lg transition-colors font-medium ${formType === 'gasto'
                                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800 z-10 ring-1 ring-red-200 dark:ring-red-800'
                                            : 'bg-white text-gray-500 border-gray-300 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                                    >
                                        Cargo (Gasto)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormType('ingreso')}
                                        className={`flex-1 py-2.5 text-sm border-t border-b border-r rounded-r-lg transition-colors font-medium ${formType === 'ingreso'
                                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800 z-10 ring-1 ring-green-200 dark:ring-green-800'
                                            : 'bg-white text-gray-500 border-gray-300 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                                    >
                                        Abono (Ingreso)
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Concepto</label>
                                <input
                                    type="text"
                                    value={formConcept}
                                    onChange={e => setFormConcept(e.target.value)}
                                    placeholder="Ej. Pago de servicios..."
                                    className="w-full rounded-lg border-gray-300 text-sm p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-md transition-all active:scale-95 hover:shadow-lg"
                                >
                                    Guardar Movimiento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Confirmation Modal */}
            {showImportModal && importPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-700">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Confirmar Importación</h3>
                            <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {!showErrorDetails ? (
                                <>
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            Se han procesado <strong>{importPreview.total}</strong> filas del archivo.
                                        </p>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800">
                                                <span className="block text-2xl font-bold text-green-600 dark:text-green-400">{importPreview.valid.length}</span>
                                                <span className="text-xs text-green-700 dark:text-green-300 font-medium">Válidos</span>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">
                                                <span className="block text-2xl font-bold text-red-600 dark:text-red-400">{importPreview.errors.length}</span>
                                                <span className="text-xs text-red-700 dark:text-red-300 font-medium">Errores / Ignorados</span>
                                            </div>
                                        </div>

                                        {importPreview.errors.length > 0 && (
                                            <button
                                                onClick={() => setShowErrorDetails(true)}
                                                className="text-sm text-indigo-600 dark:text-indigo-400 underline font-medium"
                                            >
                                                Ver detalles de errores ({importPreview.errors.length})
                                            </button>
                                        )}

                                        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded border border-gray-200 dark:border-gray-700">
                                            Nota: Los registros se deduplicarán automáticamente. Si un registro ya existe en la base de datos, no se duplicará.
                                        </p>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            onClick={() => setShowImportModal(false)}
                                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={confirmImport}
                                            disabled={importPreview.valid.length === 0 || isImporting}
                                            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isImporting ? 'Importando...' : `Importar ${importPreview.valid.length} movs`}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col h-full max-h-[400px]">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-bold text-red-600">Reporte de Errores</h4>
                                        <button onClick={() => setShowErrorDetails(false)} className="text-xs text-gray-500 hover:underline">Volver al resumen</button>
                                    </div>
                                    <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                        <table className="min-w-full text-xs text-left">
                                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                                <tr>
                                                    <th className="p-2 font-medium text-gray-500">Fila</th>
                                                    <th className="p-2 font-medium text-gray-500">Razón</th>
                                                    <th className="p-2 font-medium text-gray-500">Contenido Original</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {importPreview.errors.map((err: CsvRowError, idx) => (
                                                    <tr key={idx}>
                                                        <td className="p-2 font-mono text-gray-500">{err.row}</td>
                                                        <td className="p-2 text-red-600 font-medium">{err.reason}</td>
                                                        <td className="p-2 text-gray-400 font-mono truncate max-w-[150px]" title={err.raw}>{err.raw}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex flex-col h-[calc(100vh-340px)] min-h-[400px]">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                        <thead className="bg-gray-50 dark:bg-gray-900/90 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Monto</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span>Cargando movimientos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredMovements.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700/50 rounded-full flex items-center justify-center mb-4">
                                            <Landmark className="text-gray-400" size={32} />
                                        </div>
                                        <h3 className="text-base font-medium text-gray-900 dark:text-white">Sin movimientos</h3>
                                        <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                                            No hay registros para este criterio. Ajusta los filtros, crea un nuevo movimiento o importa un CSV.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredMovements.map(m => (
                                    <tr key={m.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                            {m.date}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${m.type === 'ingreso'
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                                }`}>
                                                {m.type === 'ingreso' ? 'Abono' : 'Cargo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium max-w-md truncate" title={m.concept}>
                                            {m.concept}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${m.type === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                            }`}>
                                            {formatCurrency(m.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleDelete(m.id)}
                                                className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="Eliminar registro"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Footer Summary in Table */}
                <div className="bg-gray-50 dark:bg-gray-800 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 font-medium">
                    <span>Mostrando {filteredMovements.length} movimientos</span>
                    <span className="hidden sm:inline">Ordenado por Fecha (Descendente)</span>
                </div>
            </div>
        </div>
    );
};

export const movimientosBancariosDefinition: ToolDefinition = {
    meta: {
        id: 'movimientos-bancarios',
        name: 'Movimientos Bancarios',
        description: 'Carga y captura movimientos bancarios para conciliación y cierre.',
        icon: Landmark,
        version: '1.0.0',
    },
    component: MovimientosBancariosTool,
};
