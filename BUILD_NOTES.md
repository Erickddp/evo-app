# Build Configuration & TypeScript Fixes

## Summary of Changes (2025-12-04)

This document summarizes the changes made to fix TypeScript build errors and ensure a clean production build for Vercel.

### 1. TypeScript Configuration
- **Excluded Test Files**: Updated `tsconfig.app.json` to exclude `**/*.test.ts` and `**/*.test.tsx`.
  - *Reason*: Test files often use global variables (like `describe`, `it`, `expect` from Vitest/Jest) that are not present in the main application's type definitions. Excluding them prevents build failures during `npm run build` while still allowing them to be run by the test runner.

### 2. Code Cleanup (Unused Variables)
- Removed or renamed unused variables and imports across several files to satisfy `noUnusedLocals`.
  - `src/core/evoappDataStore.ts`: Removed unused `StoredRecord`.
  - `src/modules/bank-reconciler/BankReconcilerTool.tsx`: Removed unused `BankMovement`.
  - `src/modules/financial-summary/index.tsx`: Removed unused `PeriodFilter`.
  - `src/modules/ingresos-manager/utils.test.ts`: Renamed unused `csv` to `_csv`.
  - `src/modules/tax-tracker/index.tsx`: Removed unused `createEvoTransaction`.
  - `src/routes/ToolsSidebar.tsx`: Removed unused `React` import.

### 3. Syntax Fixes
- **Erasable Syntax**: Refactored `src/core/evoappDataStore.ts` to avoid using parameter properties in the constructor (e.g., `constructor(private x: T)`), which was flagged by the `erasableSyntaxOnly` compiler option.
- **Type-Only Imports**: Updated `src/routes/ToolsSidebar.tsx` to use `import type { Tool }` to comply with `verbatimModuleSyntax`.

### 4. Build Verification
- The project now builds successfully with `npm run build`.
