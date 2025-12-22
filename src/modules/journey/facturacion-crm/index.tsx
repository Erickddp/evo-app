import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProfile } from '../../core/profiles/ProfileProvider';
import { useFacturas } from './hooks/useFacturas';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceForm } from './components/InvoiceForm';
import { JourneyToolHeader } from '../../core/journey/components/JourneyToolHeader';
import { Plus } from 'lucide-react';
import type { Invoice } from './types';
import { isSatCsv } from './utils/satDetection';


export default function FacturacionCrmTool() {
    const { activeProfile } = useProfile();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentMonth = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    const {
        invoices: allInvoices,
        pagedInvoices,
        saveInvoice,
        deleteInvoice,
        duplicateInvoice,
        clients,
        loading,
        totalItems,
        currentPage,
        setCurrentPage,
        totalPages,
        exportCSV,
        importCSV,
        getNextFolio,
        suggestNextFolio,
        getLastInvoiceForClient,
        saveSatInvoices,
        reconcileInvoice
    } = useFacturas(currentMonth);

    // Initial check for URL param
    React.useEffect(() => {
        if (!searchParams.get('month')) {
            setSearchParams({ month: currentMonth }, { replace: true });
        }
    }, [searchParams, setSearchParams, currentMonth]);

    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined);

    // Calculate totals for the header stats (based on monthly data)
    const { totalIncome, unpaidCount } = React.useMemo(() => {
        const income = allInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.amount || 0), 0);
        const unpaid = allInvoices.filter((inv: Invoice) => !inv.paid).length;
        return { totalIncome: income, unpaidCount: unpaid };
    }, [allInvoices]);

    const handleCreate = () => {
        setEditingInvoice(undefined);
        setView('form');
    };

    const handleEdit = (invoice: Invoice) => {
        setEditingInvoice(invoice);
        setView('form');
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchParams({ month: e.target.value });
    };

    if (view === 'form') {
        return (
            <div className="h-full flex flex-col p-6 overflow-auto bg-slate-900">
                <InvoiceForm
                    onSave={async (inv, _client) => {
                        await saveInvoice(inv);
                        setView('list');
                    }}
                    onCancel={() => setView('list')}
                    clients={clients}
                    nextFolio={getNextFolio()}
                    initialData={editingInvoice}
                    onDelete={async (id) => {
                        await deleteInvoice(id);
                        setView('list');
                    }}
                    getLastInvoiceForClient={getLastInvoiceForClient}
                    suggestNextFolio={suggestNextFolio}
                />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-950">
            {/* Custom Header Area */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                        <JourneyToolHeader
                            title="Facturación y Clientes"
                            subtitle="Gestiona tus ingresos y facturas"
                            currentMonth={currentMonth}
                            hideMonthBadge={true}
                        />
                    </div>
                    {/* Period Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm font-medium">Periodo:</span>
                        <input
                            type="month"
                            value={currentMonth}
                            onChange={handleMonthChange}
                            className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                {/* Stats & Actions Row */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 min-w-[150px]">
                            <div className="text-slate-400 text-xs uppercase font-semibold tracking-wider">Facturado Mes</div>
                            <div className="text-xl font-bold text-emerald-400 mt-1">
                                {totalIncome.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                            </div>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 min-w-[150px]">
                            <div className="text-slate-400 text-xs uppercase font-semibold tracking-wider">Pendientes Pago</div>
                            <div className="text-xl font-bold text-amber-400 mt-1">
                                {unpaidCount}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2 w-full md:w-auto justify-end">
                        <label
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md cursor-pointer border border-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
                            onClick={() => console.log('[SAT_FLOW] CLICK legacy button')}
                        >
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        console.log(`[SAT_FLOW] CHANGE legacy input file=${file.name} size=${file.size}`);

                                        // SAT Detection Check
                                        const text = await file.text();
                                        const firstLine = text.split(/\r?\n/)[0];
                                        // Quick simple split for headers
                                        const headers = firstLine.split(',').map(h => h.replace(/^"|"$/g, '').trim());

                                        if (isSatCsv(headers)) {
                                            console.log('[SAT_FLOW] legacy input detected SAT csv -> redirect');
                                            alert('DETECTADO ARCHIVO SAT: Por favor usa el botón "Importar SAT" (verde) para este archivo.');
                                            e.target.value = '';
                                            return;
                                        }

                                        importCSV(file).then(res => {
                                            alert(`Importado: ${res.imported}\nSaltado: ${res.skipped}\nErrores: ${res.errors.length}`);
                                        });
                                    }
                                    e.target.value = '';
                                }}
                            />
                            <span>Importar CSV (Legacy)</span>
                        </label>
                        <button
                            onClick={exportCSV}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition-colors text-sm font-medium"
                        >
                            Exportar
                        </button>
                        <button
                            onClick={handleCreate}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors text-sm font-medium flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            <Plus size={16} />
                            <span>Nueva Factura</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900/30">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                <span>Cargando facturas...</span>
                            </div>
                        </div>
                    ) : (
                        <InvoiceList
                            invoices={pagedInvoices}
                            ownRfc={activeProfile?.rfc}
                            profileId={activeProfile?.id}
                            onSelectInvoice={handleEdit}
                            onDelete={deleteInvoice}
                            onDuplicate={async (inv) => {
                                await duplicateInvoice(inv.id);
                            }}
                            onImportSat={async (rows) => {
                                // @ts-ignore - inferred type check might lag
                                const result = await saveSatInvoices(rows);
                                alert(`Importación completada.\nImportados: ${result.count}\nErrores: ${result.errors}`);
                            }}
                            onReconcile={async (invId, bankId) => {
                                // @ts-ignore
                                await reconcileInvoice(invId, bankId);
                                alert('Factura conciliada con éxito.');
                            }}
                        />
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="mt-4 flex justify-between items-center text-sm text-slate-400 px-2 shrink-0">
                        <div>
                            Mostrando {pagedInvoices.length} de {totalItems} facturas
                        </div>
                        <div className="flex space-x-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                                className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="flex items-center px-2 font-mono">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                                className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
