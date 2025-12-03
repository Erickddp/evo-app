import React, { useState, useRef } from 'react';
import { Upload, FileText, ArrowRight, Save, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { parseBankStatementPdf } from '../../services/bankPdfParser';
import type { BankMovement as SharedBankMovement } from '../../types/bank';
import { dataStore } from '../../core/data/dataStore';

// --- Types ---

type MovementType = 'income' | 'expense';

interface BankMovement {
    id: string;
    date: string;        // ISO or original string
    description: string;
    amount: number;      // numeric value
    type: MovementType;
}

interface ColumnMapping {
    date: number;        // column index
    description: number; // column index
    amount: number;      // column index
}

type Step = 'upload' | 'map' | 'review' | 'pdf-preview';

// --- Helper Functions ---

function formatCurrency(amount: number): string {
    return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// --- Component ---

export const BankReconciler: React.FC = () => {
    const [step, setStep] = useState<Step>('upload');
    const [rawCsv, setRawCsv] = useState<string[][]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<ColumnMapping>({ date: -1, description: -1, amount: -1 });
    const [movements, setMovements] = useState<BankMovement[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');

    const [pdfMovements, setPdfMovements] = useState<SharedBankMovement[]>([]);
    const [pdfCsvContent, setPdfCsvContent] = useState<string>('');
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    // --- Handlers ---

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseCsv(text);
        };
        reader.readAsText(file);
    };

    const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingPdf(true);
        setErrorMessage('');
        setSaveStatus('idle');

        try {
            const { movements, csvContent } = await parseBankStatementPdf(file);
            setPdfMovements(movements);
            setPdfCsvContent(csvContent);
            setStep('pdf-preview');
        } catch (error: any) {
            setErrorMessage(error.message || 'Error al procesar el PDF.');
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 5000);
        } finally {
            setIsProcessingPdf(false);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
    };

    const handleDownloadCsv = () => {
        const blob = new Blob([pdfCsvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `bank_statement_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUsePdfMovements = () => {
        const mapped: BankMovement[] = pdfMovements.map((m, idx) => ({
            id: `mov-pdf-${Date.now()}-${idx}`,
            date: m.operationDate,
            description: m.description,
            amount: m.amount,
            type: m.direction === 'abono' ? 'income' : 'expense'
        }));
        setMovements(mapped);
        setStep('review');
    };

    const parseCsv = (text: string) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const parsed: string[][] = [];

        lines.forEach(line => {
            // robust split handling quotes
            const row: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    row.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            row.push(current.trim());
            parsed.push(row);
        });

        if (parsed.length > 0) {
            setHeaders(parsed[0]);
            setRawCsv(parsed.slice(1));
            guessMapping(parsed[0]);
            setStep('map');
        }
    };

    const guessMapping = (headerRow: string[]) => {
        const lowerHeaders = headerRow.map(h => h.toLowerCase());

        const dateIdx = lowerHeaders.findIndex(h => h.includes('date') || h.includes('fecha'));
        const descIdx = lowerHeaders.findIndex(h => h.includes('description') || h.includes('desc') || h.includes('concepto'));
        const amountIdx = lowerHeaders.findIndex(h => h.includes('amount') || h.includes('monto') || h.includes('importe'));

        setMapping({
            date: dateIdx !== -1 ? dateIdx : 0,
            description: descIdx !== -1 ? descIdx : 1,
            amount: amountIdx !== -1 ? amountIdx : 2,
        });
    };

    const handleConfirmMapping = () => {
        if (mapping.date === -1 || mapping.description === -1 || mapping.amount === -1) {
            alert('Please map all columns.');
            return;
        }

        const finalMovements: BankMovement[] = rawCsv.map((row, idx) => {
            const dateStr = row[mapping.date] || '';
            const descStr = row[mapping.description] || '';
            const amountStr = row[mapping.amount] || '0';
            const cleanAmount = amountStr.replace(/[^0-9.-]/g, '');
            const val = parseFloat(cleanAmount) || 0;

            return {
                id: `mov-${Date.now()}-${idx}`,
                date: dateStr,
                description: descStr,
                amount: val,
                type: (val >= 0 ? 'income' : 'expense') as MovementType
            };
        });

        setMovements(finalMovements);
        setStep('review');
    };

    const handleSave = async () => {
        setSaveStatus('saving');
        try {
            // 1. Load existing Ingresos Manager data
            const records = await dataStore.listRecords<{ movements: any[] }>('ingresos-manager');
            // Sort by createdAt descending
            records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const existingMovements = records.length > 0 ? (records[0].payload.movements || []) : [];

            // 2. Map new movements
            const newRecords = movements.map(m => ({
                id: m.id,
                date: m.date,
                concept: m.description,
                amount: m.amount
            }));

            // 3. Combine and Save Snapshot
            const combined = [...newRecords, ...existingMovements];

            // Calculate stats for the snapshot
            const totalIncome = combined.reduce((acc, m) => m.amount > 0 ? acc + m.amount : acc, 0);
            const totalExpense = combined.reduce((acc, m) => m.amount < 0 ? acc + Math.abs(m.amount) : acc, 0);
            const netBalance = totalIncome - totalExpense;

            await dataStore.saveRecord('ingresos-manager', {
                movements: combined,
                stats: { totalIncome, totalExpense, netBalance },
                movementsCount: combined.length,
                updatedAt: new Date().toISOString(),
            });

            // 4. (Optional) Save Bank Reconciler history
            await dataStore.saveRecord('bank-reconciler', {
                action: 'import',
                movementsAdded: newRecords.length,
                timestamp: new Date().toISOString()
            });

            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) {
            console.error(e);
            setSaveStatus('error');
            setErrorMessage('Failed to save movements.');
        }
    };

    // --- Render Helpers ---

    const stats = {
        income: movements.filter(m => m.amount > 0).reduce((acc, m) => acc + m.amount, 0),
        expense: movements.filter(m => m.amount < 0).reduce((acc, m) => acc + Math.abs(m.amount), 0),
        count: movements.length
    };
    const net = stats.income - stats.expense;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Bank Reconciler</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Import bank movements from CSV and classify them.</p>
                </div>
                <div className="flex gap-3">
                    <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm"
                    >
                        <Upload size={16} /> Upload CSV
                    </button>
                    <input
                        type="file"
                        accept="application/pdf"
                        ref={pdfInputRef}
                        className="hidden"
                        onChange={handlePdfFileChange}
                    />
                    <button
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isProcessingPdf}
                        className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessingPdf ? (
                            <span>Procesando PDF...</span>
                        ) : (
                            <>
                                <FileText size={16} /> Upload PDF
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Step 1: Upload Placeholder (if needed, but we have button above) */}
            {step === 'upload' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No file selected</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload a CSV file to get started.</p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-6 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300"
                    >
                        Select File
                    </button>
                </div>
            )}

            {/* Step 2: Mapping */}
            {step === 'map' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Map Columns</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Column</label>
                            <select
                                value={mapping.date}
                                onChange={(e) => setMapping({ ...mapping, date: Number(e.target.value) })}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2"
                            >
                                {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description Column</label>
                            <select
                                value={mapping.description}
                                onChange={(e) => setMapping({ ...mapping, description: Number(e.target.value) })}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2"
                            >
                                {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Column</label>
                            <select
                                value={mapping.amount}
                                onChange={(e) => setMapping({ ...mapping, amount: Number(e.target.value) })}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2"
                            >
                                {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleConfirmMapping}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm"
                        >
                            Next <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                            <div className="text-xs text-green-600 dark:text-green-400 font-medium uppercase">Total Income</div>
                            <div className="text-xl font-bold text-green-700 dark:text-green-300">{formatCurrency(stats.income)}</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800">
                            <div className="text-xs text-red-600 dark:text-red-400 font-medium uppercase">Total Expenses</div>
                            <div className="text-xl font-bold text-red-700 dark:text-red-300">{formatCurrency(stats.expense)}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase">Net Balance</div>
                            <div className={`text-xl font-bold ${net >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(net)}
                            </div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase">Movements</div>
                            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.count}</div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {movements.map((m) => (
                                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{m.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{m.description}</td>
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
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-4 items-center">
                        {saveStatus === 'success' && (
                            <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                                <CheckCircle size={16} /> Saved successfully!
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1">
                                <AlertCircle size={16} /> {errorMessage}
                            </span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saveStatus === 'saving' || saveStatus === 'success'}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saveStatus === 'saving' ? 'Saving...' : 'Save to Movements Manager'}
                            {saveStatus !== 'saving' && <Save size={16} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Step: PDF Preview */}
            {step === 'pdf-preview' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Vista Previa del PDF</h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Movimientos detectados</div>
                                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{pdfMovements.length}</div>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                <div className="text-sm text-green-600 dark:text-green-400 font-medium">Abonos</div>
                                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                                    {pdfMovements.filter(m => m.direction === 'abono').length}
                                </div>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                <div className="text-sm text-red-600 dark:text-red-400 font-medium">Cargos</div>
                                <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                                    {pdfMovements.filter(m => m.direction === 'cargo').length}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[400px] border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha oper.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha liq.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saldo después</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {pdfMovements.map((m, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{m.operationDate}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{m.liquidationDate}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{m.description}</td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium ${m.direction === 'abono' ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(m.amount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.direction === 'abono'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                    }`}>
                                                    {m.direction === 'abono' ? 'Abono' : 'Cargo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                                                {m.balanceAfter != null ? formatCurrency(m.balanceAfter) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-4">
                            <button
                                onClick={handleDownloadCsv}
                                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
                            >
                                <Download size={16} /> Descargar CSV
                            </button>
                            <button
                                onClick={handleUsePdfMovements}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm"
                            >
                                Usar en conciliación <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
