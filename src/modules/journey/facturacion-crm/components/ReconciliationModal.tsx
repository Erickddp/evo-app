import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Link2, Check } from 'lucide-react';
import { evoStore } from '../../../../core/evoappDataStore';
import { formatCurrency } from '../../movimientos-bancarios/utils';
import type { Invoice } from '../types';
import type { RegistroFinanciero } from '../../../../core/evoappDataModel';

interface ReconciliationModalProps {
    invoice: Invoice;
    onClose: () => void;
    onReconcile: (bankMovementId: string) => Promise<void>;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({ invoice, onClose, onReconcile }) => {
    const [candidates, setCandidates] = useState<RegistroFinanciero[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        const loadCandidates = async () => {
            setLoading(true);
            const all = await evoStore.registrosFinancieros.getAll();

            // Filter candidates:
            // 1. Source in bank, manual, csv (NOT facturacion-crm or sat-import)
            // 2. Not already reconciled (links.facturaId is falsy)
            // 3. Date proximity (± 5 days)
            // 4. Amount similarity (± 1.00)

            const invDate = new Date(invoice.invoiceDate);
            const invAmount = invoice.amount;

            const matches = all.filter((r: RegistroFinanciero) => {
                if (r.source === 'facturacion-crm' || r.source === 'sat-import') return false;
                if (r.links?.facturaId || r.links?.reconciledTo) return false; // Already linked?

                // Date check
                const rDate = new Date(r.date);
                const diffTime = Math.abs(rDate.getTime() - invDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 5) return false;

                // Amount check
                const diffAmount = Math.abs(r.amount - invAmount);
                if (diffAmount > 1.0) return false;

                return true;
            });

            setCandidates(matches);
            setLoading(false);
        };
        loadCandidates();
    }, [invoice]);

    const handleConfirm = () => {
        if (selectedId) {
            onReconcile(selectedId);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Link2 size={20} className="text-indigo-500" />
                        Conciliar con Banco
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Factura Seleccionada:</p>
                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800">
                        <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">{invoice.concept || 'Factura sin concepto'}</div>
                            <div className="text-xs text-slate-500">{invoice.folio} • {invoice.clientName}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                                {formatCurrency(invoice.amount)}
                            </div>
                            <div className="text-xs text-slate-500">{invoice.invoiceDate}</div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Movimientos Bancarios Sugeridos</h4>

                    {loading ? (
                        <div className="flex justify-center py-8"><span className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></span></div>
                    ) : candidates.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                            No se encontraron movimientos coincidentes (±5 días, mismo monto).
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {candidates.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => setSelectedId(c.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center group ${selectedId === c.id
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 h-4 w-4 rounded-full border flex items-center justify-center ${selectedId === c.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-400'}`}>
                                            {selectedId === c.id && <Check size={10} className="text-white" />}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-slate-100">{c.concept}</div>
                                            <div className="text-xs text-slate-500">{c.source.toUpperCase()} • {c.date}</div>
                                        </div>
                                    </div>
                                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                        {formatCurrency(c.amount)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={!selectedId}
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow transition-colors flex items-center gap-2"
                    >
                        <Link2 size={16} />
                        Confirmar Vínculo
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
