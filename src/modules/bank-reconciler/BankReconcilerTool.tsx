import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parsePdfStatement } from './pdfParser';
import type { ParsedPdfResult, BankMovement } from './types';
import { downloadMovementsAsCsv, buildBackupCsvFilename } from './csvExport';

export const BankReconcilerTool: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<ParsedPdfResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        setFile(selected);
        setResult(null);
        setError(null);
        e.target.value = ''; // Reset input
    };

    const handleProcess = async () => {
        if (!file) return;

        setIsProcessing(true);
        setError(null);

        try {
            // Simular un pequeño delay para feedback visual
            await new Promise(resolve => setTimeout(resolve, 500));

            const parsed = await parsePdfStatement(file);
            if (parsed.movements.length === 0) {
                throw new Error("No se encontraron movimientos en el archivo.");
            }
            setResult(parsed);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Error al procesar el archivo.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!result) return;
        const filename = buildBackupCsvFilename(result.summary.periodStart);
        downloadMovementsAsCsv(result.movements, filename);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center animate-in fade-in duration-500">

            {/* Header Minimalista */}
            <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Conciliación Bancaria</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Convierte tu estado de cuenta BBVA a CSV en segundos.</p>
            </div>

            {/* Estado 1: Sin archivo o con archivo seleccionado (antes de procesar) */}
            {!result && (
                <div className="w-full max-w-md space-y-6">

                    <input
                        type="file"
                        accept=".pdf"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {!file ? (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="group relative flex flex-col items-center justify-center w-full h-48 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-gray-50 dark:bg-gray-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all duration-300 cursor-pointer"
                        >
                            <div className="p-4 rounded-full bg-white dark:bg-gray-800 shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <span className="text-lg font-medium text-gray-900 dark:text-white">Cargar archivo</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">PDF de estado de cuenta BBVA</span>
                        </button>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-center gap-3 mb-6">
                                <FileText className="w-10 h-10 text-indigo-500" />
                                <div className="text-left">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Archivo seleccionado</p>
                                    <p className="text-lg font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{file.name}</p>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-lg text-sm flex items-center justify-center gap-2">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setFile(null)}
                                    disabled={isProcessing}
                                    className="flex-1 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleProcess}
                                    disabled={isProcessing}
                                    className="flex-1 px-4 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Procesando...
                                        </>
                                    ) : (
                                        "Procesar archivo"
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Estado 3: Resultado Final */}
            {result && (
                <div className="w-full max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

                        {/* Header Card */}
                        <div className="bg-indigo-600 p-6 text-white text-left">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <CheckCircle className="w-6 h-6 text-indigo-300" />
                                        Procesamiento Exitoso
                                    </h3>
                                    <p className="text-indigo-100 mt-1 text-sm">
                                        Periodo: {result.summary.periodStart} al {result.summary.periodEnd}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-indigo-200 text-xs uppercase tracking-wider">Cuenta</p>
                                    <p className="font-mono font-medium">{result.summary.accountNumber}</p>
                                </div>
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                            <div className="bg-white dark:bg-gray-800 p-4 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Movimientos</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{result.movements.length}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Abonos</p>
                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(result.summary.totalCredits)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Cargos</p>
                                <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(result.summary.totalDebits)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Saldo Final</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(result.summary.endingBalance)}</p>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-8 bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center gap-4">
                            <button
                                onClick={handleDownload}
                                className="w-full md:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/30 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
                            >
                                <Download className="w-6 h-6" />
                                Descargar CSV
                            </button>

                            <button
                                onClick={() => { setResult(null); setFile(null); }}
                                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline decoration-dotted"
                            >
                                Procesar otro archivo
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};
