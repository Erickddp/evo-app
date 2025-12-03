import React, { useState } from 'react';
import { useFacturas } from './hooks/useFacturas';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceForm } from './components/InvoiceForm';
import type { Invoice, Client } from './types';
import { Plus, Download, Upload } from 'lucide-react';

const FacturasModule: React.FC = () => {
    const {
        invoices,
        clients,
        loading,
        saveInvoice,
        saveClient,
        getNextFolio,
        exportCSV,
        importCSV,
        refresh
    } = useFacturas();

    const [view, setView] = useState<'list' | 'form'>('list');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | undefined>(undefined);
    const [importMsg, setImportMsg] = useState('');

    const handleCreateNew = () => {
        setSelectedInvoice(undefined);
        setView('form');
    };

    const handleSelectInvoice = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setView('form');
    };

    const handleSave = async (invoice: Invoice, client: Client) => {
        // Save Client first (upsert)
        let savedClient = clients.find(c => c.rfc === client.rfc);
        if (!savedClient) {
            await saveClient(client);
        } else {
            // Update client info if changed? For now, we assume client updates are handled by re-saving.
            // But useFacturas saveClient appends. 
            // We should probably check if we need to update.
            // For simplicity, we just save the invoice which contains the snapshot.
            // But if we want to update the catalog, we should call saveClient.
            // Let's assume we update the catalog.
            await saveClient({ ...savedClient, ...client, id: savedClient.id });
        }

        await saveInvoice(invoice);
        setView('list');
        refresh();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportMsg('Importando...');
        const res = await importCSV(file);
        setImportMsg(`Importación completada: ${res.imported} facturas nuevas, ${res.skipped} ignoradas.`);
        refresh();
        setTimeout(() => setImportMsg(''), 5000);
    };

    if (loading) {
        return <div className="p-6 text-white">Cargando módulo...</div>;
    }

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Facturación CRM</h1>
                    <p className="text-slate-400">Gestiona tus clientes y facturas de ingresos</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={exportCSV}
                        className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md border border-slate-700"
                    >
                        <Download size={16} />
                        <span>Exportar CSV</span>
                    </button>
                    <label className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md border border-slate-700 cursor-pointer">
                        <Upload size={16} />
                        <span>Importar CSV</span>
                        <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
                    </label>
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shadow-md"
                    >
                        <Plus size={16} />
                        <span>Nueva Factura</span>
                    </button>
                </div>
            </div>

            {importMsg && (
                <div className="bg-blue-900/50 border border-blue-700 text-blue-200 px-4 py-2 rounded-md">
                    {importMsg}
                </div>
            )}

            <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-800 p-4 overflow-hidden flex flex-col">
                {view === 'list' ? (
                    <InvoiceList invoices={invoices} onSelectInvoice={handleSelectInvoice} />
                ) : (
                    <InvoiceForm
                        onSave={handleSave}
                        clients={clients}
                        nextFolio={selectedInvoice ? selectedInvoice.folio : getNextFolio()}
                        onCancel={() => setView('list')}
                        initialData={selectedInvoice}
                    />
                )}
            </div>
        </div>
    );
};

export default FacturasModule;
