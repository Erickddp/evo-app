import { useState, useEffect, useCallback, useMemo } from 'react';
import { dataStore } from '../../../core/data/dataStore';
import { evoStore } from '../../../core/evoappDataStore';
import { facturasMapper } from '../../../core/mappers/facturasMapper';
import { ingresosMapper } from '../../../core/mappers/ingresosMapper';
import type { Client, Invoice, FacturaPayload } from '../types';
import { createEvoTransaction } from '../../../core/domain/evo-transaction';
import {
    FACTURAS_CSV_HEADERS_V2,
    mapInvoiceToCsvRowV2,
    mapCsvRowV2ToInvoice,
    buildV2HeaderMap,
    type FacturaCsvRowV2,
    type V2CanonicalField
} from '../csvSchemaV2';
import { parseCsv, toCsvRow, normalizeDate, parseAmount } from '../utils/csvParser';
import { evoEvents } from '../../../core/events';

const TOOL_ID = 'facturas-manager';

export function useFacturas() {
    const [clients, setClients] = useState<Client[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');
    const [filterCliente, setFilterCliente] = useState<string>('');
    const [filterFolio, setFilterFolio] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('todos');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 25;

    // Filter Logic
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            // Date From
            if (filterDateFrom && inv.invoiceDate < filterDateFrom) return false;
            // Date To
            if (filterDateTo && inv.invoiceDate > filterDateTo) return false;

            // Cliente / RFC
            if (filterCliente) {
                const term = filterCliente.toLowerCase();
                const matchName = inv.clientName.toLowerCase().includes(term);
                const matchRfc = inv.rfc.toLowerCase().includes(term);
                if (!matchName && !matchRfc) return false;
            }

            // Folio
            if (filterFolio) {
                const term = filterFolio.toLowerCase();
                if (!inv.folio.toLowerCase().includes(term)) return false;
            }

            // Status
            if (filterStatus !== 'todos') {
                const s = inv.status ? inv.status.toLowerCase() : '';
                if (filterStatus === 'cancelada') {
                    if (s !== 'cancelada' && s !== 'cancelled') return false;
                } else if (filterStatus === 'pagada') {
                    if (!inv.paid) return false;
                } else if (filterStatus === 'pendiente') {
                    if (inv.paid || s === 'cancelada' || s === 'cancelled') return false;
                }
            }

            return true;
        })
            // Sort by date desc (newest first)
            .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
    }, [invoices, filterDateFrom, filterDateTo, filterCliente, filterFolio, filterStatus]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterDateFrom, filterDateTo, filterCliente, filterFolio, filterStatus]);

    // Pagination Logic
    const totalItems = filteredInvoices.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const pagedInvoices = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredInvoices.slice(start, start + pageSize);
    }, [filteredInvoices, currentPage, pageSize]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Try loading from Unified Store
            const canonicalClients = await evoStore.clientes.getAll();
            const canonicalInvoices = await evoStore.facturas.getAll();

            if (canonicalClients.length > 0 || canonicalInvoices.length > 0) {
                setClients(canonicalClients.map(facturasMapper.clientToLegacy));
                setInvoices(canonicalInvoices.map(facturasMapper.invoiceToLegacy));
            } else {
                // 2. Migration: Check Legacy Store
                console.log('No canonical facturas data, checking legacy store...');
                const records = await dataStore.listRecords<FacturaPayload>(TOOL_ID);

                if (records.length > 0) {
                    const loadedClients: Client[] = [];
                    const loadedInvoices: Invoice[] = [];

                    records.forEach(record => {
                        if (record.payload.type === 'client') {
                            loadedClients.push(record.payload.data as Client);
                        } else if (record.payload.type === 'invoice') {
                            loadedInvoices.push(record.payload.data as Invoice);
                        }
                    });

                    if (loadedClients.length > 0 || loadedInvoices.length > 0) {
                        console.log(`Migrating ${loadedClients.length} clients and ${loadedInvoices.length} invoices to canonical store...`);

                        // Save to new store
                        if (loadedClients.length > 0) {
                            await evoStore.clientes.saveAll(loadedClients.map(facturasMapper.clientToCanonical));
                        }
                        if (loadedInvoices.length > 0) {
                            await evoStore.facturas.saveAll(loadedInvoices.map(facturasMapper.invoiceToCanonical));
                        }

                        setClients(loadedClients);
                        setInvoices(loadedInvoices);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading facturas data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const saveClient = async (client: Client) => {
        // Save to Unified Store
        await evoStore.clientes.add(facturasMapper.clientToCanonical(client));

        setClients(prev => {
            const others = prev.filter(c => c.id !== client.id);
            return [...others, client];
        });
        return client;
    };

    const updateClient = async (updatedClient: Client) => {
        // Save to Unified Store
        await evoStore.clientes.add(facturasMapper.clientToCanonical(updatedClient));

        setClients(prev => {
            const others = prev.filter(c => c.id !== updatedClient.id);
            return [...others, updatedClient];
        });
    };

    const saveInvoice = async (invoice: Invoice) => {
        // 1. Save Invoice to Unified Store
        await evoStore.facturas.add(facturasMapper.invoiceToCanonical(invoice));

        setInvoices(prev => {
            const others = prev.filter(i => i.id !== invoice.id);
            return [...others, invoice];
        });

        // 2. Sync with RegistrosFinancieros (Ingresos Manager)
        try {
            const allTransactions = await evoStore.registrosFinancieros.getAll();

            // Find existing transaction for this invoice (using referenceId which maps to metadata.invoiceId in legacy)
            // In canonical model: referenciaId
            const existingIndex = allTransactions.findIndex(t => t.referenciaId === invoice.id);

            const transactionData = {
                date: invoice.invoiceDate,
                concept: `Factura ${invoice.folio} - ${invoice.clientName}`,
                amount: invoice.amount,
                type: 'ingreso' as const,
                source: 'facturacion-crm',
                metadata: {
                    invoiceId: invoice.id,
                    folio: invoice.folio,
                    clientId: invoice.rfc
                }
            };

            // Create legacy transaction object to map it to canonical
            // We use createEvoTransaction to ensure ID generation if needed, but we might be updating
            const legacyTx = createEvoTransaction({
                id: existingIndex >= 0 ? allTransactions[existingIndex].id : undefined,
                ...transactionData
            });

            // Map to canonical
            const canonicalTx = ingresosMapper.toCanonical(legacyTx);
            // Ensure referenciaId is set (mapper might look at metadata.referenciaId, but here we set it explicitly if needed)
            canonicalTx.referenciaId = invoice.id;

            // Save
            await evoStore.registrosFinancieros.add(canonicalTx);

        } catch (e) {
            console.error('Error syncing invoice to transactions:', e);
        }

        evoEvents.emit('invoice:updated');
        evoEvents.emit('finance:updated');
    };

    const deleteInvoice = async (invoiceId: string) => {
        try {
            const invoice = invoices.find(i => i.id === invoiceId);
            if (!invoice) return;

            // 1. Delete from Unified Store
            await evoStore.facturas.delete(invoiceId);

            // 2. Delete linked transaction from RegistrosFinancieros
            const allTransactions = await evoStore.registrosFinancieros.getAll();
            const linkedTx = allTransactions.find(t => t.referenciaId === invoiceId);

            if (linkedTx) {
                await evoStore.registrosFinancieros.delete(linkedTx.id);
            }

            // 3. Update Local State
            setInvoices(prev => prev.filter(i => i.id !== invoiceId));

        } catch (e) {
            console.error('Error deleting invoice:', e);
            throw e; // Re-throw to handle in UI
        }

        evoEvents.emit('invoice:updated');
        evoEvents.emit('finance:updated');
    };

    const clearFacturacionData = async (): Promise<void> => {
        try {
            setLoading(true);

            // 1. Get all canonical data to delete
            const allInvoices = await evoStore.facturas.getAll();
            const allTransactions = await evoStore.registrosFinancieros.getAll();

            // 2. Identify transaction IDs to delete (linked to invoices)
            const txIdsToDelete: string[] = [];
            allInvoices.forEach(inv => {
                const tx = allTransactions.find(t => t.referenciaId === inv.id);
                if (tx) txIdsToDelete.push(tx.id);
            });

            // 3. Perform Deletions
            // Invoices
            await evoStore.facturas.saveAll([]);

            // Clients (Delete all clients managed here)
            // Note: If clients are shared significantly, we might want to be more careful, 
            // but the requirement says "Delete all clients associated/created by this module".
            // Since this module reads/writes to the canonical 'clientes' store, 
            // and we treat this module as the primary manager of clients for now:
            await evoStore.clientes.saveAll([]);

            // Linked Transactions
            for (const txId of txIdsToDelete) {
                await evoStore.registrosFinancieros.delete(txId);
            }

            // 4. Reset Local State
            setInvoices([]);
            setClients([]);
            setCurrentPage(1);

            console.log('Facturación CRM data cleared successfully.');

        } catch (e) {
            console.error('Error clearing Facturación data:', e);
            throw e;
        } finally {
            setLoading(false);
            evoEvents.emit('invoice:updated');
            evoEvents.emit('finance:updated');
        }
    };

    const getNextFolio = () => {
        if (invoices.length === 0) return 'C100';

        const numbers = invoices.map(inv => {
            const match = inv.folio.match(/C(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        });

        const max = Math.max(...numbers, 0);
        return `C${max + 1}`;
    };

    const exportCSV = () => {
        const headers = FACTURAS_CSV_HEADERS_V2;

        const rows = invoices.map(inv => {
            const client = clients.find(c => c.rfc === inv.rfc);
            // We use the mapping helper but then extract exact fields to ensure order matches headers
            const rowObj = mapInvoiceToCsvRowV2(inv, client ? facturasMapper.clientToCanonical(client) : undefined);

            // STRICT ORDER according to FACTURAS_CSV_HEADERS_V2
            const rowValues = [
                rowObj.fecha,
                rowObj.numeroFactura,
                rowObj.nombre,
                rowObj.rfc,
                rowObj.monto,
                rowObj.fechaPago,
                rowObj.cp,
                rowObj.direccion,
                rowObj.metodoPago,
                rowObj.formaPago,
                rowObj.descripcion,
                rowObj.regimenFiscal,
                rowObj.correoOContacto
            ];

            return toCsvRow(rowValues);
        });

        const csvContent = [toCsvRow([...headers]), ...rows].join('\n'); // Standard uses CRLF usually but \n is fine for web

        // Add BOM for Excel compatibility
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `facturacion_evoapp_v2_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    type SkipReason = 'invalid_fecha' | 'invalid_monto' | 'duplicate_folio' | 'missing_required' | 'other';

    interface SkippedRowInfo {
        rowIndex: number;
        reason: SkipReason;
        message: string;
        rawRow: string;
        details?: Record<string, any>;
    }

    const importCSV = async (file: File): Promise<{
        imported: number;
        skipped: number;
        errors: string[];
        skippedByReason: Record<SkipReason, number>;
        skippedDetails: SkippedRowInfo[];
    }> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                if (!text) return;

                // 1. Parse with RFC4180 parser (handles quotes and newlines)
                const { data, errors: parseErrors } = parseCsv(text);

                const skippedByReason: Record<SkipReason, number> = {
                    invalid_fecha: 0,
                    invalid_monto: 0,
                    duplicate_folio: 0,
                    missing_required: 0,
                    other: 0
                };
                const skippedDetails: SkippedRowInfo[] = [];
                const errors: string[] = [...parseErrors];
                let imported = 0;
                let skipped = 0;

                const registerSkip = (rowIndex: number, reason: SkipReason, message: string, rawRow: string, details?: Record<string, any>) => {
                    skipped++;
                    skippedByReason[reason]++;
                    // Keep first 20 for debugging
                    if (skippedDetails.length < 20) {
                        skippedDetails.push({ rowIndex, reason, message, rawRow, details });
                    }
                };

                if (data.length < 2) {
                    resolve({ imported: 0, skipped: 0, errors: ['Archivo vacío o sin datos'], skippedByReason, skippedDetails });
                    return;
                }

                // 2. Identify Headers
                const fileHeaders = data[0];
                const { map: headerMap, missing } = buildV2HeaderMap(fileHeaders);

                // 3. Validate Mandatory Columns
                if (missing.length > 0) {
                    const msg = `Faltan columnas obligatorias: ${missing.join(', ')}`;
                    errors.push(msg);
                    resolve({ imported: 0, skipped: 0, errors, skippedByReason, skippedDetails });
                    return;
                }

                console.log("[Facturacion Import] Headers detected:", headerMap);

                // 4. Process Rows
                for (let i = 1; i < data.length; i++) {
                    const row = data[i];
                    // Skip empty rows (already handled by parser, but double check)
                    if (row.length === 0 || (row.length === 1 && !row[0])) continue;

                    try {
                        const getRaw = (field: V2CanonicalField): string => {
                            const idx = headerMap[field];
                            return (idx !== undefined && idx < row.length) ? row[idx] : '';
                        };

                        const rawFecha = getRaw('fecha');
                        const rawMonto = getRaw('monto');
                        const rawFolio = getRaw('numeroFactura');

                        // Normalization
                        const normalizedFecha = normalizeDate(rawFecha);
                        const parsedMonto = parseAmount(rawMonto);

                        // Validation
                        if (!normalizedFecha) {
                            registerSkip(i + 1, 'invalid_fecha', `Fecha inválida: '${rawFecha}'. Usa DD/MM/YYYY`, row.join(','), { rawFecha });
                            continue;
                        }
                        if (parsedMonto === null) {
                            registerSkip(i + 1, 'invalid_monto', `Monto inválido: '${rawMonto}'`, row.join(','), { rawMonto });
                            continue;
                        }

                        const finalFolio = rawFolio ? rawFolio.trim() : 'S/NUM';
                        if (invoices.some(inv => inv.folio === finalFolio)) {
                            registerSkip(i + 1, 'duplicate_folio', `Folio duplicado: '${finalFolio}'`, row.join(','), { folio: finalFolio });
                            continue;
                        }

                        const rawDescripcion = getRaw('descripcion');
                        console.log('[Facturacion Import] descripcion:', rawDescripcion);

                        // Map to Object
                        const rowData: FacturaCsvRowV2 = {
                            fecha: normalizedFecha,
                            numeroFactura: finalFolio,
                            nombre: getRaw('nombre'),
                            rfc: getRaw('rfc'),
                            monto: String(parsedMonto),
                            fechaPago: normalizeDate(getRaw('fechaPago')) || undefined,
                            cp: getRaw('cp') || undefined,
                            direccion: getRaw('direccion') || undefined,
                            metodoPago: getRaw('metodoPago') || undefined,
                            formaPago: getRaw('formaPago') || undefined,
                            descripcion: rawDescripcion || undefined,
                            regimenFiscal: getRaw('regimenFiscal') || undefined,
                            correoOContacto: getRaw('correoContacto') || undefined
                        };

                        // 5. Save Logic (Reused existing)
                        const { invoice, client } = mapCsvRowV2ToInvoice(rowData);

                        if (client.rfc) {
                            const existingClient = clients.find(c => c.rfc === client.rfc);
                            if (existingClient) {
                                await saveClient({ ...existingClient, ...client, id: existingClient.id });
                            } else {
                                await saveClient(client);
                            }
                        }

                        await saveInvoice(invoice);
                        imported++;

                    } catch (err) {
                        errors.push(`Error al importar línea ${i + 1}: ${err}`);
                        registerSkip(i + 1, 'other', `Error desconocido: ${err}`, row.join(','), { error: String(err) });
                    }
                }

                resolve({ imported, skipped, errors, skippedByReason, skippedDetails });
            };
            reader.readAsText(file);
        });
    };

    return {
        clients,
        invoices,
        loading,
        saveClient,
        updateClient,
        saveInvoice,
        deleteInvoice,
        clearFacturacionData,
        getNextFolio,
        exportCSV,
        importCSV,
        refresh: loadData,

        // Pagination & Filters
        pagedInvoices,
        totalItems,
        totalPages,
        currentPage,
        setCurrentPage,
        pageSize,

        filterDateFrom, setFilterDateFrom,
        filterDateTo, setFilterDateTo,
        filterCliente, setFilterCliente,
        filterFolio, setFilterFolio,
        filterStatus, setFilterStatus
    };
}
