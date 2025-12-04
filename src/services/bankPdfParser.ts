import type { BankMovement } from '../types/bank';
import { bankMovementsToCsv } from '../utils/bankCsv';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Configure worker for Vite
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function parseBankStatementPdf(file: File): Promise<{
    movements: BankMovement[];
    csvContent: string;
}> {
    try {
        const arrayBuffer = await file.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.449/cmaps/',
            cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        let fullTextLines: string[] = [];

        // 1. Extract text from all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const items = textContent.items as TextItem[];

            // Group items by line (approximate Y)
            const lines: { y: number; text: string }[] = [];

            items.forEach((item) => {
                // Round Y to group items on the same line (tolerance of 2-3 units)
                const y = Math.round(item.transform[5]);
                const existingLine = lines.find(l => Math.abs(l.y - y) < 5);

                if (existingLine) {
                    // Add space if needed
                    existingLine.text += ' ' + item.str;
                } else {
                    lines.push({ y, text: item.str });
                }
            });

            // Sort lines top-to-bottom (higher Y is higher on page in PDF)
            lines.sort((a, b) => b.y - a.y);

            fullTextLines.push(...lines.map(l => l.text.trim()));
        }

        // Debug log as requested
        const fullText = fullTextLines.join('\n');
        console.log("Contenido extraído del PDF (primeros caracteres):", fullText.slice(0, 200));

        // 2. Parse BBVA format (or generic fallback)
        const movements = parseBbvaLines(fullTextLines);

        if (movements.length === 0) {
            console.warn('No movements found. Dumping first 20 lines for debug:', fullTextLines.slice(0, 20));
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
    const dateRegex = /^(\d{1,2}\/\d{1,2}(\/\d{2,4})?)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const upperLine = line.toUpperCase();

        // Start reading logic - relaxed
        if (!isReadingMovements) {
            // If we see a date at the start of the line AND it looks like a movement line (has numbers at end), start reading
            const match = line.match(dateRegex);
            if (match && (upperLine.includes('DETALLE') || upperLine.includes('MOVIMIENTOS') || parseBbvaLine(line))) {
                isReadingMovements = true;
                // Don't continue, process this line too if it's a movement
            } else if (upperLine.includes('DETALLE DE MOVIMIENTOS') || upperLine.includes('MOVIMIENTOS DEL PERIODO')) {
                isReadingMovements = true;
                continue;
            }
        }

        if (isReadingMovements) {
            // Stop conditions
            if (upperLine.includes('TOTAL DE MOVIMIENTOS') ||
                upperLine.includes('SALDO FINAL') ||
                (upperLine.includes('TOTAL') && upperLine.includes('CARGOS'))) {
                // If we have movements, assume we are done.
                if (movements.length > 0) break;
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
        // BBVA Line Format usually:
        // DIA/MES  DIA/MES  DESCRIPCION...  CARGO  ABONO  SALDO
        // Sometimes:
        // DIA/MES  DESCRIPCION... CANTIDAD SALDO

        const parts = line.split(/\s+/);
        if (parts.length < 3) return null;

        // 1. Extract Dates
        const date1 = parts[0];
        // Sometimes the second part is also a date (Posting Date)
        let date2 = date1;
        let descStartIndex = 1;

        if (isValidDate(parts[1])) {
            date2 = parts[1];
            descStartIndex = 2;
        }

        if (!isValidDate(date1)) return null;

        // 2. Parse numbers from the end
        const parseAmount = (str: string) => {
            if (!str) return NaN;
            return parseFloat(str.replace(/,/g, ''));
        };

        let balance = NaN;
        let amount = 0;
        let type: 'ingreso' | 'egreso' = 'egreso'; // default
        let descEndIndex = parts.length - 1;

        // Try to identify the numbers at the end
        const lastVal = parseAmount(parts[parts.length - 1]);
        const secondLastVal = parseAmount(parts[parts.length - 2]);
        const thirdLastVal = parseAmount(parts[parts.length - 3]);

        if (!isNaN(lastVal)) {
            balance = lastVal;
            descEndIndex = parts.length - 1;

            if (!isNaN(secondLastVal)) {
                // We have at least one amount column
                descEndIndex = parts.length - 2;

                if (!isNaN(thirdLastVal)) {
                    // We have two amount columns: Charge, Payment, Balance
                    const cargo = thirdLastVal;
                    const abono = secondLastVal;
                    descEndIndex = parts.length - 3;

                    if (abono !== 0 && !isNaN(abono)) {
                        amount = abono;
                        type = 'ingreso';
                    } else {
                        amount = cargo;
                        type = 'egreso';
                    }
                } else {
                    // Only one amount column before balance.
                    amount = secondLastVal;

                    // Heuristic for type based on description keywords
                    const tempDesc = parts.slice(descStartIndex, descEndIndex).join(' ').toUpperCase();
                    const incomeKeywords = ['ABONO', 'DEPOSITO', 'NOMINA', 'TRASPASO A FAVOR', 'RECEPCION', 'PAGO DE INTERESES', 'VENTA', 'T.A.F'];
                    if (incomeKeywords.some(k => tempDesc.includes(k))) {
                        type = 'ingreso';
                    } else {
                        type = 'egreso';
                    }
                }
            } else {
                // Only balance found? That's weird for a movement line.
                return null;
            }
        } else {
            return null;
        }

        const description = parts.slice(descStartIndex, descEndIndex).join(' ');

        return {
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
    // Matches DD/MM or DD/MM/YYYY or DD/MM/YY
    return /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(str);
}
