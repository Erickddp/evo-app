import pdf from 'pdf-parse';
import OpenAI from 'openai';

// Helper to validate movement
function isValidMovement(m) {
    return (
        m &&
        typeof m.operationDate === 'string' &&
        typeof m.postingDate === 'string' &&
        typeof m.description === 'string' &&
        typeof m.amount === 'number' &&
        (m.type === 'ingreso' || m.type === 'egreso')
    );
}

export async function parseBankStatementCore(pdfBuffer, openaiApiKey) {
    // 1. Extract text from PDF
    const pdfData = await pdf(pdfBuffer);
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
        throw new Error('Could not extract text from PDF.');
    }

    // 2. Call OpenAI
    const openai = new OpenAI({
        apiKey: openaiApiKey,
    });

    const systemMessage = `You are a strict data extraction engine for Mexican bank account statements (BBVA 'Estado de Cuenta' in Spanish).
You receive the full text of a BBVA bank statement.
1. Locate the section 'Detalle de Movimientos Realizados'.
2. Extract every movement row. Each movement line has:
   - Fecha de operación (e.g. 01/NOV)
   - Fecha de liquidación (e.g. 03/NOV)
   - Descripción (text)
   - One main amount (in the CARGOS or ABONOS column)
   - Optionally two amounts that correspond to balances.
3. For each row:
   - Convert dates to ISO \`YYYY-MM-DD\` using the period year from the statement (e.g. 2025).
   - Extract:
     - operationDate
     - postingDate (previously liquidationDate)
     - description
     - amount (as a number, without thousand separators)
     - type: 'egreso' if the amount is in the CARGOS column, 'ingreso' if in the ABONOS column.
     - balance: the balance after the movement if present, otherwise null.
Return ONLY valid JSON with this shape:
{
  "movements": [
    {
      "operationDate": "2025-11-01",
      "postingDate": "2025-11-03",
      "description": "PAGO CUENTA DE TERCERO",
      "amount": 6000.00,
      "type": "egreso",
      "balance": 197872.28
    }
  ]
}
Do NOT include any explanation, comments, or extra keys.`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
        throw new Error('Empty response from OpenAI');
    }

    const result = JSON.parse(content);

    if (!result.movements || !Array.isArray(result.movements)) {
        throw new Error('Invalid JSON structure from OpenAI');
    }

    // 3. Validate movements
    const validMovements = result.movements.filter(isValidMovement);

    return { movements: validMovements };
}
