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
        if (res.errors.length > 0) {
            console.warn('Errores de importación:', res.errors);
            setImportMsg(prev => `${prev} (Ver consola para ${res.errors.length} errores)`);
        }
        refresh();
        setTimeout(() => setImportMsg(''), 5000);
    };

    if (loading) {
        return <div className="p-8 text-white text-xl animate-pulse">Cargando módulo de facturación...</div>;
    }

    return (
        <div className="h-full flex flex-col p-4 md:p-8 space-y-6 w-full max-w-[1920px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Facturación CRM</h1>
                    <p className="text-slate-400 text-lg mt-1">Gestiona tus clientes y facturas de ingresos</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={exportCSV}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors font-medium"
                    >
                        <Download size={18} />
                        <span>Exportar CSV</span>
                    </button>
                    <label className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 cursor-pointer transition-colors font-medium">
                        <Upload size={18} />
                        <span>Importar CSV</span>
                        <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
                    </label>
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg hover:shadow-indigo-500/20 transition-all font-medium"
                    >
                        <Plus size={18} />
                        <span>Nueva Factura</span>
                    </button>
                </div>
            </div>

            {importMsg && (
                <div className="bg-blue-900/40 border border-blue-500/30 text-blue-100 px-6 py-3 rounded-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
                    {importMsg}
                </div>
            )}

            <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 overflow-hidden flex flex-col shadow-xl backdrop-blur-sm">
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
