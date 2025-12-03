import { useState, useEffect, useCallback } from 'react';
import { dataStore } from '../../../core/data/dataStore';
import type { Client, Invoice, FacturaPayload } from '../types';

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
        const payload: FacturaPayload = { type: 'invoice', data: invoice };
        await dataStore.saveRecord(TOOL_ID, payload);

        setInvoices(prev => {
            const others = prev.filter(i => i.id !== invoice.id);
            return [...others, invoice];
        });
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
        const headers = [
            'folio', 'fecha_factura', 'fecha_consulta', 'mes_factura',
            'nombre', 'rfc', 'correo_contacto', 'telefono', 'direccion', 'cp',
            'monto', 'clave_prod_serv', 'uso_cfdi', 'metodo_pago', 'forma_pago',
            'regimen_fiscal_emisor', 'regimen_fiscal_receptor',
            'factura_realizada', 'factura_pagada', 'fecha_pago', 'notas'
        ];

        const rows = invoices.map(inv => {
            return [
                inv.folio,
                inv.invoiceDate,
                inv.serviceDate || '',
                inv.month,
                inv.clientName,
                inv.rfc,
                inv.email || '',
                '',
                inv.address || '',
                inv.postalCode || '',
                inv.amount,
                inv.productKey || '',
                inv.cfdiUse || '',
                inv.paymentMethod || '',
                inv.paymentForm || '',
                '',
                inv.taxRegime || '',
                inv.realized ? 'Si' : 'No',
                inv.paid ? 'Si' : 'No',
                inv.paymentDate || '',
                inv.description || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `evorix-facturas-${new Date().toISOString().slice(0, 10)}.csv`);
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

                const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
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
                    return val;
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
                        const folio = getValue(cols, 'folio');

                        if (!folio) continue;

                        if (invoices.some(inv => inv.folio === folio)) {
                            skipped++;
                            continue;
                        }

                        const rfc = getValue(cols, 'rfc');
                        const name = getValue(cols, 'nombre');

                        let client = clients.find(c => c.rfc === rfc);
                        if (!client) {
                            client = {
                                id: crypto.randomUUID(),
                                rfc,
                                name,
                                email: getValue(cols, 'correo_contacto'),
                                address: getValue(cols, 'direccion'),
                                postalCode: getValue(cols, 'cp'),
                                taxRegime: getValue(cols, 'regimen_fiscal_receptor'),
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };
                            await saveClient(client);
                        }

                        const invoice: Invoice = {
                            id: crypto.randomUUID(),
                            folio,
                            invoiceDate: getValue(cols, 'fecha_factura'),
                            serviceDate: getValue(cols, 'fecha_consulta'),
                            month: getValue(cols, 'mes_factura') || getValue(cols, 'fecha_factura').slice(0, 7),
                            clientName: name,
                            rfc,
                            address: getValue(cols, 'direccion'),
                            postalCode: getValue(cols, 'cp'),
                            email: getValue(cols, 'correo_contacto'),
                            amount: parseFloat(getValue(cols, 'monto')) || 0,
                            productKey: getValue(cols, 'clave_prod_serv'),
                            cfdiUse: getValue(cols, 'uso_cfdi'),
                            paymentMethod: getValue(cols, 'metodo_pago'),
                            paymentForm: getValue(cols, 'forma_pago'),
                            taxRegime: getValue(cols, 'regimen_fiscal_receptor'),
                            realized: getValue(cols, 'factura_realizada').toLowerCase() === 'si',
                            paid: getValue(cols, 'factura_pagada').toLowerCase() === 'si',
                            paymentDate: getValue(cols, 'fecha_pago'),
                            description: getValue(cols, 'notas'),
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
