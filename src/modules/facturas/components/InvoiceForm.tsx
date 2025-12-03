import React, { useState, useEffect } from 'react';
import type { Client, Invoice } from '../types';

interface InvoiceFormProps {
    onSave: (invoice: Invoice, client: Client) => Promise<void>;
    clients: Client[];
    nextFolio: string;
    onCancel: () => void;
    initialData?: Invoice;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ onSave, clients, nextFolio, onCancel, initialData }) => {
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
            productKey: formData.productKey,
            paymentMethod: formData.paymentMethod,
            paymentForm: formData.paymentForm,
            cfdiUse: formData.cfdiUse,
            description: formData.description,

            paid: formData.paid || false,
            realized: formData.realized || false,
            paymentDate: formData.paymentDate,

            createdAt: formData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await onSave(invoiceToSave, clientToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-800 p-6 rounded-lg border border-slate-700">
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
                <div>
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
                    <label className="block text-sm font-medium text-slate-400">Descripción / Notas</label>
                    <textarea
                        value={formData.description || ''}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
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
                            onChange={e => setFormData({ ...formData, paid: e.target.checked })}
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

            <div className="flex justify-end space-x-4 pt-4 border-t border-slate-700">
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
        </form>
    );
};
