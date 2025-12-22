import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Upload, X, Check, FileSpreadsheet } from 'lucide-react';
import { parseSatCsv, type ParsedSatResult, type SatImportRow } from '../utils/satParser';

interface SatImportModalProps {
    onClose: () => void;
    onImport: (rows: SatImportRow[], options: { mode: 'factura_only' | 'projected' | 'financial_real', overrideType?: 'ingreso' | 'gasto' }) => void;
    ownRfc?: string;
}

// Helper to get cached RFC specific to a profile ID (if provided) or global
const getCachedRfc = (profileId?: string) => {
    const key = profileId ? `evo_rfc_${profileId}` : 'evo_sat_rfc_last';
    return localStorage.getItem(key) || '';
};

const setCachedRfc = (rfc: string, profileId?: string) => {
    const key = profileId ? `evo_rfc_${profileId}` : 'evo_sat_rfc_last';
    if (rfc) localStorage.setItem(key, rfc);
};

export const SatImportModal: React.FC<SatImportModalProps & { profileId?: string }> = ({ onClose, onImport, ownRfc: propRfc, profileId }) => {
    const [step, setStep] = useState<'upload' | 'preview'>('upload');
    const [result, setResult] = useState<ParsedSatResult | null>(null);

    // Logic: Use prop first, then cache.
    const initialRfc = propRfc || getCachedRfc(profileId);
    const [ownRfc, setOwnRfc] = useState(initialRfc);

    // New State for Options
    const [importMode, setImportMode] = useState<'projected' | 'factura_only' | 'financial_real'>('projected');
    const [overrideType, setOverrideType] = useState<'auto' | 'ingreso' | 'gasto'>('auto');

    // If prop was provided, we might want to disable editing strictly, but usually users might want to override.
    // Prompt says: "Mostrar input solo si ownRfc no existe". 
    const isRfcLocked = !!propRfc;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ownRfc || ownRfc.length < 12) {
            alert("Debes ingresar un RFC válido para continuar.");
            e.target.value = '';
            return;
        }

        // Cache it if it wasn't from props
        if (!isRfcLocked) {
            setCachedRfc(ownRfc, profileId);
        }

        const text = await file.text();
        const parsed = await parseSatCsv(text, ownRfc);
        setResult(parsed);
        setStep('preview');
    };

    const handleConfirm = () => {
        if (!result) return;
        // If override is enabled, we might want to include ambiguous records that are now valid?
        // For now, simpler: user fixes RFC or uses logic. 
        // Wait, requirements say: "allow rescuing ambiguous".
        // If override != 'auto', we can include ambiguous rows as they will be forced to a type.

        let rowsToImport = [...result.valid];
        if (overrideType !== 'auto') {
            // Add 'ambiguous' rows to import list, they will be forced by saveSatInvoices logic
            rowsToImport = [...rowsToImport, ...result.ambiguous];
        }

        onImport(rowsToImport, {
            mode: importMode,
            overrideType: overrideType === 'auto' ? undefined : overrideType
        });
        onClose();
    };

    const handleRetry = () => {
        setResult(null);
        setStep('upload');
    };

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <FileSpreadsheet size={20} className="text-emerald-500" />
                        Importar Facturas SAT
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {step === 'upload' ? (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                                <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={16} /> Configuración Requerida
                                </h4>
                                {!isRfcLocked ? (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Tu RFC (Obligatorio para clasificar):
                                        </label>
                                        <input
                                            type="text"
                                            value={ownRfc}
                                            onChange={e => setOwnRfc(e.target.value.toUpperCase())}
                                            placeholder="AAA010101AAA"
                                            className="w-full max-w-xs px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
                                        />
                                        <p className="text-xs text-slate-500">Se usará para determinar si una factura es Ingreso o Gasto.</p>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        RFC detectado: <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{ownRfc}</span>
                                    </div>
                                )}
                            </div>

                            <div className={`border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors relative ${!ownRfc ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                <input
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleFileChange}
                                    disabled={!ownRfc}
                                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                />
                                <Upload size={48} className="text-slate-400 mb-4" />
                                <h4 className="text-lg font-medium text-slate-700 dark:text-slate-200">
                                    Arrastra tu CSV del SAT aquí
                                </h4>
                                <p className="text-slate-500 dark:text-slate-400 mt-2">
                                    {ownRfc ? 'o haz clic para seleccionar archivo' : 'Ingresa tu RFC arriba para habilitar'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <SummaryCard label="Ingresos" count={result?.valid.filter(r => r.type === 'ingreso').length || 0} color="emerald" />
                                <SummaryCard label="Gastos" count={result?.valid.filter(r => r.type === 'gasto').length || 0} color="blue" />
                                <SummaryCard label="Ambiguos" count={result?.ambiguous.length || 0} color="amber" />
                                <SummaryCard label="Canceladas" count={result?.cancelled.length || 0} color="gray" />
                            </div>

                            {/* Ambiguous Warning */}
                            {result?.ambiguous.length ? (
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <h5 className="font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                                        <AlertTriangle size={16} /> {result.ambiguous.length} Facturas Ambiguas
                                    </h5>
                                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                                        No coinciden con tu RFC ({ownRfc}) ni como emisor ni receptor. No se importarán.
                                    </p>
                                    <div className="max-h-[150px] overflow-auto border border-amber-200 dark:border-amber-800 rounded bg-white dark:bg-slate-900 text-xs">
                                        <table className="w-full text-left">
                                            <thead className="bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-medium sticky top-0">
                                                <tr>
                                                    <th className="p-1">UUID</th>
                                                    <th className="p-1">Emisor</th>
                                                    <th className="p-1">Receptor</th>
                                                    <th className="p-1 text-right">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.ambiguous.map((row, i) => (
                                                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800 text-slate-500">
                                                        <td className="p-1 truncate max-w-[80px]">{row.uuid.slice(-8)}</td>
                                                        <td className="p-1">{row.rfcEmisor}</td>
                                                        <td className="p-1">{row.rfcReceptor}</td>
                                                        <td className="p-1 text-right">{row.montoNumber}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button onClick={handleRetry} className="mt-2 text-sm text-amber-600 hover:text-amber-700 underline">
                                        ¿RFC Incorrecto? Reintentar
                                    </button>
                                </div>
                            ) : null}

                            {/* Preview Table (Valid Only) */}
                            {result?.valid.length ? (
                                <div>
                                    <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Vista Previa (Se importarán {result.valid.length})</h4>
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 sticky top-0">
                                                <tr>
                                                    <th className="p-2">Fecha</th>
                                                    <th className="p-2">Tipo</th>
                                                    <th className="p-2">Contraparte</th>
                                                    <th className="p-2 text-right">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.valid.slice(0, 50).map((row, i) => (
                                                    <tr key={i} className="border-t border-slate-200 dark:border-slate-800">
                                                        <td className="p-2 truncate max-w-[100px]">{row.fechaEmisionISODate}</td>
                                                        <td className="p-2">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.type === 'ingreso' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                                                {row.type.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 truncate max-w-[150px]">
                                                            {row.type === 'ingreso' ? row.nombreReceptor : row.nombreEmisor}
                                                        </td>
                                                        <td className="p-2 text-right font-mono">
                                                            {row.montoNumber.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {result.valid.length > 50 && (
                                            <div className="p-2 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800">
                                                ... y {result.valid.length - 50} más
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    No hay registros válidos para importar.
                                </div>
                            )}

                            {/* Errors List */}
                            {result?.errors.length ? (
                                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 text-sm overflow-auto max-h-[150px]">
                                    <h5 className="font-bold text-red-800 dark:text-red-300 mb-2">Errores ({result.errors.length})</h5>
                                    <ul className="list-disc pl-4 space-y-1 text-red-700 dark:text-red-400">
                                        {result.errors.slice(0, 10).map((err, i) => (
                                            <li key={i}>Fila {err.row}: {err.reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                {/* --- OPTIONS AREA (New) --- */}
                {step === 'preview' && (
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. Import Mode Slector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Modo de Importación
                            </label>
                            <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setImportMode('projected')}
                                    className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${importMode === 'projected' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    Proyección
                                </button>
                                <button
                                    onClick={() => setImportMode('factura_only')}
                                    className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${importMode === 'factura_only' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    Solo Facturas
                                </button>
                                <button
                                    onClick={() => setImportMode('financial_real')}
                                    className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${importMode === 'financial_real' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    Real (Efectivo)
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {importMode === 'projected' && "Afecta dashboard, pero se oculta al conciliar."}
                                {importMode === 'factura_only' && "No afecta dashboard financiero. Solo repositorio."}
                                {importMode === 'financial_real' && "Afecta dashboard financiero inmediatamente."}
                            </p>
                        </div>

                        {/* 2. Override Type Selector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Forzar Clasificación
                            </label>
                            <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setOverrideType('auto')}
                                    className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${overrideType === 'auto' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    Auto (RFC)
                                </button>
                                <button
                                    onClick={() => setOverrideType('ingreso')}
                                    className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${overrideType === 'ingreso' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    Todo Ingreso
                                </button>
                                <button
                                    onClick={() => setOverrideType('gasto')}
                                    className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${overrideType === 'gasto' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    Todo Gasto
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {overrideType === 'auto' ? "Clasificación automática basada en RFC." : `Forzará TODAS las facturas (incl. ambiguas) a ${overrideType.toUpperCase()}.`}
                            </p>
                        </div>
                    </div>
                )}


                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    {step === 'preview' && result && result.valid.length > 0 && (
                        <button
                            onClick={handleConfirm}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow transition-colors flex items-center gap-2"
                        >
                            <Check size={16} />
                            Importar {result.valid.length} Registros
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const SummaryCard = ({ label, count, color }: { label: string, count: number, color: string }) => {
    const colorClasses = {
        emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        gray: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    };

    return (
        <div className={`p-3 rounded-lg border text-center ${colorClasses[color as keyof typeof colorClasses]}`}>
            <div className="text-xs uppercase tracking-wide font-semibold opacity-80">{label}</div>
            <div className="text-2xl font-bold mt-1">{count}</div>
        </div>
    );
};

