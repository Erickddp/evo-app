import type { BankMovement } from '../types/bank';
import { bankMovementsToCsv } from '../utils/bankCsv';

export async function parseBankStatementPdf(file: File): Promise<{
    movements: BankMovement[];
    csvContent: string;
}> {
    try {
        // 1. Read file
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: file.type });

        // 2. Prepare FormData
        const formData = new FormData();
        formData.append('file', blob, file.name);

        // 3. POST to backend
        const response = await fetch('/api/parse-bank-statement', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error('Error en el servidor al procesar el PDF.');
        }

        const data = await response.json();

        if (!data.movements || !Array.isArray(data.movements)) {
            throw new Error('Formato de respuesta inválido del servidor.');
        }

        const movements: BankMovement[] = data.movements;

        if (movements.length === 0) {
            throw new Error('No se detectaron movimientos en el PDF. Verifica que corresponda a un estado de cuenta bancario.');
        }

        // 4. Validate and normalize (basic validation, server should have done most)
        // We can ensure dates are strings, amounts are numbers, etc.
        const validMovements = movements.filter(m =>
            m.operationDate &&
            m.liquidationDate &&
            typeof m.amount === 'number' &&
            (m.direction === 'cargo' || m.direction === 'abono')
        );

        if (validMovements.length === 0) {
            throw new Error('No se encontraron movimientos válidos después del procesamiento.');
        }

        // 5. Build CSV
        const csvContent = bankMovementsToCsv(validMovements);

        return { movements: validMovements, csvContent };

    } catch (error: any) {
        console.error('Error parsing PDF:', error);
        // Return user-friendly message
        if (error.message.includes('No se detectaron') || error.message.includes('No se encontraron')) {
            throw error;
        }
        throw new Error('No fue posible leer el PDF del estado de cuenta. Intenta nuevamente o genera el CSV de forma manual.');
    }
}
