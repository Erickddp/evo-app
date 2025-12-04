import type { BankMovement } from '../types/bank';
import { bankMovementsToCsv } from '../utils/bankCsv';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Configure worker
// Using a CDN for the worker to avoid complex build setup with Vite
// We use the version from the imported library to ensure compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export async function parseBankStatementPdf(file: File): Promise<{
    movements: BankMovement[];
    csvContent: string;
}> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        let fullTextLines: string[] = [];

        // 1. Extract text from all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Sort items by Y position (descending) then X position (ascending)
            // PDF coordinates: (0,0) is bottom-left usually.
            const items = textContent.items as TextItem[];

            // Group items by line (approximate Y)
            const lines: { y: number; text: string }[] = [];

            items.forEach((item) => {
                // Round Y to group items on the same line (tolerance of 2-3 units)
                // transform[5] is the translate-y component
                const y = Math.round(item.transform[5]);
                const existingLine = lines.find(l => Math.abs(l.y - y) < 5);

                if (existingLine) {
                    existingLine.text += ' ' + item.str;
                } else {
                    lines.push({ y, text: item.str });
                }
            });

            // Sort lines top-to-bottom (higher Y is higher on page in PDF)
            lines.sort((a, b) => b.y - a.y);

            fullTextLines.push(...lines.map(l => l.text.trim()));
        }

        // 2. Parse BBVA format
        const movements = parseBbvaLines(fullTextLines);

        if (movements.length === 0) {
            console.warn('No movements found. Dumping first 20 lines for debug:', fullTextLines.slice(0, 20));
            // Don't throw immediately if we have lines but no movements, maybe it's just empty?
            // But usually a statement has movements.
            if (fullTextLines.length > 0) {
                throw new Error('No se detectaron movimientos válidos. Asegúrate de que sea un estado de cuenta BBVA legible.');
            } else {
                throw new Error('No se pudo extraer texto del PDF. Es posible que sea una imagen escaneada.');
            }
        }

        // 3. Generate CSV
        const csvContent = bankMovementsToCsv(movements);

        return { movements, csvContent };

    } catch (error: any) {
        console.error('Error parsing PDF:', error);
        throw new Error(error.message || 'Error al procesar el archivo PDF.');
    }
}

function parseBbvaLines(lines: string[]): BankMovement[] {
    const movements: BankMovement[] = [];
    let isReadingMovements = false;

    // Regex to match a date at start of line: DD/MM or DD/MM/YYYY
    const dateRegex = /^(\d{2}\/\d{2}(\/\d{2,4})?)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Start reading after "Detalle de Movimientos" or similar header
        if (!isReadingMovements) {
            if (line.toUpperCase().includes('DETALLE DE MOVIMIENTOS') ||
                line.toUpperCase().includes('MOVIMIENTOS DEL PERIODO')) {
                isReadingMovements = true;
                continue;
            }
        }

        if (isReadingMovements) {
            // Stop if we hit end of section
            if (line.toUpperCase().includes('TOTAL DE MOVIMIENTOS') ||
                line.toUpperCase().includes('SALDO FINAL')) {
                break;
            }

            // Attempt to parse line
            const match = line.match(dateRegex);
            if (match) {
                const parsed = parseBbvaLine(line);
                if (parsed) {
                    movements.push(parsed);
                }
            }
        }
    }

    return movements;
}

function parseBbvaLine(line: string): BankMovement | null {
    try {
        // 1. Extract Dates
        // Expecting: DateOp DateVal ...
        const parts = line.split(/\s+/);
        if (parts.length < 4) return null;

        const date1 = parts[0]; // Oper
        const date2 = parts[1]; // Posting (sometimes same)

        // Validate dates
        if (!isValidDate(date1)) return null;

        // 2. Extract Amounts from end
        // We expect the last items to be numbers.
        // BBVA: ... Description ... Charge? Payment? Balance

        const parseAmount = (str: string) => {
            if (!str) return NaN;
            return parseFloat(str.replace(/,/g, ''));
        };

        const lastPart = parts[parts.length - 1];
        const secondLastPart = parts[parts.length - 2];

        const balance = parseAmount(lastPart);
        const amountOrEmpty = parseAmount(secondLastPart);

        if (isNaN(balance)) {
            return null;
        }

        let amount = 0;
        let type: 'ingreso' | 'egreso' = 'egreso';
        let descriptionEndIndex = parts.length - 1;

        if (!isNaN(amountOrEmpty)) {
            // We have a balance and a preceding number.

            // Check for 3 numbers at end (Charge, Payment, Balance)
            const thirdLastPart = parts[parts.length - 3];
            const val3 = parseAmount(thirdLastPart);

            if (!isNaN(val3)) {
                // 3 numbers found: Charge, Payment, Balance
                // If Charge is non-zero, it's Expense.
                // If Payment is non-zero, it's Income.
                // But usually one is 0 or empty?
                // In text extraction, empty columns might be skipped.
                // So if we see 3 numbers, it means both Charge and Payment columns had text?
                // Or maybe the Description ended with a number?

                // Let's assume:
                // If 3 numbers: Charge, Payment, Balance.
                // If Charge > 0 -> Egreso
                // If Payment > 0 -> Ingreso

                // But wait, parseAmount might return a number from description.
                // Let's rely on keywords for now as a safer fallback if we can't distinguish.

                // Actually, let's look at the "Amount" (secondLastPart).
                // If we only have 2 numbers (Amount, Balance), we need to guess type.

                amount = amountOrEmpty;
                descriptionEndIndex = parts.length - 2;

                // Heuristic: Keywords in description
                const desc = parts.slice(2, parts.length - 2).join(' ');
                const incomeKeywords = ['ABONO', 'DEPOSITO', 'NOMINA', 'TRASPASO A FAVOR', 'RECEPCION', 'PAGO DE INTERESES', 'VENTA'];
                if (incomeKeywords.some(k => desc.toUpperCase().includes(k))) {
                    type = 'ingreso';
                }
            } else {
                // Only 2 numbers found at end (Amount, Balance)
                amount = amountOrEmpty;
                descriptionEndIndex = parts.length - 2;

                const desc = parts.slice(2, parts.length - 2).join(' ');
                const incomeKeywords = ['ABONO', 'DEPOSITO', 'NOMINA', 'TRASPASO A FAVOR', 'RECEPCION', 'PAGO DE INTERESES', 'VENTA'];
                if (incomeKeywords.some(k => desc.toUpperCase().includes(k))) {
                    type = 'ingreso';
                }
            }
        } else {
            // Only balance found?
            return null;
        }

        const description = parts.slice(2, descriptionEndIndex).join(' ');

        return {
            id: `mov-${Math.random().toString(36).substr(2, 9)}`,
            operationDate: date1,
            postingDate: date2,
            description: description,
            amount: amount,
            type: type,
            balance: balance,
            rawLine: line
        };

    } catch (e) {
        return null;
    }
}

function isValidDate(str: string): boolean {
    return /^\d{2}\/\d{2}(\/\d{2,4})?$/.test(str);
}
