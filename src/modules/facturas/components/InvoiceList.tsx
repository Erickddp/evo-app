import React, { useMemo, useState } from 'react';
import type { Invoice } from '../types';

interface InvoiceListProps {
    invoices: Invoice[];
    onSelectInvoice: (invoice: Invoice) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ invoices, onSelectInvoice }) => {
    const [filterText, setFilterText] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchesText =
                inv.folio.toLowerCase().includes(filterText.toLowerCase()) ||
                inv.clientName.toLowerCase().includes(filterText.toLowerCase()) ||
                inv.rfc.toLowerCase().includes(filterText.toLowerCase()) ||
                (inv.concept || '').toLowerCase().includes(filterText.toLowerCase());

            const matchesMonth = filterMonth ? inv.month === filterMonth : true;

            const matchesStatus =
                filterStatus === 'all' ? true :
                    filterStatus === 'paid' ? (inv.paid || inv.status === 'Pagada') :
                        (!inv.paid && inv.status !== 'Pagada');

            return matchesText && matchesMonth && matchesStatus;
        }).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
    }, [invoices, filterText, filterMonth, filterStatus]);

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Filters - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                    <input
                        type="text"
                        placeholder="Buscar por folio, cliente, RFC, concepto..."
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>
                <div>
                    <input
                        type="month"
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        className="w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>
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
            <div className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-900/50">
                <table className="min-w-full divide-y divide-slate-800">
                    <thead className="bg-slate-800 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Folio / Fecha</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Cliente</th>
                            <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Concepto</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Monto</th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {filteredInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    No se encontraron facturas con los filtros seleccionados.
                                </td>
                            </tr>
                        ) : (
                            filteredInvoices.map(inv => (
                                <tr
                                    key={inv.id}
                                    onClick={() => onSelectInvoice(inv)}
                                    className="hover:bg-slate-800/80 cursor-pointer transition-colors group"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{inv.folio}</div>
                                        <div className="text-xs text-slate-500">{inv.invoiceDate}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-slate-200">{inv.clientName}</div>
                                        <div className="text-xs text-slate-500">{inv.rfc}</div>
                                    </td>
                                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-slate-400 max-w-xs truncate" title={inv.concept}>
                                            {inv.concept || 'Sin concepto'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm font-mono font-medium text-emerald-400">
                                            ${inv.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${(inv.status === 'Pagada' || inv.paid)
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                            }`}>
                                            {inv.status || (inv.paid ? 'Pagada' : 'Pendiente')}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
