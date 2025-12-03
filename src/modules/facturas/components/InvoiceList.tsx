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
                inv.rfc.toLowerCase().includes(filterText.toLowerCase());

            const matchesMonth = filterMonth ? inv.month === filterMonth : true;

            const matchesStatus =
                filterStatus === 'all' ? true :
                    filterStatus === 'paid' ? inv.paid :
                        !inv.paid;

            return matchesText && matchesMonth && matchesStatus;
        }).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
    }, [invoices, filterText, filterMonth, filterStatus]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                    type="text"
                    placeholder="Buscar folio, cliente, RFC..."
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    className="bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                />
                <input
                    type="month"
                    value={filterMonth}
                    onChange={e => setFilterMonth(e.target.value)}
                    className="bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                />
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as any)}
                    className="bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                >
                    <option value="all">Todos los estados</option>
                    <option value="paid">Pagadas</option>
                    <option value="unpaid">Pendientes de Pago</option>
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Folio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Monto</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="bg-slate-900 divide-y divide-slate-800">
                        {filteredInvoices.map(inv => (
                            <tr
                                key={inv.id}
                                onClick={() => onSelectInvoice(inv)}
                                className="hover:bg-slate-800 cursor-pointer transition-colors"
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{inv.folio}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{inv.invoiceDate}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                    <div className="font-medium">{inv.clientName}</div>
                                    <div className="text-xs text-slate-500">{inv.rfc}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-emerald-400">
                                    ${inv.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${inv.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                        {inv.paid ? 'Pagada' : 'Pendiente'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
