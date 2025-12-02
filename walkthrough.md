# Data Persistence Unification Walkthrough

I have audited and unified the data persistence mechanism for all EVORIX Core modules.
All tools now use the central `dataStore` to save their state, ensuring they are included in the CSV export/restore flow.

## Changes Overview

### 1. Data Map (`docs/data-map.md`)
Created a comprehensive documentation of the data schema for each tool.

### 2. Ingresos Manager
- **Refactored** to use `dataStore` instead of `localStorage`.
- **Strategy**: Snapshot. Saves the entire list of movements as a new record on every change.
- **Benefit**: Fully compatible with CSV export/restore.

### 3. Bank Reconciler
- **Refactored** to interact with `ingresos-manager` data via `dataStore`.
- **Flow**: Reads the latest `ingresos-manager` snapshot, appends new movements from CSV, and saves a new snapshot.
- **Benefit**: Seamless integration with Ingresos Manager without direct coupling or local storage hacks.

### 4. Tax Tracker
- **Refactored** to read income data from `dataStore` (Ingresos Manager snapshots) for tax projections.
- **Benefit**: Decoupled from `localStorage` and ensures projections work after a CSV restore.

### 5. CFDI Validator
- **Refactored** to persist validation results (rows and errors) to `dataStore`.
- **Strategy**: Snapshot. Saves the results of the last processing session.
- **Benefit**: Users can restore their last validation session from a CSV backup.

## Verification Steps

To verify the changes, perform the following end-to-end test:

1.  **Ingresos Manager**: Add a few movements (Income/Expense).
2.  **Bank Reconciler**: Upload a CSV file and map columns. Save.
    *   Verify that the new movements appear in **Ingresos Manager**.
3.  **Tax Tracker**: Check the "Tax Projections" card.
    *   Verify it reflects the income from Ingresos Manager.
    *   Register a tax payment.
4.  **CFDI Validator**: Upload and process some XML files.
5.  **Settings / Data Management**:
    *   Click **"Copy CSV preview to clipboard"**.
    *   Paste it into a text file to verify it contains records for all tools (`ingresos-manager`, `tax-tracker`, `cfdi-validator`).
    *   Click **"Clear Local Data"** (Danger Zone).
    *   Verify all tools are empty.
    *   Click **"Restore data from CSV"** and select the saved CSV.
    *   Verify all data is restored in all tools.

## Technical Details

- **Tool IDs**:
    - `ingresos-manager`
    - `cfdi-validator`
    - `tax-tracker`
    - `bank-reconciler` (for history/config)
- **DataStore**: `src/core/data/dataStore.ts` (unchanged, but now fully utilized).
