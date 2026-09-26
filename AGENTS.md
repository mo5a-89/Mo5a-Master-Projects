# AI Studio Coding Agent - Automated System Safeguards & Governance Protocol

## 1. Automated Snapshot & Rollback Protocol
- **Pre-Execution Checkpoint Requirement**: Before performing high-impact operations, batch migrations, or state-altering mutations, create a state checkpoint via `createCheckpoint(reason, currentState)` from `src/utils/snapshotManager.ts`.
- **Zero Data Loss Guarantee**: If an unhandled exception or build issue occurs, instant recovery and rollback to the last verified snapshot is triggered automatically.
- **Continuous Backup Integrity**: The system maintains local and centralized PITR snapshot backups for disaster recovery.

## 2. Automated Build Cache Purge Protocol
- **Clean Compilation Buffers**: All production builds (`npm run build`) automatically trigger `node ./scripts/prebuild-clean.js` prior to executing `vite build` and `esbuild`.
- **Target Directories**: `dist/`, `node_modules/.vite/`, `.vite/`, and `.cache/` are flushed before every build cycle to eliminate stale chunks and corrupted assets.

## 3. Core Component Read-Only Protection
- **Quotation Arithmetic & Financial Calculations**: The mathematical rules in `src/utils/quotationUtils.ts`, `src/utils/financialCalculations.ts`, and `src/utils/financialUtils.ts` (15% KSA VAT, retention calculations, subtotal aggregation) are **immutable core invariants**.
- **Official Letterhead & Identity**: Letterhead formatting and branding for "مؤسسة صناع الموارد التجارية" in `src/components/OfficialLetterhead.tsx` are protected from arbitrary design drift.
- **Isolated Modular Extension**: All new features, integrations, or UI expansions must be introduced into isolated components or utility modules without modifying established core logic.

## 4. Concurrency & Execution Locking
- Heavy background triggers (Word Export, Print/PDF, AI OCR Extraction, Bulk Synchronization) must be guarded using `useExecutionLock` or `withExecutionLock` to prevent double-clicks and race conditions.
