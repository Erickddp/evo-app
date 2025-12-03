import { type EvoTransaction, createEvoTransaction } from '../../core/domain/evo-transaction';

export function parseIngresosCsv(content: string): EvoTransaction[] {
    const lines = content.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));

    // Schema A: New Standard (Fecha, Concepto, Ingreso, Gasto)
    const idxFecha = headers.findIndex(h => h === 'fecha');
    const idxConcepto = headers.findIndex(h => h === 'concepto');
    const idxIngreso = headers.findIndex(h => h === 'ingreso');
    const idxGasto = headers.findIndex(h => h === 'gasto');

    // Schema B: Old/Compatible (Fecha, Concepto, Monto, Tipo)
    const idxMonto = headers.findIndex(h => h === 'monto');
    const idxTipo = headers.findIndex(h => h === 'tipo');

    const isNewSchema = idxFecha !== -1 && idxConcepto !== -1 && idxIngreso !== -1 && idxGasto !== -1;
    const isOldSchema = idxFecha !== -1 && idxConcepto !== -1 && idxMonto !== -1 && idxTipo !== -1;

    if (!isNewSchema && !isOldSchema) {
        throw new Error('Formato de CSV no reconocido. Se espera: Fecha, Concepto, Ingreso, Gasto');
    }

    const newMovements: EvoTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',');

        const cleanText = (str: string | undefined) => {
            return str ? str.replace(/^"|"$/g, '').trim() : '';
        };

        const parseCurrency = (str: string | undefined) => {
            if (!str) return 0;
            const clean = str.replace(/["$,\s]/g, '');
            const val = parseFloat(clean);
            return isNaN(val) ? 0 : val;
        };

        let dateStr = '';
        let conceptStr = '';
        let amount = 0;
        let type: 'ingreso' | 'gasto' = 'ingreso'; // Default, will be set correctly

        if (isNewSchema) {
            dateStr = cleanText(cols[idxFecha]);
            conceptStr = cleanText(cols[idxConcepto]);
            const ingresoVal = parseCurrency(cols[idxIngreso]);
            const gastoVal = parseCurrency(cols[idxGasto]);

            if (ingresoVal === 0 && gastoVal === 0) continue;

            if (ingresoVal > 0) {
                amount = ingresoVal;
                type = 'ingreso';
            } else if (gastoVal > 0) {
                amount = gastoVal;
                type = 'gasto';
            }

            if (gastoVal > 0 && ingresoVal > 0) {
                if (gastoVal > ingresoVal) {
                    amount = gastoVal;
                    type = 'gasto';
                } else {
                    amount = ingresoVal;
                    type = 'ingreso';
                }
            }

        } else {
            // Old Schema
            dateStr = cleanText(cols[idxFecha]);
            conceptStr = cleanText(cols[idxConcepto]);
            const montoVal = parseCurrency(cols[idxMonto]);
            const tipoStr = cleanText(cols[idxTipo]).toLowerCase();

            if (tipoStr.includes('gasto') || tipoStr.includes('expense')) {
                amount = Math.abs(montoVal);
                type = 'gasto';
            } else {
                amount = Math.abs(montoVal);
                type = 'ingreso';
            }
        }

        // Date Parsing
        if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                dateStr = d.toISOString().split('T')[0];
            }
        }

        if (!dateStr || !conceptStr || amount <= 0) continue;

        try {
            const movement = createEvoTransaction({
                date: dateStr,
                concept: conceptStr,
                amount: amount,
                type: type,
                source: 'manual-csv'
            });
            newMovements.push(movement);
        } catch (e) {
            console.warn('Skipping invalid movement:', e);
        }
    }

    return newMovements;
}
