import type { BankMovement } from './types';

export function downloadMovementsAsCsv(movements: BankMovement[], filename: string) {
    const header = 'date,description,amount,type';
    const rows = movements.map(m => [
        m.date,
        `"${m.description.replace(/"/g, '""')}"`,
        m.amount.toFixed(2),
        m.type
    ].join(','));

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function buildBackupCsvFilename(periodStart: string): string {
    // periodStart is YYYY-MM-DD
    // Wanted: BBVA_YYYY-MM_movimientos.csv
    const ym = periodStart.slice(0, 7); // YYYY-MM
    return `BBVA_${ym}_movimientos.csv`;
}
