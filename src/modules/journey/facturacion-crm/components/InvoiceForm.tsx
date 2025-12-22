import React, { useState, useEffect } from 'react';
import { Trash2, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import type { Client, Invoice } from '../types';
import type { FolioSerie, FolioSuggestion } from '../utils/folioUtils';

interface InvoiceFormProps {
    onSave: (invoice: Invoice, client: Client) => Promise<void>;
    clients: Client[];
    nextFolio: string; // Legacy prop, might be ignored if we auto-calc
    onCancel: () => void;
    onDelete?: (id: string) => Promise<void>;
    initialData?: Invoice;
    getLastInvoiceForClient?: (rfc: string) => Invoice | undefined;
    suggestNextFolio?: (serie: FolioSerie, dateStr: string) => FolioSuggestion;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
    onSave, clients, nextFolio, onCancel, onDelete, initialData,
    getLastInvoiceForClient, suggestNextFolio
}) => {
    // Determine initial serie from folio if editing, else default C
    const getInitialSerie = (f: string): FolioSerie => {
        if (!f) return 'C';
        if (f.startsWith('A')) return 'A';
        if (f.startsWith('B')) return 'B';
        return 'C';
    };

    const [serie, setSerie] = useState<FolioSerie>(initialData ? getInitialSerie(initialData.folio) : 'C');
    const [folioWarning, setFolioWarning] = useState<string | null>(null);
    const [isFolioDirty, setIsFolioDirty] = useState(!!initialData); // If editing, dirty by default so we don't overwrite

    // ...
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
        let found: Client | undefined;

        if (type === 'rfc') {
            setRfcSearch(val);
            found = clients.find(c => c.rfc.toLowerCase() === val.toLowerCase());
            if (found) {
                setClientNameSearch(found.name);
            } else {
                setClientData(prev => ({ ...prev, rfc: val }));
            }
        } else {
            setClientNameSearch(val);
            found = clients.find(c => c.name.toLowerCase() === val.toLowerCase());
            if (found) {
                setRfcSearch(found.rfc);
            } else {
                setClientData(prev => ({ ...prev, name: val }));
            }
        }

        if (found) {
            // 1. Autofill Client Data
            setClientData(found);

            // 2. Autofill Invoice Data from Last Invoice (if not editing an existing on)
            if (!initialData && getLastInvoiceForClient) {
                const lastInv = getLastInvoiceForClient(found.rfc);
                if (lastInv) {
                    setFormData(prev => ({
                        ...prev,
                        // Only overwrite if currently empty or default
                        concept: (!prev.concept || prev.concept === 'Factura General') ? lastInv.concept : prev.concept,
                        cfdiUse: (!prev.cfdiUse || prev.cfdiUse === 'G03') ? lastInv.cfdiUse : prev.cfdiUse,
                        paymentMethod: (!prev.paymentMethod || prev.paymentMethod === 'PUE') ? lastInv.paymentMethod : prev.paymentMethod,
                        paymentForm: (!prev.paymentForm || prev.paymentForm === '99') ? lastInv.paymentForm : prev.paymentForm,
                    }));
                }
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

    // Auto-generate folio when serie or date changes, unless dirty
    useEffect(() => {
        if (!suggestNextFolio) return;
        if (isFolioDirty) return; // Don't overwrite users manual input

        const dateStr = formData.invoiceDate || new Date().toISOString().slice(0, 10);
        const suggestion = suggestNextFolio(serie, dateStr);

        if (suggestion.isTaken && !suggestion.nextAvailable) {
            // Conflict without auto-resolution (shouldn't happen with new logic but safe)
            setFolioWarning(`El folio ${suggestion.folio} ya existe.`);
        } else if (suggestion.isTaken) {
            setFolioWarning(`El folio ${suggestion.folio} ya existe.`);
            // We don't auto-set conflict, we wait for user action or just show it empty?
            // Requirement: "por default NO permitas autogenerar... agrega boton Forzar"
            // But valid UX is: Show the conflict, don't set it in the field? 
            // Or set it but make it invalid?
            // Let's set empty in the field and show warning.
            setFormData(prev => ({ ...prev, folio: '' }));
        } else {
            setFolioWarning(null);
            setFormData(prev => ({ ...prev, folio: suggestion.folio }));
        }
    }, [serie, formData.invoiceDate, suggestNextFolio, isFolioDirty]);

    const handleForceFolio = () => {
        if (!suggestNextFolio) return;
        const dateStr = formData.invoiceDate || new Date().toISOString().slice(0, 10);
        const suggestion = suggestNextFolio(serie, dateStr);

        if (suggestion.nextAvailable) {
            setFormData(prev => ({ ...prev, folio: suggestion.nextAvailable }));
            setFolioWarning(null);
            setIsFolioDirty(true); // Treat as user-selected
        }
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
                <div className="space-y-4">
                    {/* Serie Selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Serie</label>
                        <div className="flex space-x-2">
                            {(['C', 'A', 'B'] as FolioSerie[]).map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => {
                                        setSerie(s);
                                        setIsFolioDirty(false); // Reset dirty to allow auto-gen
                                    }}
                                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors border ${serie === s
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    Serie {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400">Folio</label>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={formData.folio}
                                onChange={e => {
                                    setFormData({ ...formData, folio: e.target.value });
                                    setIsFolioDirty(true);
                                    setFolioWarning(null);
                                }}
                                className={`mt-1 block w-full bg-slate-900 border rounded-md text-white px-3 py-2 ${folioWarning ? 'border-amber-500' : 'border-slate-700'}`}
                                required
                            />
                            {!isFolioDirty && suggestNextFolio && (
                                <button
                                    type="button"
                                    onClick={() => setIsFolioDirty(false)} // Trigger re-calc
                                    className="mt-1 p-2 text-slate-400 hover:text-white border border-slate-700 rounded-md bg-slate-800"
                                    title="Regenerar Folio"
                                >
                                    <RefreshCw size={18} />
                                </button>
                            )}
                        </div>
                        {folioWarning && (
                            <div className="mt-2 text-amber-400 text-xs flex items-start gap-2 bg-amber-900/20 p-2 rounded border border-amber-900/50">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <div className="flex flex-col gap-1 w-full">
                                    <span>{folioWarning}</span>
                                    <button
                                        type="button"
                                        onClick={handleForceFolio}
                                        className="text-left text-indigo-400 hover:text-indigo-300 underline font-medium"
                                    >
                                        Forzar consecutivo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
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
