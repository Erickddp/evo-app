import React, { useState } from 'react';
import { useFacturas } from './hooks/useFacturas';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceForm } from './components/InvoiceForm';
import type { Invoice, Client } from './types';
import { Plus, Download, Upload, Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const FacturasModule: React.FC = () => {
    const {
        clients,
        loading,
        saveInvoice,
        deleteInvoice,
        clearFacturacionData,
        saveClient,
        getNextFolio,
        exportCSV,
        importCSV,
        refresh,
        pagedInvoices,
        totalItems,
        totalPages,
        currentPage,
        setCurrentPage,
        filterDateFrom, setFilterDateFrom,
        filterDateTo, setFilterDateTo,
        filterCliente, setFilterCliente,
        filterFolio, setFilterFolio,
        filterStatus, setFilterStatus
    } = useFacturas();

    const [view, setView] = useState<'list' | 'form'>('list');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | undefined>(undefined);
    const [importMsg, setImportMsg] = useState('');
    const [lastImportDetails, setLastImportDetails] = useState<any[]>([]);

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
        setLastImportDetails([]);

        const res = await importCSV(file);

        let msg = `Importación completada: ${res.imported} facturas nuevas, ${res.skipped} ignoradas`;

        if (res.skipped > 0 && res.skippedByReason) {
            const parts: string[] = [];
            const map: Record<string, string> = {
                invalid_fecha: 'fecha inválida',
                invalid_monto: 'monto inválido',
                duplicate_folio: 'folio duplicado',
                missing_required: 'faltan datos obligatorios',
                other: 'error desconocido'
            };

            Object.entries(res.skippedByReason).forEach(([key, count]) => {
                if (count > 0) {
                    parts.push(`${count} con ${map[key] || key}`);
                }
            });

            if (parts.length > 0) {
                msg += ` (${parts.join(", ")})`;
            } else {
                msg += `.`;
            }
        } else {
            msg += `.`;
        }

        setImportMsg(msg);

        if (res.skippedDetails && res.skippedDetails.length > 0) {
            setLastImportDetails(res.skippedDetails);
        }

        if (res.errors.length > 0) {
            console.warn('Errores de importación:', res.errors);
            setImportMsg(prev => `${prev} (Ver consola para ${res.errors.length} errores)`);
        }
        refresh();
        setTimeout(() => {
            setImportMsg('');
            setLastImportDetails([]);
        }, 15000);
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
                    <label
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 cursor-pointer transition-colors font-medium"
                        title="Formato V2: FECHA, NUMERO DE FACTURA, NOMBRE, RFC, MONTO, FECHA DE PAGO, CP, DIRECCION, METODO DE PAGO, FORMA DE PAGO, DESCRIPCION, REGIMEN FISCAL, CORREO O CONTACTO"
                    >
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
                    <div className="font-medium">{importMsg}</div>
                    {lastImportDetails.length > 0 && (
                        <div className="mt-3 text-xs bg-slate-900/50 p-2 rounded border border-slate-700/50 max-h-40 overflow-y-auto">
                            <div className="mb-1 font-semibold text-slate-300">Detalle de las primeras filas ignoradas:</div>
                            <ul className="space-y-1 text-slate-400 font-mono">
                                {lastImportDetails.map((row, idx) => (
                                    <li key={idx}>
                                        <span className="text-rose-400 mr-1">[{row.reason}]</span>
                                        Línea {row.rowIndex}: {row.message || 'Sin mensaje'}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 overflow-hidden flex flex-col shadow-xl backdrop-blur-sm">
                {view === 'list' ? (
                    <>
                        {/* Filters */}
                        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Cliente / RFC */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                                <input
                                    type="text"
                                    placeholder="Buscar Cliente o RFC..."
                                    value={filterCliente}
                                    onChange={e => setFilterCliente(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>

                            {/* Folio */}
                            <div>
                                <input
                                    type="text"
                                    placeholder="Folio (ej. C105)..."
                                    value={filterFolio}
                                    onChange={e => setFilterFolio(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>

                            {/* Fechas */}
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={filterDateFrom}
                                    onChange={e => setFilterDateFrom(e.target.value)}
                                    className="w-1/2 px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                                <input
                                    type="date"
                                    value={filterDateTo}
                                    onChange={e => setFilterDateTo(e.target.value)}
                                    className="w-1/2 px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>

                            {/* Estado */}
                            <div>
                                <select
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                >
                                    <option value="todos">Todos los estados</option>
                                    <option value="pagada">Pagada</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="cancelada">Cancelada</option>
                                </select>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-auto">
                            <InvoiceList invoices={pagedInvoices} onSelectInvoice={handleSelectInvoice} onDelete={deleteInvoice} />
                        </div>

                        {/* Pagination */}
                        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
                            <div>
                                Mostrando {pagedInvoices.length} de {totalItems} facturas
                                {totalItems > 0 && ` (Página ${currentPage} de ${totalPages})`}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 bg-slate-800 border border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="p-2 bg-slate-800 border border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <InvoiceForm
                        onSave={handleSave}
                        onDelete={async (id) => {
                            await deleteInvoice(id);
                            setView('list');
                        }}
                        clients={clients}
                        nextFolio={selectedInvoice ? selectedInvoice.folio : getNextFolio()}
                        onCancel={() => setView('list')}
                        initialData={selectedInvoice}
                    />
                )}
            </div>
            {/* Danger Zone: Clear Data */}
            <div className="flex justify-end mt-4">
                <button
                    onClick={async () => {
                        if (window.confirm('ADVERTENCIA: ¿Estás seguro de que deseas ELIMINAR TODOS los datos de Facturación CRM?\n\nEsta acción borrará todas las facturas, clientes locales y registros financieros asociados a este módulo permanentemente.\n\nNo se puede deshacer.')) {
                            await clearFacturacionData();
                        }
                    }}
                    className="flex items-center space-x-2 text-xs px-3 py-1.5 rounded-md border border-rose-900/50 text-rose-700/70 hover:bg-rose-900/20 hover:text-rose-400 hover:border-rose-700/50 transition-colors"
                    title="Eliminar todos los datos de este módulo"
                >
                    <Trash2 size={12} />
                    <span>Borrar todo</span>
                </button>
            </div>
        </div>
    );
};

export default FacturasModule;
