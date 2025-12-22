import React, { useMemo, useState } from 'react';
import {
    MoreVertical, FileText, CheckCircle, Clock, XCircle, Copy, Trash2,
    Calendar, Link2, FileSpreadsheet
} from 'lucide-react';
import { SatImportModal } from './SatImportModal';
import { ReconciliationModal } from './ReconciliationModal';
import type { Invoice } from '../types';

interface InvoiceListProps {
    invoices: Invoice[];
    onSelectInvoice: (invoice: Invoice) => void;
    onDelete: (id: string) => void;
    onDuplicate: (invoice: Invoice) => void;
    // New Props
    stats?: { label: string; value: string | number; color: string }[];
    onImportSat?: (rows: any[]) => void;
    onReconcile?: (invoiceId: string, bankId: string) => Promise<void>;
    ownRfc?: string;
    profileId?: string;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ invoices, onSelectInvoice, onDelete, onDuplicate, onImportSat, onReconcile, ownRfc, profileId }) => {
    const [filterText, setFilterText] = useState('');
    // Remove month filter UI, as it is handled by parent/Journey
    const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

    const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
    const [showSatModal, setShowSatModal] = useState(false);
    const [reconcileInvoice, setReconcileInvoice] = useState<Invoice | null>(null);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchesText =
                inv.folio.toLowerCase().includes(filterText.toLowerCase()) ||
                inv.clientName.toLowerCase().includes(filterText.toLowerCase()) ||
                inv.rfc.toLowerCase().includes(filterText.toLowerCase()) ||
                (inv.concept || '').toLowerCase().includes(filterText.toLowerCase());

            const matchesStatus =
                filterStatus === 'all' ? true :
                    filterStatus === 'paid' ? (inv.paid || inv.status === 'Pagada') :
                        (!inv.paid && inv.status !== 'Pagada');

            // Month filtering is already done by parent passing 'invoices' subset
            return matchesText && matchesStatus;
        }).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
    }, [invoices, filterText, filterStatus]);

    // Helper to toggle menu
    const toggleMenu = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setShowActionsMenu(showActionsMenu === id ? null : id);
    };

    // Helper to render Status Badge
    const renderStatusBadge = (status: string, paid: boolean, reconciled?: boolean) => {
        if (reconciled) return <Badge color="indigo" icon={Link2} text="Conciliado" />;
        if (status === 'Cancelada' || status === 'cancelled') return <Badge color="red" icon={XCircle} text="Cancelada" />;
        if (paid) return <Badge color="green" icon={CheckCircle} text="Pagada" />;
        return <Badge color="amber" icon={Clock} text="Pendiente" />;
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 rounded-lg shadow-sm border border-slate-800">
            {/* Toolbar (Mobile Sticky) */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0 sticky top-0 bg-slate-900 z-10">
                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <FileText size={20} className="text-indigo-400" />
                    Listado de Facturas
                </h3>
                <div className="flex gap-2">
                    {onImportSat && (
                        <button
                            onClick={() => setShowSatModal(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border border-emerald-600/30 rounded text-sm transition-colors"
                        >
                            <FileSpreadsheet size={16} />
                            <span className="hidden sm:inline">Importar SAT</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filters - Responsive Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                <div className="lg:col-span-2">
                    <input
                        type="text"
                        placeholder="Buscar por folio, cliente, RFC, concepto..."
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>
                {/* Month input removed */}
                <div>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value as any)}
                        className="w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="paid">Pagadas</option>
                        <option value="unpaid">Pendientes</option>
                    </select>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950 text-slate-400 text-sm font-medium sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-4 w-[140px]">Folio / Fecha</th>
                            <th className="p-4 hidden md:table-cell">Cliente</th>
                            <th className="p-4 hidden lg:table-cell">Concepto</th>
                            <th className="p-4 text-right">Monto</th>
                            <th className="p-4 hidden sm:table-cell text-center w-[120px]">Estado</th>
                            <th className="p-4 text-center w-[60px]">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-800">
                        {filteredInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-500">
                                    No se encontraron facturas con los filtros seleccionados.
                                </td>
                            </tr>
                        ) : (
                            filteredInvoices.map((inv) => {
                                // --- NULL-SAFE HELPERS ---
                                const rawTotal = inv.amount;
                                const totalNumber = typeof rawTotal === 'number'
                                    ? rawTotal
                                    : (rawTotal != null ? Number(rawTotal) : 0);
                                const totalDisplay = isFinite(totalNumber)
                                    ? totalNumber.toLocaleString('es-MX', { minimumFractionDigits: 2, style: 'currency', currency: 'MXN' })
                                    : '-';

                                const formatDate = (val: string | undefined | null) => {
                                    if (!val) return '-';
                                    const d = new Date(val);
                                    return isNaN(d.getTime()) ? val : d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                };
                                // -------------------------

                                return (
                                    <tr key={inv.id} className="hover:bg-slate-800/50 transition-colors group">
                                        {/* Folio / Fecha */}
                                        <td className="p-4 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-mono font-medium text-slate-200">{inv.folio || 'S/F'}</span>
                                                <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <Calendar size={10} />
                                                    {formatDate(inv.invoiceDate)}
                                                </span>
                                                {/* Mobile Status Dot */}
                                                <div className="sm:hidden mt-1 flex">
                                                    <div className={`h-2 w-2 rounded-full ${inv.links?.reconciledTo ? 'bg-indigo-500' :
                                                        (inv.status === 'Cancelada' || inv.status === 'cancelled') ? 'bg-red-500' :
                                                            inv.paid ? 'bg-emerald-500' : 'bg-amber-500'
                                                        }`} />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Cliente */}
                                        <td className="p-4 align-top hidden md:table-cell">
                                            <div className="flex flex-col max-w-[200px]">
                                                <span className="font-medium text-slate-300 truncate" title={inv.clientName}>
                                                    {inv.clientName || 'Sin Nombre'}
                                                </span>
                                                <span className="text-xs text-slate-500 font-mono truncate">{inv.rfc || 'Sin RFC'}</span>
                                            </div>
                                        </td>

                                        {/* Concepto */}
                                        <td className="p-4 align-top hidden lg:table-cell">
                                            <div className="text-slate-400 truncate max-w-[250px]" title={inv.concept}>
                                                {inv.concept || inv.conceptoGeneral || inv.descripcion || 'Sin concepto'}
                                            </div>
                                        </td>

                                        {/* Monto */}
                                        <td className="p-4 align-top text-right">
                                            <div className="font-medium text-slate-200 font-mono">
                                                {totalDisplay}
                                            </div>
                                            <div className="text-xs text-slate-500 uppercase">MXN</div>
                                        </td>

                                        {/* Estado */}
                                        <td className="p-4 align-top hidden sm:table-cell text-center">
                                            {renderStatusBadge(inv.status || (inv.paid ? 'Pagada' : 'Pendiente'), inv.paid, !!inv.links?.reconciledTo || !!inv.metadata?.isReconciled)}
                                        </td>

                                        {/* Acciones */}
                                        <td className="p-4 align-top text-center relative">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* Reconciliation Action (Icon Only) */}
                                                {onReconcile && !inv.links?.reconciledTo && inv.status !== 'Cancelada' && (
                                                    <button
                                                        onClick={() => setReconcileInvoice(inv)}
                                                        className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 rounded transition-colors"
                                                        title="Conciliar con Banco"
                                                    >
                                                        <Link2 size={16} />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => onSelectInvoice(inv)}
                                                    className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <FileText size={16} />
                                                </button>

                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => toggleMenu(inv.id, e)}
                                                        className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition-colors"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {showActionsMenu === inv.id && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-30"
                                                                onClick={() => setShowActionsMenu(null)}
                                                            />
                                                            <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-40 py-1 overflow-hidden">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setShowActionsMenu(null); onDuplicate(inv); }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                                                >
                                                                    <Copy size={14} /> Duplicar
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setShowActionsMenu(null); onDelete(inv.id); }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 flex items-center gap-2"
                                                                >
                                                                    <Trash2 size={14} /> Eliminar
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            {showSatModal && onImportSat && (
                <SatImportModal
                    onClose={() => setShowSatModal(false)}
                    onImport={onImportSat}
                    ownRfc={ownRfc}
                    profileId={profileId}
                />
            )}

            {reconcileInvoice && onReconcile && (
                <ReconciliationModal
                    invoice={reconcileInvoice}
                    onClose={() => setReconcileInvoice(null)}
                    onReconcile={async (bankId) => {
                        await onReconcile(reconcileInvoice.id, bankId);
                        setReconcileInvoice(null);
                    }}
                />
            )}
        </div>
    );
};

const Badge = ({ color, icon: Icon, text }: { color: string, icon: any, text: string }) => {
    const colors: Record<string, string> = {
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        red: 'bg-red-500/10 text-red-400 border-red-500/20',
        slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${colors[color] || colors.slate}`}>
            <Icon size={12} />
            {text}
        </span>
    );
};
