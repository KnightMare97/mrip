# Checkpoint 1: Build & Unit Test Baseline

## 1. Environment

- **Node.js**: `v22.23.3`
- **npm**: `10.9.9`
- **Source Baseline Commit**: `86fd5dbbab6308371453785987ff1941e60ad9f0`
- **Branch**: `fix/export-reliability`
- **Repository**: `KnightMare97/mrip`

---

## 2. Dependency Conflict & Resolution

### Root Cause
`package.json` previously declared a direct devDependency:
```json
"esbuild": "^0.25.0"
```
which resolved to `esbuild@0.25.12`. However, `vite@8.3.4` declared an optional peer dependency of:
```text
esbuild@"^0.27.0 || ^0.28.0"
```
During standard `npm ci`, npm halted with an `ERESOLVE` peer dependency conflict:
```text
npm error ERESOLVE could not resolve
npm error Conflicting peer dependency: esbuild@0.28.2
npm error peerOptional esbuild@"^0.27.0 || ^0.28.0" from vite@8.3.4
```

### Resolution
An inspection of the repository confirmed that `esbuild` is not directly imported or referenced by project source files or scripts; build and test execution are handled by `vite` and `tsx` (which manage their own compatible `esbuild` dependencies).

1. Removed `"esbuild": "^0.25.0"` from `devDependencies` in `package.json`.
2. Regenerated lockfile via `npm install --package-lock-only`.
3. Standard `npm ci` now completes cleanly without `--legacy-peer-deps` or `--force`.

---

## 3. Source Changes & Rationale

1. **`package.json` & `package-lock.json`**:
   - Removed direct `esbuild` devDependency to eliminate peer conflict with Vite.
2. **`src/App.tsx`**:
   - Added missing `activeJobId` destructuring from `useExport()` on line 23:
     ```tsx
     const { activeJobId, setActiveJobId } = useExport();
     ```
   - Resolves TypeScript error TS2552 (`Cannot find name 'activeJobId'`).
3. **`src/server/worker.ts`**:
   - Introduced typed helper function:
     ```typescript
     function isSuccessfulOutcome(job: ServerExportJob): boolean {
       return job.processingStatus === 'completed' || job.processingStatus === 'partial';
     }
     ```
   - Replaced type-widening (`job.processingStatus as string`) on line 73 with `isSuccessfulOutcome(job)`:
     ```typescript
     if (isSuccessfulOutcome(job)) job.overallProgress = 100;
     ```
   - Resolves TypeScript error TS2367 (unintentional narrowing across asynchronous calls) while preserving full static typing.

---

## 4. Verification Commands & Results

All commands executed cleanly on `fix/export-reliability`:

| Command | Exit Code | Result Summary |
|---|---|---|
| `npm ci` | 0 | `added 264 packages, and audited 265 packages in 12s, found 0 vulnerabilities` |
| `npm run lint` | 0 | `tsc --noEmit` completed with 0 errors |
| `npm run build` | 0 | `vite build` completed in 951ms (`dist/index.html`, `dist/assets/*`) |
| `npx tsx --test test/auth.test.ts test/worker-reliability.test.ts test/backup-validation.test.ts` | 0 | 9 tests passed, 0 failed (1.34s) |

---

## 5. Explicitly Unverified Areas

The following domains are deliberately out of scope for Checkpoint 1 and remain unverified:
1. **Browser IndexedDB live runtime**: Unit tests in `test/backup-validation.test.ts` verified only schema validation, payload deduplication, and in-memory record sanitization; real browser IndexedDB database engine transactions, persistence durability, storage quota limits, and cross-tab concurrency remain completely unverified.
2. **Authenticated server integration**: Requires a dedicated running server instance with configured `MUSICRIP_API_SECRET` and client session headers.
3. **Actual YouTube stream retrieval**: Tests verify command runners and error handling via deterministic mocks; actual network downloads against YouTube's live endpoints remain unverified.
4. **Album ZIP archive file structure & integrity**: Verification of generated binary ZIP files under full multi-track export loads.
5. **Production deployment & cloud infrastructure**.
