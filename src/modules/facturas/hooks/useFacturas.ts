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
    type FacturaCsvRowV2
} from '../csvSchemaV2';

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
        const headers = [...FACTURAS_CSV_HEADERS_V2];

        const rows = invoices.map(inv => {
            const client = clients.find(c => c.rfc === inv.rfc);
            const canonicalClient = client ? facturasMapper.clientToCanonical(client) : undefined;
            const rowOnly = mapInvoiceToCsvRowV2(inv, canonicalClient);

            return [
                rowOnly.fecha,
                rowOnly.numeroFactura,
                rowOnly.nombre,
                rowOnly.rfc,
                rowOnly.monto,
                rowOnly.fechaPago || '',
                rowOnly.cp || '',
                rowOnly.direccion || '',
                rowOnly.metodoPago || '',
                rowOnly.formaPago || '',
                rowOnly.descripcion || '',
                rowOnly.regimenFiscal || '',
                rowOnly.correoOContacto || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
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

                const lines = text.split(/\r?\n/).filter(l => l.trim());

                // Initialize result containers
                const skippedByReason: Record<SkipReason, number> = {
                    invalid_fecha: 0,
                    invalid_monto: 0,
                    duplicate_folio: 0,
                    missing_required: 0,
                    other: 0
                };
                const skippedDetails: SkippedRowInfo[] = [];

                if (lines.length < 2) {
                    resolve({ imported: 0, skipped: 0, errors: ['Archivo vacío o sin datos'], skippedByReason, skippedDetails });
                    return;
                }

                // --- 1. DETECT DELIMITER ---
                const detectDelimiter = (header: string): "," | ";" => {
                    const commas = (header.match(/,/g) || []).length;
                    const semis = (header.match(/;/g) || []).length;
                    return semis > commas ? ";" : ",";
                };

                const delimiter = detectDelimiter(lines[0]);
                console.log(`[Facturacion Import] Detected delimiter: "${delimiter}"`);

                // Helper: Split CSV line respecting quotes with dynamic delimiter
                const splitCSV = (line: string, delim: string) => {
                    const res: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (inQuotes) {
                            if (char === '"') {
                                if (i + 1 < line.length && line[i + 1] === '"') {
                                    current += '"';
                                    i++;
                                } else {
                                    inQuotes = false;
                                }
                            } else {
                                current += char;
                            }
                        } else {
                            if (char === '"') {
                                inQuotes = true;
                            } else if (char === delim) {
                                res.push(current);
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                    }
                    res.push(current);
                    return res;
                };

                // --- V2 HELPERS ---
                const cleanHeader = (h: string) => h.trim().toLowerCase();

                // Map of Internal Field Key -> List of possible CSV headers
                const V2_HEADER_MAPPING: Record<keyof FacturaCsvRowV2, string[]> = {
                    fecha: ['fecha', 'fecha de emision', 'fecha emision'],
                    numeroFactura: ['numero de factura', 'numero de', 'num de factura', 'folio', 'factura'],
                    nombre: ['nombre', 'cliente', 'razon social'],
                    rfc: ['rfc'],
                    monto: ['monto', 'total', 'importe'],
                    fechaPago: ['fecha de pago', 'fecha pago', 'fecha p'],
                    cp: ['cp', 'codigo postal', 'c.p.'],
                    direccion: ['direccion', 'domicilio'],
                    metodoPago: ['metodo de pago', 'metodo de p', 'metodo pago'],
                    formaPago: ['forma de pago', 'forma de p', 'forma pago'],
                    descripcion: ['descripcion', 'concepto'],
                    regimenFiscal: ['regimen fiscal', 'regimen fis'],
                    correoOContacto: ['correo o contacto', 'correo o contac', 'correo', 'contacto', 'email']
                };

                // Helper to find column index for a field
                const findColumnIndex = (fileHeaders: string[], fieldKey: keyof FacturaCsvRowV2): number => {
                    return fileHeaders.findIndex(header => {
                        const h = cleanHeader(header);
                        const candidates = V2_HEADER_MAPPING[fieldKey];
                        if (candidates.includes(h)) return true;
                        // Fuzzy prefix match (N chars)
                        return candidates.some(c => {
                            if (h.length >= 5 && c.startsWith(h)) return true;
                            return false;
                        });
                    });
                };

                const parseMonto = (raw: string | number | null | undefined): number | null => {
                    if (raw == null) return null;
                    if (typeof raw === "number") return raw;
                    const cleaned = String(raw).replace(/[^0-9.-]/g, "");
                    if (!cleaned) return null;
                    const value = Number(cleaned);
                    return isFinite(value) ? value : null;
                };

                const normalizeDate = (raw: string | null | undefined): string | null => {
                    if (!raw) return null;
                    const s = String(raw).trim();
                    if (!s) return null;
                    if (s.includes("/")) {
                        const [dd, mm, yyyy] = s.split(/[\/]/);
                        if (dd && mm && yyyy) {
                            if (dd.length <= 2 && mm.length <= 2 && yyyy.length === 4) {
                                return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
                            }
                        }
                    }
                    if (/\d{4}-\d{2}-\d{2}/.test(s)) return s;
                    const d = new Date(s);
                    if (isNaN(d.getTime())) return null;
                    return d.toISOString().slice(0, 10);
                };

                // Detect V2
                const fileHeaders = splitCSV(lines[0], delimiter);
                const fechaIdx = findColumnIndex(fileHeaders, 'fecha');
                const adminIdx = findColumnIndex(fileHeaders, 'numeroFactura');
                const amountIdx = findColumnIndex(fileHeaders, 'monto');

                const isV2 = fechaIdx !== -1 && adminIdx !== -1 && amountIdx !== -1;

                let imported = 0;
                let skipped = 0;
                const errors: string[] = [];
                // Helper to register skipped row
                const registerSkip = (rowIndex: number, reason: SkipReason, message: string, rawRow: string) => {
                    skipped++;
                    skippedByReason[reason]++;
                    // Keep first 20 for debugging
                    if (skippedDetails.length < 20) {
                        skippedDetails.push({ rowIndex, reason, message, rawRow });
                    }
                };

                if (isV2) {
                    // --- V2 LOGIC ---
                    const colMap: Partial<Record<keyof FacturaCsvRowV2, number>> = {};
                    (Object.keys(V2_HEADER_MAPPING) as Array<keyof FacturaCsvRowV2>).forEach(key => {
                        const idx = findColumnIndex(fileHeaders, key);
                        if (idx !== -1) colMap[key] = idx;
                    });

                    for (let i = 1; i < lines.length; i++) {
                        try {
                            const rawRowStr = lines[i];
                            const cols = splitCSV(rawRowStr, delimiter);

                            const getRaw = (key: keyof FacturaCsvRowV2) => {
                                const idx = colMap[key];
                                if (idx === undefined || idx >= cols.length) return '';
                                let val = cols[idx];
                                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
                                return val.trim();
                            };

                            const rawFecha = getRaw('fecha');
                            const rawMonto = getRaw('monto');
                            const rawFolio = getRaw('numeroFactura');

                            const normalizedFecha = normalizeDate(rawFecha);
                            const parsedMonto = parseMonto(rawMonto);

                            // VALIDATION & LOGGING
                            if (!normalizedFecha) {
                                registerSkip(i + 1, 'invalid_fecha', `Fecha inválida: '${rawFecha}'`, rawRowStr);
                                continue;
                            }
                            if (parsedMonto === null) {
                                registerSkip(i + 1, 'invalid_monto', `Monto inválido: '${rawMonto}'`, rawRowStr);
                                continue;
                            }

                            const finalFolio = rawFolio || 'S/NUM';

                            if (invoices.some(inv => inv.folio === finalFolio)) {
                                registerSkip(i + 1, 'duplicate_folio', `Folio duplicado: '${finalFolio}'`, rawRowStr);
                                continue;
                            }

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
                                descripcion: getRaw('descripcion') || undefined,
                                regimenFiscal: getRaw('regimenFiscal') || undefined,
                                correoOContacto: getRaw('correoOContacto') || undefined
                            };

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
                            errors.push(`V2 Import Error línea ${i + 1}: ${err}`);
                            registerSkip(i + 1, 'other', `Error desconocido: ${err}`, lines[i]);
                        }
                    }

                } else {
                    // LEGACY LOGIC with new delimiter support
                    const headerRaw = lines[0];
                    const legacyFileHeaders = splitCSV(headerRaw, delimiter).map(h => h.trim().toUpperCase());

                    const header = legacyFileHeaders.map(h => h.replace(/"/g, ''));
                    const colMap = new Map<string, number>();
                    header.forEach((h, i) => colMap.set(h, i));

                    const getValue = (cols: string[], name: string) => {
                        const idx = colMap.get(name);
                        if (idx === undefined) return '';
                        let val = cols[idx];
                        if (val && val.startsWith('"') && val.endsWith('"')) {
                            val = val.slice(1, -1).replace(/""/g, '"');
                        }
                        return val ? val.trim() : '';
                    };

                    for (let i = 1; i < lines.length; i++) {
                        try {
                            const cols = splitCSV(lines[i], delimiter);

                            const folio = getValue(cols, 'FOLIO');
                            const fechaRaw = getValue(cols, 'FECHA');
                            const montoRaw = getValue(cols, 'MONTO');

                            if (!folio || !fechaRaw || !montoRaw) {
                                skipped++;
                                continue;
                            }
                            if (invoices.some(inv => inv.folio === folio)) {
                                skipped++;
                                continue;
                            }
                            const amount = parseFloat(montoRaw.replace(/[$,\s]/g, ''));
                            if (isNaN(amount)) {
                                skipped++;
                                continue;
                            }

                            let invoiceDate = fechaRaw;
                            if (fechaRaw.includes('/')) {
                                const parts = fechaRaw.split('/');
                                if (parts.length === 3) {
                                    invoiceDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                                }
                            }

                            const rfc = getValue(cols, 'RFC');
                            const name = getValue(cols, 'CLIENTE');
                            const email = getValue(cols, 'CORREO');

                            if (rfc) {
                                let client = clients.find(c => c.rfc === rfc);
                                if (!client) {
                                    client = {
                                        id: crypto.randomUUID(),
                                        rfc,
                                        name: name || 'Cliente Sin Nombre',
                                        email,
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString()
                                    };
                                    await saveClient(client);
                                }
                            }

                            const status = getValue(cols, 'ESTADO');
                            const invoice: Invoice = {
                                id: crypto.randomUUID(),
                                folio,
                                invoiceDate,
                                month: invoiceDate.slice(0, 7),
                                clientName: name,
                                rfc,
                                email,
                                concept: getValue(cols, 'CONCEPTO'),
                                amount,
                                status,
                                paymentForm: getValue(cols, 'FORMA_PAGO'),
                                paymentMethod: getValue(cols, 'METODO_PAGO'),
                                cfdiUse: getValue(cols, 'USO_CFDI'),
                                notes: getValue(cols, 'NOTAS'),
                                paid: status.toLowerCase().includes('pagada') || status.toLowerCase() === 'paid',
                                realized: true,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };

                            await saveInvoice(invoice);
                            imported++;
                        } catch (e) {
                            errors.push(`Legacy Import Error línea ${i + 1}: ${e}`);
                        }
                    }
                }

                if (skippedDetails.length > 0) {
                    console.warn("[Facturacion Import] Skipped rows details:", skippedDetails);
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
