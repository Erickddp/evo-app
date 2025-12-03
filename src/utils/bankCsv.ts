import type { BankMovement } from '../types/bank';

export function bankMovementsToCsv(movements: BankMovement[]): string {
    const header = 'operationDate,liquidationDate,description,amount,direction,balanceAfter';
    const rows = movements.map(m => [
        m.operationDate,
        m.liquidationDate,
        escapeCsv(m.description),
        m.amount.toFixed(2),
        m.direction,
        m.balanceAfter != null ? m.balanceAfter.toFixed(2) : ''
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
