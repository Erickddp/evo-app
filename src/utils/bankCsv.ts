import type { BankMovement } from '../types/bank';

export function bankMovementsToCsv(movements: BankMovement[]): string {
    const header = 'operationDate,postingDate,description,amount,type,balance';
    const rows = movements.map(m => [
        m.operationDate,
        m.postingDate,
        escapeCsv(m.description),
        m.amount.toFixed(2),
        m.type,
        m.balance != null ? m.balance.toFixed(2) : ''
    ].join(','));
    return [header, ...rows].join('\n');
}

function escapeCsv(text: string): string {
    if (!text) return '';
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}
