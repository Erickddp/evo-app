import { useState, useEffect, useCallback, useMemo } from 'react';
import { evoStore } from '../../../../core/evoappDataStore';
import { facturasMapper } from '../../../../core/mappers/facturasMapper';
import { ingresosMapper } from '../../../../core/mappers/ingresosMapper';
import type { Client, Invoice } from '../types';
import type { Factura } from '../../../../core/evoappDataModel';
import { createEvoTransaction } from '../../../../core/domain/evo-transaction';
import type { SatImportRow } from '../utils/satParser';
import type { RegistroFinanciero } from '../../../core/financial/types';
import {
    FACTURAS_CSV_HEADERS_V2,
    mapInvoiceToCsvRowV2,
    mapCsvRowV2ToInvoice,
    buildV2HeaderMap,
    type FacturaCsvRowV2,
    type V2CanonicalField
} from '../csvSchemaV2';
import { parseCsv, toCsvRow, normalizeDate, parseAmount } from '../utils/csvParser';
import { calculateNextFolio, getSerieFromFolio, type FolioSerie } from '../utils/folioUtils';
import { evoEvents } from '../../../../core/events';

function fixMojibake(input: string): string {
    try {
        return decodeURIComponent(escape(input));
    } catch {
        return input;
    }
}

export function useFacturas(targetMonth?: string) {
    const [clients, setClients] = useState<Client[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');
    const [filterCliente, setFilterCliente] = useState<string>('');
    const [filterFolio, setFilterFolio] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('todos');

    // Sync filters with targetMonth if provided
    useEffect(() => {
        if (targetMonth) {
            const [y, m] = targetMonth.split('-').map(Number);
            const start = `${targetMonth}-01`;
            const end = new Date(y, m, 0).toISOString().split('T')[0];
            setFilterDateFrom(start);
            setFilterDateTo(end);
        }
    }, [targetMonth]);


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
            }
        } catch (error) {
            console.error('Error loading facturas data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();

        const handleDataChanged = () => {
            setLoading(true);
            setClients([]);
            setInvoices([]);
            setCurrentPage(1);
            loadData();
        };

        evoEvents.on('data:changed', handleDataChanged);
        return () => evoEvents.off('data:changed', handleDataChanged);
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
            // In canonical model: links.facturaId
            const existingIndex = allTransactions.findIndex(t => t.links?.facturaId === invoice.id);

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
            canonicalTx.links = { ...canonicalTx.links, facturaId: invoice.id };

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
            const linkedTx = allTransactions.find(t => t.links?.facturaId === invoiceId);

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
                const tx = allTransactions.find(t => t.links?.facturaId === inv.id);
                if (tx) txIdsToDelete.push(tx.id);
            });

            // 3. Perform Deletions
            // Invoices
            await evoStore.facturas.saveAll([]);

            // Clients
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

    const exportCSV = () => {
        const headers = FACTURAS_CSV_HEADERS_V2;

        const rows = invoices.map(inv => {
            const client = clients.find(c => c.rfc === inv.rfc);
            const rowObj = mapInvoiceToCsvRowV2(inv, client ? facturasMapper.clientToCanonical(client) : undefined);

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

        const csvContent = [toCsvRow([...headers]), ...rows].join('\n');

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
                console.time('import');
                const text = e.target?.result as string;
                if (!text) {
                    console.timeEnd('import');
                    return;
                }

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
                    console.timeEnd('import');
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
                    console.timeEnd('import');
                    resolve({ imported: 0, skipped: 0, errors, skippedByReason, skippedDetails });
                    return;
                }

                console.log("[Facturacion Import] Headers detected:", headerMap);

                // Collections for Batch Save
                const newInvoices: Invoice[] = [];
                const newClientsMap = new Map<string, Client>(); // Keyed by RFC to ensure unique per batch

                // 4. Process Rows (Sync Loop)
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

                        // Check against existing invoices state
                        if (invoices.some(inv => inv.folio === finalFolio)) {
                            registerSkip(i + 1, 'duplicate_folio', `Folio duplicado: '${finalFolio}'`, row.join(','), { folio: finalFolio });
                            continue;
                        }
                        // Check against batch duplicates
                        if (newInvoices.some(inv => inv.folio === finalFolio)) {
                            registerSkip(i + 1, 'duplicate_folio', `Folio duplicado en este archivo: '${finalFolio}'`, row.join(','), { folio: finalFolio });
                            continue;
                        }

                        const rawDescripcion = getRaw('descripcion');
                        const concepto = (rawDescripcion ?? '').trim();

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
                            descripcion: concepto || undefined,
                            concepto: concepto || undefined,
                            conceptoGeneral: concepto || undefined,
                            regimenFiscal: getRaw('regimenFiscal') || undefined,
                            correoOContacto: getRaw('correoContacto') || undefined
                        };

                        // Transform to Domain Models
                        const { invoice, client } = mapCsvRowV2ToInvoice(rowData);

                        // Add to batch collections
                        if (client.rfc) {
                            newClientsMap.set(client.rfc, client);
                        }

                        newInvoices.push(invoice);
                        imported++;

                    } catch (err) {
                        errors.push(`Error al importar línea ${i + 1}: ${err}`);
                        registerSkip(i + 1, 'other', `Error desconocido: ${err}`, row.join(','), { error: String(err) });
                    }
                }

                // 5. Batch Save Phase (Perf Optimization)
                if (newInvoices.length > 0) {
                    // 5a. Save Clients
                    const clientsToSave: Client[] = [];

                    newClientsMap.forEach((newClient) => {
                        const existing = clients.find(c => c.rfc === newClient.rfc);
                        if (existing) {
                            // Use existing ID to trigger update
                            clientsToSave.push({ ...existing, ...newClient, id: existing.id });
                        } else {
                            clientsToSave.push(newClient);
                        }
                    });

                    if (clientsToSave.length > 0) {
                        const finalClients = [...clients];
                        clientsToSave.forEach(c => {
                            const idx = finalClients.findIndex(ex => ex.id === c.id);
                            if (idx >= 0) finalClients[idx] = c;
                            else finalClients.push(c);
                        });
                        await evoStore.clientes.saveAll(finalClients.map(facturasMapper.clientToCanonical));
                        setClients(finalClients);
                    }

                    // 5b. Save Invoices (Assume Append)
                    const finalInvoices = [...invoices, ...newInvoices];
                    await evoStore.facturas.saveAll(finalInvoices.map(facturasMapper.invoiceToCanonical));
                    setInvoices(finalInvoices);

                    // 5c. Create Batched Transactions
                    const allTransactions = await evoStore.registrosFinancieros.getAll();
                    const newTransactions: any[] = [];

                    newInvoices.forEach(inv => {
                        const transactionData = {
                            date: inv.invoiceDate,
                            concept: `Factura ${inv.folio} - ${inv.clientName}`,
                            amount: inv.amount,
                            type: 'ingreso' as const,
                            source: 'facturacion-crm',
                            metadata: {
                                invoiceId: inv.id,
                                folio: inv.folio,
                                clientId: inv.rfc
                            },
                        };

                        const tx = createEvoTransaction(transactionData);
                        const canonicalTx = ingresosMapper.toCanonical(tx);
                        canonicalTx.links = { ...canonicalTx.links, facturaId: inv.id };
                        newTransactions.push(canonicalTx);
                    });

                    if (newTransactions.length > 0) {
                        const finalTransactions = [...allTransactions, ...newTransactions];
                        await evoStore.registrosFinancieros.saveAll(finalTransactions);
                    }

                    // 6. Emit Events Once
                    evoEvents.emit('invoice:updated');
                    if (newTransactions.length > 0) evoEvents.emit('finance:updated');
                }

                console.timeEnd('import');
                resolve({ imported, skipped, errors, skippedByReason, skippedDetails });
            };
            reader.readAsText(file);
        });
    };

    const repairConcepts = async () => {
        const updatedInvoices = invoices.map(inv => {
            if (!inv.concept && !inv.conceptoGeneral && !inv.descripcion) {
                return { ...inv, concept: '(sin descripción recuperada)', conceptoGeneral: '(sin descripción recuperada)', descripcion: '(sin descripción recuperada)' };
            }
            const valid = inv.concept || inv.conceptoGeneral || inv.descripcion;
            if (valid) {
                return { ...inv, concept: inv.concept || valid, conceptoGeneral: inv.conceptoGeneral || valid, descripcion: inv.descripcion || valid };
            }
            return inv;
        });

        let changes = 0;
        updatedInvoices.forEach((u, i) => {
            const o = invoices[i];
            if (u.concept !== o.concept) changes++;
        });

        if (changes > 0) {
            console.log(`Reparing ${changes} invoices...`);
            await evoStore.facturas.saveAll(updatedInvoices.map(facturasMapper.invoiceToCanonical));
            setInvoices(updatedInvoices);
            alert(`Reparadas ${changes} facturas. Recargando...`);
        } else {
            alert('Nada que reparar.');
        }
    };

    const getNextFolio = () => {
        const now = new Date().toISOString().slice(0, 10);
        const suggestion = calculateNextFolio(invoices, 'C', now);
        return suggestion.folio;
    };

    const suggestNextFolio = (serie: FolioSerie, dateStr: string) => {
        return calculateNextFolio(invoices, serie, dateStr);
    };

    const duplicateInvoice = async (originalId: string) => {
        try {
            const original = await evoStore.facturas.getById(originalId);
            if (!original) throw new Error('Factura original no encontrada');
            const originalLegacy = facturasMapper.invoiceToLegacy(original);

            const nextFolioStats = calculateNextFolio(invoices, getSerieFromFolio(originalLegacy.folio), new Date().toISOString().slice(0, 10));

            const newInvoice: Invoice = {
                ...originalLegacy,
                id: crypto.randomUUID(),
                folio: nextFolioStats.folio, // Auto-assign next folio or keep original's pattern? Standard is new folio.
                invoiceDate: new Date().toISOString().slice(0, 10), // Today
                paid: false,
                realized: false,
                paymentDate: undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Should we replicate links? No.
            delete newInvoice.links;
            delete newInvoice.metadata;

            await saveInvoice(newInvoice);

            // Reload
            loadData();

        } catch (e) {
            console.error('Error duplicating:', e);
            alert('Error al duplicar factura');
        }
    };

    const saveSatInvoices = async (rows: SatImportRow[], options?: { mode: 'factura_only' | 'projected' | 'financial_real', overrideType?: 'ingreso' | 'gasto' }) => {
        const { mode = 'projected', overrideType } = options || {};
        let count = 0;
        let errors = 0;

        for (const row of rows) {
            try {
                // Dedupe: check if UUID exists
                // We check by link: { satUuid: row.uuid }
                // Searching logic might be slow if we don't have index.
                // We'll iterate all current invoices? No, that's slow.
                // Database query is better.
                // IndexedDB filter.

                // Assuming we can't easily add indices now, we do inefficient check or rely on `id`.
                // We'll use id = `sat:${row.uuid}` as deterministic ID.
                const deterministicId = `sat:${row.uuid}`;
                const exists = await evoStore.facturas.getById(deterministicId);

                if (exists) {
                    console.log(`Skipping duplicate SAT UUID: ${row.uuid}`);
                    continue;
                }

                // Create Invoice (Canonical Factura)
                const factura: Factura = {
                    id: deterministicId,
                    folio: `SAT-${row.uuid.slice(-6)}`,
                    fechaEmision: row.fechaEmisionISODate,
                    total: row.montoNumber,
                    estado: row.estatus === 'Cancelado' ? 'cancelada' : 'pendiente',
                    pagada: false, // Default
                    clienteNombre: row.type === 'ingreso' ? row.nombreReceptor : row.nombreEmisor,
                    rfcCliente: row.type === 'ingreso' ? row.rfcReceptor : row.rfcEmisor,
                    concepto: `SAT Import: ${row.type.toUpperCase()}`,
                    moneda: 'MXN',
                    tipoComprobante: (overrideType ? (overrideType === 'ingreso' ? 'I' : 'E') : (row.type === 'ingreso' ? 'I' : 'E')),
                    formaPago: '99',
                    metodoPago: 'PPD',
                    usoCfdi: 'G03',
                    // Extension fields
                    links: {
                        satUuid: row.uuid
                    },
                    metadata: {
                        rfcEmisor: row.rfcEmisor,
                        rfcReceptor: row.rfcReceptor,
                        efecto: row.efecto,
                        estatusSat: row.estatus
                    }
                };



                await evoStore.facturas.add(factura);

                // Create Financial Record (If mode allows)
                if (mode !== 'factura_only') {
                    const finalType = overrideType || (row.type === 'ingreso' ? 'ingreso' : 'gasto');

                    const finRecord: RegistroFinanciero = {
                        id: crypto.randomUUID(),
                        date: factura.fechaEmision,
                        concept: `SAT: ${factura.clienteNombre} [${factura.folio}]`,
                        amount: factura.total,
                        type: finalType,
                        source: 'sat-import',
                        taxability: finalType === 'gasto' ? 'unknown' : 'deducible', // Default assumption
                        links: {
                            facturaId: factura.id,
                            satUuid: row.uuid
                        },
                        metadata: {
                            ...factura.metadata,
                            isProjected: mode === 'projected',
                            isReconciled: false // Explicitly false initially
                        },
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    await evoStore.registrosFinancieros.add(finRecord);
                }

                count++;
            } catch (e) {
                console.error(e);
                errors++;
            }
        }

        await loadData();
        return { count, errors };
    };

    const reconcileInvoice = async (invoiceId: string, bankRecordId: string) => {
        const inv = await evoStore.facturas.getById(invoiceId);
        if (!inv) return;

        const bankRec = await evoStore.registrosFinancieros.getById(bankRecordId);
        if (!bankRec) return;

        // Update Invoice (Factura)
        const updatedInv: Factura = {
            ...inv,
            pagada: true,
            estado: 'pagada',
            fechaPago: bankRec.date,
            links: {
                ...inv.links,
                reconciledTo: bankRecordId
            },
            metadata: {
                ...inv.metadata,
                isReconciled: true,
                reconciledAt: new Date().toISOString()
            }
        };
        await evoStore.facturas.add(updatedInv);

        // Find associated Financial Record of the Invoice (NOT the bank one)
        // We need to mark IT as reconciled so it doesn't count in dashboard
        // We find it by links.facturaId
        const allRecs = await evoStore.registrosFinancieros.getAll();
        const associatedRec = allRecs.find(r => r.links?.facturaId === invoiceId);

        if (associatedRec) {
            const updatedRec = {
                ...associatedRec,
                links: {
                    ...associatedRec.links,
                    reconciledTo: bankRecordId
                },
                metadata: {
                    ...associatedRec.metadata,
                    isReconciled: true,
                    reconciledAt: new Date().toISOString()
                }
            };
            await evoStore.registrosFinancieros.add(updatedRec);
        }

        await loadData();
    };

    const getLastInvoiceForClient = (rfc: string) => {
        return invoices
            .filter(i => i.rfc === rfc)
            .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())[0];
    };

    const repairEncoding = async () => {
        let changes = 0;

        // 1. Fix Clients
        const updatedClients = clients.map(c => {
            const fixedC = { ...c };
            let modified = false;

            const fields: (keyof Client)[] = ['name', 'address', 'taxRegime', 'email'];
            fields.forEach(f => {
                const val = fixedC[f];
                if (typeof val === 'string') {
                    const fixed = fixMojibake(val);
                    if (fixed !== val) {
                        fixedC[f] = fixed;
                        modified = true;
                    }
                }
            });
            if (modified) changes++;
            return fixedC;
        });

        // 2. Fix Invoices
        const updatedInvoices = invoices.map(inv => {
            const fixedInv = { ...inv };
            let modified = false;

            // Fix relevant string fields
            const fields: (keyof Invoice)[] = ['clientName', 'concept', 'conceptoGeneral', 'descripcion', 'cfdiUse', 'paymentMethod', 'status']; // Added status just in case (e.g. Pendiente)
            fields.forEach(f => {
                const val = fixedInv[f];
                if (typeof val === 'string') {
                    const fixed = fixMojibake(val);
                    if (fixed !== val) {
                        // @ts-ignore
                        fixedInv[f] = fixed;
                        modified = true;
                    }
                }
            });

            if (modified) changes++;
            return fixedInv;
        });

        if (changes > 0) {
            console.log(`Reparing encoding in ${changes} records...`);

            // Save Clients
            const normalizedClients = updatedClients.map(c => ({
                ...c,
                razonSocial: (c as any).razonSocial ?? c.name ?? '',
                fechaRegistro: (c as any).fechaRegistro ?? c.createdAt ?? new Date().toISOString(),
            }));
            await evoStore.clientes.saveAll(normalizedClients);
            // Save Invoices
            await evoStore.facturas.saveAll(updatedInvoices.map(facturasMapper.invoiceToCanonical));

            // Update State
            setClients(updatedClients);
            setInvoices(updatedInvoices);

            alert(`Se repararon caracteres dañados en ${changes} registros.`);
        } else {
            alert('No se encontraron problemas de codificación (mojibake).');
        }
    };

    return {
        clients,
        invoices,
        loading,
        saveClient,
        updateClient,
        saveInvoice,
        deleteInvoice,
        duplicateInvoice,
        getLastInvoiceForClient,
        clearFacturacionData,
        getNextFolio,
        suggestNextFolio,
        exportCSV,
        importCSV,
        refresh: loadData,
        repairConcepts,
        repairEncoding,

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
        filterStatus, setFilterStatus,

        saveSatInvoices,
        reconcileInvoice
    };
}
