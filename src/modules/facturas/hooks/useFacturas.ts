import { useState, useEffect, useCallback } from 'react';
import { dataStore } from '../../../core/data/dataStore';
import type { Client, Invoice, FacturaPayload } from '../types';
import { type EvoTransaction, createEvoTransaction } from '../../../core/domain/evo-transaction';

const TOOL_ID = 'facturas-manager';

export function useFacturas() {
    const [clients, setClients] = useState<Client[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const records = await dataStore.listRecords<FacturaPayload>(TOOL_ID);
            const loadedClients: Client[] = [];
            const loadedInvoices: Invoice[] = [];

            records.forEach(record => {
                if (record.payload.type === 'client') {
                    loadedClients.push(record.payload.data as Client);
                } else if (record.payload.type === 'invoice') {
                    loadedInvoices.push(record.payload.data as Invoice);
                }
            });

            setClients(loadedClients);
            setInvoices(loadedInvoices);
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
        const payload: FacturaPayload = { type: 'client', data: client };
        await dataStore.saveRecord(TOOL_ID, payload);
        setClients(prev => {
            const others = prev.filter(c => c.id !== client.id);
            return [...others, client];
        });
        return client;
    };

    const updateClient = async (updatedClient: Client) => {
        const payload: FacturaPayload = { type: 'client', data: updatedClient };
        await dataStore.saveRecord(TOOL_ID, payload);

        setClients(prev => {
            const others = prev.filter(c => c.id !== updatedClient.id);
            return [...others, updatedClient];
        });
    };

    const saveInvoice = async (invoice: Invoice) => {
        // 1. Save Invoice
        const payload: FacturaPayload = { type: 'invoice', data: invoice };
        await dataStore.saveRecord(TOOL_ID, payload);

        setInvoices(prev => {
            const others = prev.filter(i => i.id !== invoice.id);
            return [...others, invoice];
        });

        // 2. Sync with EvoTransaction
        try {
            const records = await dataStore.listRecords<{ transactions: EvoTransaction[] }>('evo-transactions');
            let existingTransactions: EvoTransaction[] = [];
            if (records.length > 0) {
                records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                existingTransactions = records[0].payload.transactions || [];
            }

            // Find existing transaction for this invoice
            const existingIndex = existingTransactions.findIndex(t => t.metadata?.invoiceId === invoice.id);

            const transactionData = {
                date: invoice.invoiceDate,
                concept: `Factura ${invoice.folio} - ${invoice.clientName}`,
                amount: invoice.amount,
                type: 'ingreso' as const,
                source: 'facturacion-crm',
                metadata: {
                    invoiceId: invoice.id,
                    folio: invoice.folio,
                    clientId: invoice.rfc // using RFC as client ID proxy or we could use client ID if available
                }
            };

            let updatedTransactions = [...existingTransactions];

            if (existingIndex >= 0) {
                // Update existing
                updatedTransactions[existingIndex] = {
                    ...updatedTransactions[existingIndex],
                    ...transactionData,
                    amount: Math.abs(transactionData.amount)
                };
            } else {
                // Create new
                const newTransaction = createEvoTransaction(transactionData);
                updatedTransactions.push(newTransaction);
            }

            await dataStore.saveRecord('evo-transactions', {
                transactions: updatedTransactions,
                updatedAt: new Date().toISOString(),
                count: updatedTransactions.length,
            });

        } catch (e) {
            console.error('Error syncing invoice to transactions:', e);
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
        // EXACT headers requested: FOLIO,FECHA,CLIENTE,RFC,CORREO,CONCEPTO,MONTO,ESTADO,FORMA_PAGO,METODO_PAGO,USO_CFDI,NOTAS
        const headers = [
            'FOLIO', 'FECHA', 'CLIENTE', 'RFC', 'CORREO', 'CONCEPTO', 'MONTO', 'ESTADO', 'FORMA_PAGO', 'METODO_PAGO', 'USO_CFDI', 'NOTAS'
        ];

        const rows = invoices.map(inv => {
            return [
                inv.folio,
                inv.invoiceDate, // FECHA
                inv.clientName, // CLIENTE
                inv.rfc,
                inv.email || '',
                inv.concept || '', // CONCEPTO
                inv.amount,
                inv.status || (inv.paid ? 'Pagada' : 'Pendiente'), // ESTADO - fallback to paid status if new field missing
                inv.paymentForm || '',
                inv.paymentMethod || '',
                inv.cfdiUse || '',
                inv.notes || (inv as any).description || '' // NOTAS - fallback to description
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `facturacion-crm-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const importCSV = async (file: File): Promise<{ imported: number, skipped: number, errors: string[] }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                if (!text) return;

                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length < 2) {
                    resolve({ imported: 0, skipped: 0, errors: ['Archivo vacío o sin datos'] });
                    return;
                }

                // Normalize headers to uppercase for case-insensitive matching
                const header = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toUpperCase());
                const colMap = new Map<string, number>();
                header.forEach((h, i) => colMap.set(h, i));

                let imported = 0;
                let skipped = 0;
                const errors: string[] = [];

                const getValue = (cols: string[], name: string) => {
                    const idx = colMap.get(name);
                    if (idx === undefined) return '';
                    let val = cols[idx];
                    if (val && val.startsWith('"') && val.endsWith('"')) {
                        val = val.slice(1, -1).replace(/""/g, '"');
                    }
                    return val ? val.trim() : '';
                };

                const splitCSV = (line: string) => {
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
                            } else if (char === ',') {
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

                for (let i = 1; i < lines.length; i++) {
                    try {
                        const cols = splitCSV(lines[i]);

                        // Required fields: FOLIO, FECHA, MONTO
                        const folio = getValue(cols, 'FOLIO');
                        const fechaRaw = getValue(cols, 'FECHA');
                        const montoRaw = getValue(cols, 'MONTO');

                        if (!folio || !fechaRaw || !montoRaw) {
                            skipped++;
                            continue;
                        }

                        // Check duplicate folio
                        if (invoices.some(inv => inv.folio === folio)) {
                            skipped++;
                            continue;
                        }

                        // Parse Amount
                        const amount = parseFloat(montoRaw.replace(/[$,\s]/g, ''));
                        if (isNaN(amount)) {
                            skipped++;
                            continue;
                        }

                        // Parse Date
                        let invoiceDate = fechaRaw;
                        // Handle dd/mm/yyyy -> yyyy-mm-dd
                        if (fechaRaw.includes('/')) {
                            const parts = fechaRaw.split('/');
                            if (parts.length === 3) {
                                // Assume dd/mm/yyyy
                                invoiceDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            }
                        }

                        const rfc = getValue(cols, 'RFC');
                        const name = getValue(cols, 'CLIENTE');
                        const email = getValue(cols, 'CORREO');

                        // Upsert Client
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

                            // Compatibility / Derived
                            paid: status.toLowerCase().includes('pagada') || status.toLowerCase() === 'paid',
                            realized: true, // Assume imported invoices are realized

                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };

                        await saveInvoice(invoice);
                        imported++;
                    } catch (e) {
                        errors.push(`Error en línea ${i + 1}: ${e}`);
                    }
                }

                resolve({ imported, skipped, errors });
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
        getNextFolio,
        exportCSV,
        importCSV,
        refresh: loadData
    };
}
