import React, { useState, useEffect } from 'react';
import { Trash2, ArrowLeft } from 'lucide-react';
import type { Client, Invoice } from '../types';

interface InvoiceFormProps {
    onSave: (invoice: Invoice, client: Client) => Promise<void>;
    clients: Client[];
    nextFolio: string;
    onCancel: () => void;
    onDelete?: (id: string) => Promise<void>;
    initialData?: Invoice;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ onSave, clients, nextFolio, onCancel, onDelete, initialData }) => {
    const [rfcSearch, setRfcSearch] = useState(initialData?.rfc || '');
    const [clientNameSearch, setClientNameSearch] = useState(initialData?.clientName || '');

    // Invoice State
    const [formData, setFormData] = useState<Partial<Invoice>>({
        folio: nextFolio,
        invoiceDate: new Date().toISOString().slice(0, 10),
        month: new Date().toISOString().slice(0, 7),
        amount: 0,
        paid: false,
        realized: false,
        status: 'Pendiente',
        concept: '',
        notes: '',
        ...initialData
    });

    // Client State (for new or existing)
    const [clientData, setClientData] = useState<Partial<Client>>({
        rfc: '',
        name: '',
        email: '',
        address: '',
        postalCode: '',
        taxRegime: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
            setRfcSearch(initialData.rfc);
            setClientNameSearch(initialData.clientName);
            // Try to find client to populate clientData
            const existing = clients.find(c => c.rfc === initialData.rfc);
            if (existing) {
                setClientData(existing);
            } else {
                setClientData({
                    rfc: initialData.rfc,
                    name: initialData.clientName,
                    email: initialData.email,
                    address: initialData.address,
                    postalCode: initialData.postalCode,
                    taxRegime: initialData.taxRegime
                });
            }
        } else {
            setFormData(prev => ({ ...prev, folio: nextFolio }));
        }
    }, [initialData, nextFolio, clients]);

    // Handle ESC key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onCancel]);

    const handleClientSearch = (val: string, type: 'rfc' | 'name') => {
        if (type === 'rfc') {
            setRfcSearch(val);
            const found = clients.find(c => c.rfc.toLowerCase() === val.toLowerCase());
            if (found) {
                setClientData(found);
                setClientNameSearch(found.name);
            } else {
                setClientData(prev => ({ ...prev, rfc: val }));
            }
        } else {
            setClientNameSearch(val);
            const found = clients.find(c => c.name.toLowerCase() === val.toLowerCase());
            if (found) {
                setClientData(found);
                setRfcSearch(found.rfc);
            } else {
                setClientData(prev => ({ ...prev, name: val }));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Construct Client
        const clientToSave: Client = {
            id: clientData.id || crypto.randomUUID(),
            rfc: clientData.rfc || rfcSearch,
            name: clientData.name || clientNameSearch,
            email: clientData.email,
            address: clientData.address,
            postalCode: clientData.postalCode,
            taxRegime: clientData.taxRegime,
            createdAt: clientData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const isPaid = formData.paid || false;
        const status = formData.status || (isPaid ? 'Pagada' : 'Pendiente');

        // Construct Invoice
        const invoiceToSave: Invoice = {
            id: formData.id || crypto.randomUUID(),
            folio: formData.folio!,
            invoiceDate: formData.invoiceDate!,
            serviceDate: formData.serviceDate,
            month: formData.invoiceDate!.slice(0, 7),

            clientName: clientToSave.name,
            rfc: clientToSave.rfc,
            address: clientToSave.address,
            postalCode: clientToSave.postalCode,
            email: clientToSave.email,
            taxRegime: clientToSave.taxRegime,

            amount: Number(formData.amount),
            concept: formData.concept || 'Factura General',
            productKey: formData.productKey,
            paymentMethod: formData.paymentMethod || 'PUE',
            paymentForm: formData.paymentForm || '99',
            cfdiUse: formData.cfdiUse || 'G03',
            notes: formData.notes,

            status: status,
            paid: isPaid,
            realized: formData.realized || false,
            paymentDate: formData.paymentDate,

            createdAt: formData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await onSave(invoiceToSave, clientToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-800 p-6 rounded-lg border border-slate-700">
            {/* Top Bar: Close Button */}
            <div className="flex items-center mb-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex items-center space-x-2 text-slate-300 hover:text-white px-3 py-1 rounded-md border border-slate-700 hover:border-slate-500 transition text-sm"
                >
                    <ArrowLeft size={16} />
                    <span>Regresar</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Invoice Meta */}
                <div>
                    <label className="block text-sm font-medium text-slate-400">Folio</label>
                    <input
                        type="text"
                        value={formData.folio}
                        onChange={e => setFormData({ ...formData, folio: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400">Fecha Factura</label>
                    <input
                        type="date"
                        value={formData.invoiceDate}
                        onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        required
                    />
                </div>

                {/* Client Search */}
                <div className="md:col-span-2 border-t border-slate-700 pt-4 mt-2">
                    <h3 className="text-lg font-medium text-white mb-4">Datos del Cliente</h3>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400">RFC</label>
                    <input
                        type="text"
                        value={rfcSearch}
                        onChange={e => handleClientSearch(e.target.value, 'rfc')}
                        list="rfc-list"
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        required
                    />
                    <datalist id="rfc-list">
                        {clients.map(c => <option key={c.id} value={c.rfc} />)}
                    </datalist>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400">Nombre / Razón Social</label>
                    <input
                        type="text"
                        value={clientNameSearch}
                        onChange={e => handleClientSearch(e.target.value, 'name')}
                        list="name-list"
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        required
                    />
                    <datalist id="name-list">
                        {clients.map(c => <option key={c.id} value={c.name} />)}
                    </datalist>
                </div>

                {/* Client Details (Auto-filled or Editable) */}
                <div>
                    <label className="block text-sm font-medium text-slate-400">Email Contacto</label>
                    <input
                        type="email"
                        value={clientData.email || ''}
                        onChange={e => setClientData({ ...clientData, email: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400">Código Postal</label>
                    <input
                        type="text"
                        value={clientData.postalCode || ''}
                        onChange={e => setClientData({ ...clientData, postalCode: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400">Dirección Fiscal</label>
                    <input
                        type="text"
                        value={clientData.address || ''}
                        onChange={e => setClientData({ ...clientData, address: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400">Régimen Fiscal</label>
                    <input
                        type="text"
                        value={clientData.taxRegime || ''}
                        onChange={e => setClientData({ ...clientData, taxRegime: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                    />
                </div>

                {/* Invoice Details */}
                <div className="md:col-span-2 border-t border-slate-700 pt-4 mt-2">
                    <h3 className="text-lg font-medium text-white mb-4">Detalles de Factura</h3>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400">Concepto General</label>
                    <input
                        type="text"
                        value={formData.concept || ''}
                        onChange={e => setFormData({ ...formData, concept: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        placeholder="Ej. Servicios de Consultoría"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400">Monto Total</label>
                    <input
                        type="number"
                        value={formData.amount}
                        onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400">Uso CFDI</label>
                    <input
                        type="text"
                        value={formData.cfdiUse || ''}
                        onChange={e => setFormData({ ...formData, cfdiUse: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        placeholder="G03"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400">Método Pago</label>
                    <select
                        value={formData.paymentMethod || ''}
                        onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                    >
                        <option value="">Seleccionar</option>
                        <option value="PUE">PUE - Pago en una sola exhibición</option>
                        <option value="PPD">PPD - Pago en parcialidades o diferido</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400">Forma Pago</label>
                    <input
                        type="text"
                        value={formData.paymentForm || ''}
                        onChange={e => setFormData({ ...formData, paymentForm: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        placeholder="03"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400">Notas / Observaciones</label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        rows={3}
                    />
                </div>

                {/* Status */}
                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-white">
                        <input
                            type="checkbox"
                            checked={formData.realized}
                            onChange={e => setFormData({ ...formData, realized: e.target.checked })}
                            className="rounded border-slate-700 bg-slate-900"
                        />
                        <span>Factura Realizada (Timbrada)</span>
                    </label>
                </div>
                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-white">
                        <input
                            type="checkbox"
                            checked={formData.paid}
                            onChange={e => {
                                const isPaid = e.target.checked;
                                setFormData({
                                    ...formData,
                                    paid: isPaid,
                                    status: isPaid ? 'Pagada' : 'Pendiente'
                                });
                            }}
                            className="rounded border-slate-700 bg-slate-900"
                        />
                        <span>Pagada</span>
                    </label>
                </div>
                {formData.paid && (
                    <div>
                        <label className="block text-sm font-medium text-slate-400">Fecha Pago</label>
                        <input
                            type="date"
                            value={formData.paymentDate || ''}
                            onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                            className="mt-1 block w-full bg-slate-900 border-slate-700 rounded-md text-white px-3 py-2"
                        />
                    </div>
                )}
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-700">
                <div>
                    {initialData?.id && onDelete && (
                        <button
                            type="button"
                            onClick={async () => {
                                if (window.confirm(`¿Seguro que quieres eliminar la factura ${initialData.folio}? Esta acción no se puede deshacer.`)) {
                                    await onDelete(initialData.id);
                                }
                            }}
                            className="flex items-center space-x-2 px-4 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 rounded-md transition-colors"
                        >
                            <Trash2 size={18} />
                            <span>Eliminar</span>
                        </button>
                    )}
                </div>
                <div className="flex space-x-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-slate-300 hover:text-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
                    >
                        Guardar Factura
                    </button>
                </div>
            </div>
        </form>
    );
};
