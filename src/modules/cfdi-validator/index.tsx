import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileCheck, Upload, FileText, AlertCircle, Download, Search, Loader2, ArrowUpDown } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { parseCfdiXml, type CfdiSummary } from './parser';
import { evoStore } from '../../core/evoappDataStore';
import { Save } from 'lucide-react';
import { normalizeToRegistroFinanciero } from '../core/normalize/normalizeToRegistroFinanciero';
import { JourneyToolHeader } from '../core/journey/components/JourneyToolHeader';
import { toMonthKey } from '../core/utils/month';

export const CFDIValidatorTool: React.FC = () => {
    // Journey Context
    const [searchParams] = useSearchParams();
    const urlMonth = searchParams.get('month');
    const currentMonth = toMonthKey(urlMonth) || new Date().toISOString().slice(0, 7);

    const [files, setFiles] = useState<File[]>([]);
    const [rows, setRows] = useState<CfdiSummary[]>([]);
    const [errors, setErrors] = useState<{ fileName: string; message: string }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [targetRfc, setTargetRfc] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof CfdiSummary; direction: 'asc' | 'desc' } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load RFC from local storage
    useEffect(() => {
        const savedRfc = localStorage.getItem('cfdi_validator_rfc');
        if (savedRfc) setTargetRfc(savedRfc);
    }, []);

    const handleRfcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase();
        setTargetRfc(val);
        localStorage.setItem('cfdi_validator_rfc', val);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const xmlFiles = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.xml'));
            setFiles(xmlFiles);
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
                    const summary = parseCfdiXml(text, file.name, targetRfc);
                    newRows.push(summary);
                } catch (err: any) {
                    newErrors.push({
                        fileName: file.name,
                        message: err.message || 'Error desconocido al analizar el archivo',
                    });
                }
            });

            await Promise.all(promises);

            setRows(newRows);
            setErrors(newErrors);

        } catch (e) {
            console.error("Critical error processing files", e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExportCsv = () => {
        if (rows.length === 0) return;

        const header = [
            'Archivo', 'UUID', 'Tipo', 'Estatus', 'Serie', 'Folio', 'Fecha',
            'RFC Emisor', 'Nombre Emisor',
            'RFC Receptor', 'Nombre Receptor', 'UsoCFDI',
            'Moneda', 'SubTotal', 'Total',
            'Imp. Trasladados', 'Imp. Retenidos',
            'TipoComprobante', 'FormaPago', 'MetodoPago'
        ].join(',');

        const csvRows = rows.map(r => {
            const fields = [
                r.fileName, r.uuid, r.type, r.status, r.serie, r.folio, r.fecha,
                r.emisorRfc, r.emisorNombre,
                r.receptorRfc, r.receptorNombre, r.usoCfdi,
                r.moneda, r.subtotal, r.total,
                r.totalImpuestosTrasladados, r.totalImpuestosRetenidos,
                r.tipoComprobante, r.formaPago, r.metodoPago
            ];
            // Escape quotes and wrap in quotes
            return fields.map(f => `"${(f === undefined || f === null ? '' : String(f)).replace(/"/g, '""')}"`).join(',');
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

    const handleSaveToUnifiedModel = async () => {
        if (rows.length === 0) return;

        try {
            // 1. Load existing canonical records for duplicate check
            const allRecords = await evoStore.registrosFinancieros.getAll();
            let addedCount = 0;
            let updatedCount = 0;

            for (const row of rows) {
                if (!row.uuid) continue;

                // Adapt CfdiSummary to Normalizer Input
                const normalizerInput = {
                    invoiceDate: row.fecha,
                    amount: row.total ? parseFloat(row.total) : 0,
                    rfc: row.emisorRfc, // This is ambiguous for normalizer without context, but we pass full details in metadata
                    uuid: row.uuid,
                    folio: row.folio,
                    concept: `${row.emisorNombre || row.emisorRfc} - CFDI`,
                    // Hints for normalizer
                    type: row.type === 'Emitted' ? 'ingreso' : row.type === 'Received' ? 'gasto' : undefined,
                    source: 'cfdi' as const
                };

                // Use Normalizer
                const cfr = normalizeToRegistroFinanciero(normalizerInput, {
                    // Explicitly override inferred type if we know it from CFDI classification
                    defaultType: row.type === 'Emitted' ? 'ingreso' : 'gasto',
                    defaultSource: 'cfdi'
                });

                // Dedupe Logic (UUID)
                const existingIdx = allRecords.findIndex(r => r.links?.xmlUuid === row.uuid || r.metadata?.uuid === row.uuid);

                if (existingIdx >= 0) {
                    // Update existing? "Si existe: actualizar metadata y updatedAt"
                    const existing = allRecords[existingIdx];
                    const updated = {
                        ...existing,
                        updatedAt: new Date().toISOString(),
                        // Merge metadata?
                        metadata: {
                            ...existing.metadata,
                            ...cfr.metadata,
                            // Ensure we keep specific CFDI fields
                            fileName: row.fileName,
                            tipoComprobante: row.tipoComprobante
                        },
                        // Maybe update links if missing
                        links: {
                            ...existing.links,
                            xmlUuid: row.uuid
                        }
                    };
                    // In-memory update for batch save?
                    // evoStore doesn't strictly support batch update via `add`, but we can putMany later or update individually.
                    // To avoid O(N^2) writes if using `saveAll` repeatedly, we should batch.
                    // But evoStore.registrosFinancieros.add() does a full read-write cycle!
                    // We must use `putMany` logic or modify the loaded array and save once.
                    allRecords[existingIdx] = updated;
                    updatedCount++;
                } else {
                    // Add new
                    // Enhance metadata
                    cfr.metadata = {
                        ...cfr.metadata,
                        fileName: row.fileName,
                        rfcEmisor: row.emisorRfc,
                        rfcReceptor: row.receptorRfc,
                        tipoComprobante: row.tipoComprobante
                    };
                    allRecords.push(cfr);
                    addedCount++;
                }
            }

            if (addedCount === 0 && updatedCount === 0) {
                alert('No hay cambios. Todos los movimientos ya existen.');
                return;
            }

            // Batch Save
            await evoStore.registrosFinancieros.saveAll(allRecords);

            // Emit update event -> Handled by saveAll (data:changed)

            alert(`Proceso completado: ${addedCount} nuevos, ${updatedCount} actualizados.`);

        } catch (e) {
            console.error('Error saving to unified model', e);
            alert('Error al guardar movimientos.');
        }
    };

    const handleSort = (key: keyof CfdiSummary) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredRows = useMemo(() => {
        let result = rows;
        if (filterText) {
            const lowerFilter = filterText.toLowerCase();
            result = result.filter(r =>
                (r.fileName && r.fileName.toLowerCase().includes(lowerFilter)) ||
                (r.uuid && r.uuid.toLowerCase().includes(lowerFilter)) ||
                (r.emisorRfc && r.emisorRfc.toLowerCase().includes(lowerFilter)) ||
                (r.receptorRfc && r.receptorRfc.toLowerCase().includes(lowerFilter)) ||
                (r.emisorNombre && r.emisorNombre.toLowerCase().includes(lowerFilter)) ||
                (r.receptorNombre && r.receptorNombre.toLowerCase().includes(lowerFilter))
            );
        }

        if (sortConfig) {
            result = [...result].sort((a, b) => {
                const aVal = a[sortConfig.key] || '';
                const bVal = b[sortConfig.key] || '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [rows, filterText, sortConfig]);

    const formatCurrency = (val: string | number | undefined) => {
        if (!val) return '-';
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? val : num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    };

    return (
        <div className="space-y-6">
            <JourneyToolHeader
                currentMonth={currentMonth}
                title="Validador Masivo de CFDI"
                subtitle="Selecciona múltiples archivos XML para analizar, validar y exportar a CSV."
            />

            {/* Controls */}
            <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">

                {/* RFC Input */}
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="w-full sm:w-64">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Tu RFC (para clasificación)
                        </label>
                        <input
                            type="text"
                            value={targetRfc}
                            onChange={handleRfcChange}
                            placeholder="XAXX010101000"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                        />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 pb-2">
                        Ingresa tu RFC para identificar automáticamente facturas Emitidas y Recibidas.
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
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
                            {files.length === 0 ? 'Sin archivos' : `${files.length} archivo${files.length === 1 ? '' : 's'} seleccionados`}
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
            </div>

            {/* File List (collapsed if too many) */}
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
                        Errores ({errors.length})
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
                        <button
                            onClick={handleSaveToUnifiedModel}
                            disabled={rows.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
                        >
                            <Save className="w-4 h-4" />
                            Guardar en Movimientos
                        </button>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    {[
                                        { k: 'fileName', l: 'Archivo' },
                                        { k: 'type', l: 'Clasificación' },
                                        { k: 'fecha', l: 'Fecha' },
                                        { k: 'emisorRfc', l: 'Emisor' },
                                        { k: 'receptorRfc', l: 'Receptor' },
                                        { k: 'uuid', l: 'UUID' },
                                        { k: 'total', l: 'Total' },
                                        { k: 'conceptCount', l: 'Conceptos' }
                                    ].map(h => (
                                        <th
                                            key={h.k}
                                            onClick={() => handleSort(h.k as keyof CfdiSummary)}
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                            <div className="flex items-center gap-1">
                                                {h.l}
                                                <ArrowUpDown className="w-3 h-3" />
                                            </div>
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
                                        <td className="px-4 py-2 text-xs whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${row.type === 'Emitted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                row.type === 'Received' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                }`}>
                                                {row.type === 'Emitted' ? 'Emitido' : row.type === 'Received' ? 'Recibido' : 'Desconocido'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {row.fecha?.split('T')[0]}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap min-w-[150px]" title={row.emisorNombre}>
                                            {row.emisorRfc}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap min-w-[150px]" title={row.receptorNombre}>
                                            {row.receptorRfc}
                                        </td>
                                        <td className="px-4 py-2 text-xs font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap" title={row.uuid}>
                                            {row.uuid?.slice(0, 8)}...{row.uuid?.slice(-4)}
                                        </td>
                                        <td className="px-4 py-2 text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap text-right">
                                            {formatCurrency(row.total)}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap text-center">
                                            {row.conceptCount}
                                        </td>
                                    </tr>
                                ))}
                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                            No se encontraron registros coincidentes
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="text-xs text-gray-400 text-right">
                        Mostrando {filteredRows.length} de {rows.length} registros
                    </div>
                </div>
            )}
        </div>
    );
};

export const cfdiValidatorDefinition: ToolDefinition = {
    meta: {
        id: 'cfdi-validator',
        name: 'Validador de Facturas',
        description: 'Valida estructura y firma de archivos XML CFDI 3.3/4.0.',
        icon: FileCheck,
        version: '1.1.0',
    },
    component: CFDIValidatorTool,
};
