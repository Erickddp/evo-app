import React, { useState, useRef, useMemo, useEffect } from 'react';
import { FileCheck, Upload, FileText, AlertCircle, Download, Search, Loader2 } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { parseCfdiXml, type CfdiSummary } from './parser';
import { dataStore } from '../../core/data/dataStore';

export const CFDIValidatorTool: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [rows, setRows] = useState<CfdiSummary[]>([]);
    const [errors, setErrors] = useState<{ fileName: string; message: string }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterText, setFilterText] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
            // Reset state on new selection
            setRows([]);
            setErrors([]);
        }
    };

    const handleProcess = async () => {
        if (files.length === 0) return;

        setIsProcessing(true);
        setRows([]);
        setErrors([]);

        const newRows: CfdiSummary[] = [];
        const newErrors: { fileName: string; message: string }[] = [];

        try {
            const promises = files.map(async (file) => {
                try {
                    const text = await file.text();
                    const summary = parseCfdiXml(text, file.name);
                    newRows.push(summary);
                } catch (err: any) {
                    newErrors.push({
                        fileName: file.name,
                        message: err.message || 'Unknown error parsing file',
                    });
                }
            });

            await Promise.all(promises);

            setRows(newRows);
            setErrors(newErrors);

            // Save record to dataStore
            if (newRows.length > 0 || newErrors.length > 0) {
                void dataStore.saveRecord('cfdi-validator', {
                    totalFiles: files.length,
                    parsedRows: newRows.length,
                    rows: newRows,
                    errors: newErrors,
                    timestamp: new Date().toISOString(),
                });
            }

        } catch (e) {
            console.error("Critical error processing files", e);
        } finally {
            setIsProcessing(false);
        }
    };

    // Load previous session
    useEffect(() => {
        const load = async () => {
            try {
                const records = await dataStore.listRecords<{ rows: CfdiSummary[], errors: any[] }>('cfdi-validator');
                if (records.length > 0) {
                    // Sort by createdAt descending
                    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    const latest = records[0].payload;
                    if (latest.rows) setRows(latest.rows);
                    if (latest.errors) setErrors(latest.errors);
                }
            } catch (e) {
                console.error('Failed to load CFDI history', e);
            }
        };
        load();
    }, []);

    const handleExportCsv = () => {
        if (rows.length === 0) return;

        const header = [
            'Archivo', 'UUID', 'Serie', 'Folio', 'Fecha',
            'RFC Emisor', 'Nombre Emisor',
            'RFC Receptor', 'Nombre Receptor', 'UsoCFDI',
            'Moneda', 'SubTotal', 'Total',
            'TipoComprobante', 'FormaPago', 'MetodoPago'
        ].join(',');

        const csvRows = rows.map(r => {
            const fields = [
                r.fileName, r.uuid, r.serie, r.folio, r.fecha,
                r.emisorRfc, r.emisorNombre,
                r.receptorRfc, r.receptorNombre, r.usoCfdi,
                r.moneda, r.subtotal, r.total,
                r.tipoComprobante, r.formaPago, r.metodoPago
            ];
            // Escape quotes and wrap in quotes
            return fields.map(f => `"${(f || '').replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [header, ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `cfdi-resumen-${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const filteredRows = useMemo(() => {
        if (!filterText) return rows;
        const lowerFilter = filterText.toLowerCase();
        return rows.filter(r =>
            (r.fileName && r.fileName.toLowerCase().includes(lowerFilter)) ||
            (r.uuid && r.uuid.toLowerCase().includes(lowerFilter)) ||
            (r.emisorRfc && r.emisorRfc.toLowerCase().includes(lowerFilter)) ||
            (r.receptorRfc && r.receptorRfc.toLowerCase().includes(lowerFilter)) ||
            (r.emisorNombre && r.emisorNombre.toLowerCase().includes(lowerFilter)) ||
            (r.receptorNombre && r.receptorNombre.toLowerCase().includes(lowerFilter))
        );
    }, [rows, filterText]);

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-100 dark:border-blue-800">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
                    <FileCheck className="w-5 h-5" />
                    CFDI Batch Validator
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Select multiple XML files to parse, validate, and export to CSV.
                    Processes entirely in your browser.
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex gap-3 items-center w-full sm:w-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        multiple
                        accept=".xml"
                        // @ts-ignore
                        webkitdirectory=""
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                        <Upload className="w-4 h-4" />
                        Seleccionar XML
                    </button>

                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {files.length === 0 ? 'No files selected' : `${files.length} file${files.length === 1 ? '' : 's'} selected`}
                    </div>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleProcess}
                        disabled={files.length === 0 || isProcessing}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                        Procesar CFDI
                    </button>
                </div>
            </div>

            {/* File List (collapsed if too many, or just scrollable small area) */}
            {files.length > 0 && files.length < 20 && (
                <div className="max-h-32 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-500 font-mono">
                    {files.map((f, i) => (
                        <div key={i} className="truncate">{f.name}</div>
                    ))}
                </div>
            )}

            {/* Errors Panel */}
            {errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                    <h4 className="text-red-800 dark:text-red-200 font-medium text-sm flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        Errors ({errors.length})
                    </h4>
                    <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300 space-y-1 max-h-40 overflow-y-auto">
                        {errors.map((e, i) => (
                            <li key={i}>
                                <span className="font-semibold">{e.fileName}:</span> {e.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Results Area */}
            {(rows.length > 0 || filterText) && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Filtrar por RFC, UUID, nombre..."
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <button
                            onClick={handleExportCsv}
                            disabled={rows.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            Exportar CSV
                        </button>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    {['Archivo', 'Fecha', 'UUID', 'RFC Emisor', 'RFC Receptor', 'Total', 'FormaPago', 'MetodoPago'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredRows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-4 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap" title={row.fileName}>
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-3 h-3 text-gray-400" />
                                                <span className="truncate max-w-[150px]">{row.fileName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {row.fecha?.split('T')[0]}
                                        </td>
                                        <td className="px-4 py-2 text-xs font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap" title={row.uuid}>
                                            {row.uuid?.slice(0, 8)}...{row.uuid?.slice(-4)}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap" title={row.emisorNombre}>
                                            {row.emisorRfc}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap" title={row.receptorNombre}>
                                            {row.receptorRfc}
                                        </td>
                                        <td className="px-4 py-2 text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap text-right">
                                            {row.moneda} {Number(row.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {row.formaPago}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {row.metodoPago}
                                        </td>
                                    </tr>
                                ))}
                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                            No matching records found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="text-xs text-gray-400 text-right">
                        Showing {filteredRows.length} of {rows.length} records
                    </div>
                </div>
            )}
        </div>
    );
};

export const cfdiValidatorDefinition: ToolDefinition = {
    meta: {
        id: 'cfdi-validator',
        name: 'CFDI Validator',
        description: 'Validate structure and signature of CFDI 3.3/4.0 XML files.',
        icon: FileCheck,
        version: '1.0.0',
    },
    component: CFDIValidatorTool,
};
