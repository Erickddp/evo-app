import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { BankMovement, PdfStatementSummary, ParsedPdfResult } from "./types";

// Configurar worker para Vite
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function parsePdfStatement(file: File): Promise<ParsedPdfResult> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.449/cmaps/',
        cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    const fullTextLines: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items as TextItem[];

        // Agrupar por líneas (tolerancia Y)
        const lines: { y: number; text: string }[] = [];
        items.forEach((item) => {
            const y = Math.round(item.transform[5]);
            const existingLine = lines.find(l => Math.abs(l.y - y) < 3);
            if (existingLine) {
                existingLine.text += ' ' + item.str;
            } else {
                lines.push({ y, text: item.str });
            }
        });

        lines.sort((a, b) => b.y - a.y);
        fullTextLines.push(...lines.map(l => l.text.trim()));
    }

    const summary = extractSummary(fullTextLines);
    const movements = extractMovements(fullTextLines, summary.periodStart);

    return { movements, summary };
}

function extractSummary(lines: string[]): PdfStatementSummary {
    const summary: PdfStatementSummary = {
        periodStart: '',
        periodEnd: '',
        accountNumber: '',
        startingBalance: 0,
        endingBalance: 0,
        totalCredits: 0,
        totalDebits: 0
    };

    const periodRegex = /Periodo.*(\d{2}\/\d{2}\/\d{4}).*al.*(\d{2}\/\d{2}\/\d{4})/i;
    const accountRegex = /(?:No\.?\s*de\s*Cuenta|Cuenta)[:\s]+(\d+)/i;

    for (const line of lines) {
        if (!summary.periodStart) {
            const pMatch = line.match(periodRegex);
            if (pMatch) {
                summary.periodStart = parseDateToIso(pMatch[1]);
                summary.periodEnd = parseDateToIso(pMatch[2]);
            }
        }
        if (!summary.accountNumber) {
            const aMatch = line.match(accountRegex);
            if (aMatch) summary.accountNumber = aMatch[1];
        }

        // Heurística simple para saldos
        if (line.includes("Saldo Anterior") || line.includes("Saldo Inicial")) {
            const m = extractFirstAmount(line);
            if (m !== null) summary.startingBalance = m;
        }
        if (line.includes("Saldo Final")) {
            const m = extractFirstAmount(line);
            if (m !== null) summary.endingBalance = m;
        }
        if (line.includes("Total") && (line.includes("Abonos") || line.includes("Depósitos"))) {
            const m = extractFirstAmount(line);
            if (m !== null) summary.totalCredits = m;
        }
        if (line.includes("Total") && (line.includes("Cargos") || line.includes("Retiros"))) {
            const m = extractFirstAmount(line);
            if (m !== null) summary.totalDebits = m;
        }
    }
    return summary;
}

function extractMovements(lines: string[], periodStartIso: string): BankMovement[] {
    const movements: BankMovement[] = [];
    let currentYear = new Date().getFullYear();
    if (periodStartIso) {
        currentYear = parseInt(periodStartIso.split('-')[0]);
    }

    const dateStartRegex = /^(\d{2})\/(\d{2})\s+/;
    let isReading = false;

    for (const line of lines) {
        if (line.toUpperCase().includes("DETALLE DE MOVIMIENTOS") || line.toUpperCase().includes("MOVIMIENTOS DEL PERIODO")) {
            isReading = true;
            continue;
        }
        if (isReading) {
            if (line.toUpperCase().includes("TOTAL DE MOVIMIENTOS") || line.toUpperCase().includes("SALDO FINAL")) {
                break;
            }
            const match = line.match(dateStartRegex);
            if (match) {
                const day = match[1];
                const month = match[2];
                const mov = parseMovementLine(line, currentYear, day, month);
                if (mov) movements.push(mov);
            }
        }
    }
    return movements;
}

function parseMovementLine(line: string, year: number, day: string, month: string): BankMovement | null {
    try {
        const parts = line.trim().split(/\s{2,}/);
        const tokens = parts.length < 3 ? line.trim().split(/\s+/) : parts;
        const cleanTokens = tokens.filter(t => t.trim() !== '');

        if (cleanTokens.length < 3) return null;

        const lastToken = cleanTokens[cleanTokens.length - 1];
        const secondLast = cleanTokens[cleanTokens.length - 2];
        const thirdLast = cleanTokens[cleanTokens.length - 3];

        const parseNum = (s: string) => {
            if (!s) return NaN;
            return parseFloat(s.replace(/,/g, ''));
        };

        const valLast = parseNum(lastToken);     // Saldo
        const val2ndLast = parseNum(secondLast); // Abono o Cargo
        const val3rdLast = parseNum(thirdLast);  // Cargo

        let amount = 0;
        let type: "DEBIT" | "CREDIT" = "DEBIT";
        let descEndIndex = cleanTokens.length - 1;

        // Caso 3 columnas: Cargo Abono Saldo
        if (!isNaN(valLast) && !isNaN(val2ndLast) && !isNaN(val3rdLast)) {
            if (val3rdLast > 0) {
                amount = val3rdLast;
                type = "DEBIT";
            } else if (val2ndLast > 0) {
                amount = val2ndLast;
                type = "CREDIT";
            }
            descEndIndex = cleanTokens.length - 3;
        }
        // Caso 2 columnas: Monto Saldo
        else if (!isNaN(valLast) && !isNaN(val2ndLast)) {
            amount = val2ndLast;
            type = "DEBIT"; // Default
            // Heurística básica para detectar abonos
            const descText = cleanTokens.slice(1, cleanTokens.length - 2).join(' ').toUpperCase();
            if (["ABONO", "DEPOSITO", "NOMINA", "TRASPASO A FAVOR", "INTERESES"].some(k => descText.includes(k))) {
                type = "CREDIT";
            }
            descEndIndex = cleanTokens.length - 2;
        } else {
            return null;
        }

        const description = cleanTokens.slice(1, descEndIndex).join(' ');
        const dateStr = `${year}-${month}-${day}`;

        return {
            date: dateStr,
            description: description,
            amount: Math.abs(amount),
            type: type
        };
    } catch (e) {
        return null;
    }
}

function parseDateToIso(dateStr: string): string {
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
}

function extractFirstAmount(text: string): number | null {
    const match = text.match(/[\d,]+\.\d{2}/);
    if (match) return parseFloat(match[0].replace(/,/g, ''));
    return null;
}
