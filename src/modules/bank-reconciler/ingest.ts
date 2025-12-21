import { evoStore } from '../../core/evoappDataStore';
import { normalizeToRegistroFinanciero } from '../core/normalize/normalizeToRegistroFinanciero';
import type { BankMovement } from './types';
import type { RegistroFinanciero } from '../../core/evoappDataModel'; // Ensure types match

export const ingestBankMovements = async (movements: BankMovement[]) => {
    // 1. Get existing records to check duplicates
    // Optimization: In a real app we might filters by date range but here we load all for safety
    const existingRecords = await evoStore.registrosFinancieros.getAll();
    const existingMap = new Map<string, string>();
    for (const rec of existingRecords) {
        if (rec.source === 'bank' && rec.links?.bankMovementId) {
            existingMap.set(rec.links.bankMovementId, rec.id);
        }
    }

    let newCount = 0;
    let updatedCount = 0;
    const batchToSave: RegistroFinanciero[] = [];

    // 2. Process
    for (const move of movements) {
        // Generate a stable ID for deduplication
        // Format: YYYY-MM-DD|AMOUNT|TYPE|DESC
        const uniqueStr = `${move.date}|${move.amount.toFixed(2)}|${move.type}|${move.description.trim()}`;
        let hash = 0;
        for (let i = 0; i < uniqueStr.length; i++) {
            const chr = uniqueStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        const bankMovementId = `hash_${Math.abs(hash).toString(16)}`;

        const input = { ...move, bankMovementId };
        const cfr = normalizeToRegistroFinanciero(input);

        if (existingMap.has(bankMovementId)) {
            // Update
            const existingId = existingMap.get(bankMovementId)!;
            const updatedCfr: RegistroFinanciero = {
                ...cfr,
                id: existingId,
                updatedAt: new Date().toISOString()
            };
            batchToSave.push(updatedCfr);
            updatedCount++;
        } else {
            // Insert
            batchToSave.push(cfr);
            newCount++;
        }
    }

    // 3. Save
    if (batchToSave.length > 0) {
        await evoStore.registrosFinancieros.putMany(batchToSave);
    }

    // 4. Emit
    // evoEvents.emit('data:changed'); // Redundant: putMany handles it

    return { new: newCount, updated: updatedCount };
};
