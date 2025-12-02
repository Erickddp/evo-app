# EVORIX Core Data Map

This document describes how each tool in EVORIX Core persists its data to the central `dataStore`.
All data is stored as immutable records in the `dataStore` (backed by `localStorage` and exportable to CSV).

## General Schema

All records in `dataStore` follow this interface:

```typescript
interface StoredRecord<T = unknown> {
    id: string;        // UUID
    toolId: string;    // Identifier for the tool
    createdAt: string; // ISO Date
    updatedAt: string; // ISO Date
    payload: T;        // Tool-specific data
}
```

## Tool Schemas

### 1. Ingresos Manager (`ingresos-manager`)

**Strategy:** Snapshot
The entire list of movements is saved as a new record whenever it changes. The latest record represents the current state.

**Payload Shape:**
```typescript
{
    movements: Array<{
        id: string;
        date: string;      // "YYYY-MM-DD"
        concept: string;
        amount: number;    // Positive = Income, Negative = Expense
    }>;
    stats: {
        totalIncome: number;
        totalExpense: number;
        netBalance: number;
    };
    updatedAt: string;
}
```

### 2. CFDI Validator (`cfdi-validator`)

**Strategy:** Snapshot (Last Session)
The results of the last validation session are saved. Restoring from CSV will restore the last viewed results.

**Payload Shape:**
```typescript
{
    filesCount: number;
    rows: Array<{
        fileName: string;
        uuid: string;
        serie: string;
        folio: string;
        fecha: string;
        emisorRfc: string;
        emisorNombre: string;
        receptorRfc: string;
        receptorNombre: string;
        usoCfdi: string;
        moneda: string;
        subtotal: number;
        total: number;
        tipoComprobante: string;
        formaPago: string;
        metodoPago: string;
    }>;
    errors: Array<{
        fileName: string;
        message: string;
    }>;
    timestamp: string;
}
```

### 3. Tax Tracker (`tax-tracker`)

**Strategy:** Append-only Log
Each tax payment is saved as an individual record. The application loads all records with `toolId='tax-tracker'`.

**Payload Shape:**
```typescript
{
    id: string;
    date: string;
    concept: string;
    amount: number;
    type: 'IVA' | 'ISR' | 'Other';
    status: 'Paid' | 'Pending';
    metadata: Record<string, any>;
}
```

### 4. Bank Reconciler (`bank-reconciler`)

**Strategy:** Modifier / Action Log
This tool primarily modifies the `ingresos-manager` state. When saving, it reads the latest `ingresos-manager` snapshot, appends new movements, and saves a new `ingresos-manager` snapshot.
It may also save its own configuration or history (optional).

**Payload Shape (for `toolId='bank-reconciler'` - Optional History):**
```typescript
{
    action: 'import';
    fileName: string;
    movementsAdded: number;
    timestamp: string;
}
```

## Data Flow

1.  **Tools** generate data (user input, file parsing).
2.  **Tools** save data to `dataStore` using `saveRecord(toolId, payload)`.
    *   For "Snapshot" tools (`ingresos-manager`, `cfdi-validator`), this means saving the full current state.
    *   For "Log" tools (`tax-tracker`), this means saving a new item.
3.  **CSV Export** iterates all records in `dataStore` and dumps them to a file.
4.  **CSV Restore** clears `dataStore` and repopulates it from the file.
5.  **Tools** re-initialize by reading from `dataStore`.
    *   "Snapshot" tools find the *latest* record for their ID.
    *   "Log" tools load *all* records for their ID.
