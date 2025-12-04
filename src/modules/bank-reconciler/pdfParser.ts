import type { BankMovement, PdfStatementSummary, ParsedPdfResult } from "./types";

export async function parsePdfStatement(file: File): Promise<ParsedPdfResult> {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/parse-bank-statement', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Error al procesar el archivo en el servidor.');
        }

        const data = await response.json();

        if (!data.movements || !Array.isArray(data.movements)) {
            throw new Error('Formato de respuesta inválido del servidor.');
        }

        const rawMovements = data.movements;

        // Map backend movements to frontend types
        const movements: BankMovement[] = rawMovements.map((m: any) => ({
            date: m.operationDate,
            description: m.description,
            amount: m.amount,
            type: m.type === 'ingreso' ? 'CREDIT' : 'DEBIT'
        }));

        const summary = calculateSummary(rawMovements, movements);

        return { movements, summary };

    } catch (error: any) {
        console.error('Error parsing PDF via API:', error);
        throw new Error(error.message || 'Error al procesar el archivo.');
    }
}

function calculateSummary(rawMovements: any[], movements: BankMovement[]): PdfStatementSummary {
    if (movements.length === 0) {
        return {
            periodStart: '',
            periodEnd: '',
            accountNumber: 'N/A',
            startingBalance: 0,
            endingBalance: 0,
            totalCredits: 0,
            totalDebits: 0
        };
    }

    // Sort by date
    // Note: rawMovements and movements should be in same order.
    // We use movements for date sorting to be consistent.
    // But we need to keep track of rawMovements for balances.

    // Let's just assume the API returns them in order or we sort them.
    // The API prompt doesn't guarantee order, but usually extracts in order.
    // Let's sort both by date.

    const combined = rawMovements.map((raw, i) => ({ raw, mov: movements[i] }));
    combined.sort((a, b) => a.mov.date.localeCompare(b.mov.date));

    const sortedMovements = combined.map(c => c.mov);
    const sortedRaw = combined.map(c => c.raw);

    const periodStart = sortedMovements[0].date;
    const periodEnd = sortedMovements[sortedMovements.length - 1].date;

    const totalCredits = sortedMovements.filter(m => m.type === 'CREDIT').reduce((sum, m) => sum + m.amount, 0);
    const totalDebits = sortedMovements.filter(m => m.type === 'DEBIT').reduce((sum, m) => sum + m.amount, 0);

    // Try to get balances from raw data
    // endingBalance is the balance of the last movement
    let endingBalance = 0;
    if (sortedRaw.length > 0 && typeof sortedRaw[sortedRaw.length - 1].balance === 'number') {
        endingBalance = sortedRaw[sortedRaw.length - 1].balance;
    }

    // startingBalance: 
    // If first movement is CREDIT (ingreso), starting = balance - amount
    // If first movement is DEBIT (egreso), starting = balance + amount
    let startingBalance = 0;
    if (sortedRaw.length > 0 && typeof sortedRaw[0].balance === 'number') {
        const first = sortedRaw[0];
        if (first.type === 'ingreso') {
            startingBalance = first.balance - first.amount;
        } else {
            startingBalance = first.balance + first.amount;
        }
    }

    return {
        periodStart,
        periodEnd,
        accountNumber: 'BBVA-AI', // Placeholder
        startingBalance,
        endingBalance,
        totalCredits,
        totalDebits
    };
}

