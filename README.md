# Music Rip — Personal Mobile-First Music Discovery & Album Export PWA

A mobile-first music discovery and album export application built with React 19, TypeScript, Express, and Tailwind CSS. Features real YouTube Music catalog browsing, a dual-engine architecture (real server export pipeline and an offline simulated state-machine demo), bounded diagnostics, and bilingual English / Persian RTL layout support.

---

## 1. Implemented Code

### 🚀 Server-Side Pipeline & Execution Controls (`src/server/`)
- **Pipeline Manager (`src/server/worker.ts`)**:
  - **Single Active Worker**: Concurrency lock ensuring at most 1 active export worker to prevent CPU/memory exhaustion.
  - **Bounded Queue**: Rejects requests when queue exceeds 5 jobs (HTTP 429).
  - **Bounded Batch Size**: Limits selection to a maximum of 50 tracks per export (`MAX_TRACKS_PER_JOB = 50`).
  - **Bounded Runtime**: Per-track timeout (120 seconds) with process abort controls (`SIGTERM` followed by `SIGKILL`).
  - **Non-Destructive Retry**: Re-evaluates only failed tracks while preserving already completed audio files and local paths.
  - **Artifact TTL & Cleanup**: 1-hour expiration on completed ZIP archives and periodic background sweeping.
- **Diagnostics Categorizer (`src/server/diagnostics.ts`)**:
  - Distinguishes exact failure modes instead of assuming data-center IP blocks:
    - `missing_executable`: Binary not installed or missing at path.
    - `permission_error`: Execution permission denied (EACCES).
    - `timeout`: Subprocess exceeded allocated time limit.
    - `extraction_failure`: Video removed, private, or format unavailable.
    - `source_restriction`: Interactive bot challenges, sign-in gates, age restrictions, or geo-blocks.
    - `conversion_failure`: FFmpeg / libmp3lame transcoding failures.
    - `packaging_failure`: ZIP archiver or file lock errors.
    - `unknown`: Non-zero exit code without established diagnostic category.
  - Captures bounded stderr/stdout (capped at 2KB) preserving original diagnostics in server logs and returning sanitized details to the client.
- **Output Contract & Tagging (`src/server/metadata.ts`, `src/server/packaging.ts`)**:
  - Embeds validated title, artist, album artist, album, genuine release year (without fabricating a fallback year), track number, and disc number.
  - Downloads and embeds release cover art into ID3v2 tags via FFmpeg when available.
  - Multi-disc ZIP organization: Preserves `Disc 1/`, `Disc 2/` directory structure for multi-disc releases; uses root paths for single-disc releases.
  - Post-generation verification: Validates output MP3 files with `ffprobe` JSON stream inspection before marking tracks completed.
- **Input Validation & Security (`server.ts`, `src/server/auth.ts`)**:
  - Validates YouTube video ID format (`/^[a-zA-Z0-9_-]{11}$/`).
  - Rejects empty track selections and unsupported IDs; never silently replaces requested tracks with synthetic tones.
  - `personalAuthMiddleware`: Protects processing and download endpoints for personal use via `MUSICRIP_API_SECRET` or same-origin validation.
- **Observed Capabilities Inspection (`/api/health`)**:
  - Runs bounded version checks for Python, FFmpeg, ffprobe, and yt-dlp.
  - Performs active writability tests on the temporary export directory.
  - Reports observed capabilities without assuming source access from executable existence alone.

### 💻 Client UI & State Mapping (`src/components/views/ExportDetailView.tsx`)
- Accurately distinguishes **Real Audio Pipeline** from **Demo** modes.
- True progress mapping: Displays indeterminate progress when real progress is unavailable, with zero arbitrary progress jumps.
- Accurate stage indicators: Only completed stages appear successful. If retrieval fails for all tracks, tagging and packaging are displayed as skipped rather than pending or completed.
- Detailed per-track diagnostic tags (`Restricted`, `Timed Out`, `Unavailable`, `Invalid ID`) displaying sanitized messages directly under track titles.

---

## 2. Executed Tests & Verification Results

All tests run deterministically via Node's native test runner (`tsx --test test/**/*.test.ts`).

### Test Suite Execution Output
```text
✔ Export Simulator - Excluded tracks remain excluded and process moves to next track (380ms)
✔ Export Simulator - Cancellation disposes intervals and stops stale completion (501ms)
✔ Export Simulator - Retry preserves successful tracks without duplicates and respects exclusions (736ms)
✔ Export Simulator - Zero successful tracks marks job failed with no archive (137ms)
✔ Diagnostics - Classifies missing executable (ENOENT) (3ms)
✔ Diagnostics - Classifies permission denied (EACCES) (0.4ms)
✔ Diagnostics - Classifies process timeout (0.4ms)
✔ Diagnostics - Classifies non-bot extraction error (video unavailable/private) (0.3ms)
✔ Diagnostics - Classifies source restriction (bot verification / sign-in requirement) (0.4ms)
✔ Diagnostics - Classifies geo-restriction (0.2ms)
✔ Diagnostics - Classifies conversion failure (0.4ms)
✔ Diagnostics - Classifies packaging failure (0.2ms)
✔ Diagnostics - Uses unknown category when cause is not established (1ms)
✔ Packaging - Builds ZIP filename without fabricating a fallback year (1.6ms)
✔ Packaging - Preserves multi-disc structure in ZIP paths (57ms)
✔ Pipeline Manager - Cancellation terminates job and marks failed with not_created archive (2ms)
✔ Pipeline Manager - Retry preserves valid successful tracks without re-downloading (203ms)
✔ Server API - Health check reports observed capabilities with bounded checks (1131ms)
✔ Pipeline Verification A - Explicit Synthetic Diagnostic (Local processing & ZIP proof) (447ms)
✔ Pipeline Validation - Unknown or unsupported track IDs fail validation and never fabricate tone (7ms)
✔ Pipeline Validation - Rejects empty track selection (5ms)
✔ Pipeline Verification B - Authorized source integration (Records actual outcome and diagnostic evidence) (2446ms)

Total: 22 passed, 0 failed (7.2s)
```

---

## 3. Verified Integrations

1. **YouTube Music Catalog API (`/api/catalog/*`)**:
   - Artist search with high-resolution avatar extraction.
   - Discography retrieval (`getArtist`, `topAlbums`, `topSingles`, and `searchAlbums`).
   - Full tracklist extraction with duration parsing and video IDs.
2. **Local Audio Synthesis & Encoding (FFmpeg + libmp3lame)**:
   - 192k MP3 audio encoding with ID3v2 tags.
   - Cover art embedding as attached pictures.
3. **Media Verification (ffprobe)**:
   - JSON format and stream verification verifying MP3 audio stream, duration, and metadata tags.
4. **ZIP Archive Packaging (Archiver)**:
   - Creation of valid ZIP archives (PK header verified), preserving multi-disc directory hierarchies.
5. **Synthetic Pipeline Diagnostic (`/api/export/diagnostic-synthetic`)**:
   - End-to-end local generation of labeled test tone MP3s, ffprobe verification, and ZIP packaging.

---

## 4. Unverified Integrations

1. **Unrestricted YouTube Stream Extraction**:
   - YouTube frequently challenges cloud/data-center IPs with interactive bot verification challenges or sign-in gates.
   - Media stream access is determined strictly per track and reported neutrally without assuming all cloud IPs are blocked.
2. **Multi-Node Distributed Queue**:
   - The current worker implementation is bounded to 1 concurrent in-memory worker for personal use on a single server instance. Distributed queue backends (e.g., Redis/BullMQ) are unverified.

---

## 5. Known Blockers & Diagnostic Truth

- **Source Restrictions vs. Server Diagnosis**:
  - An outcome of 0 successful tracks is **an outcome, not a diagnosis**.
  - When YouTube issues a challenge (e.g. `Sign in to confirm you’re not a bot`), the pipeline records `source_restriction` with the exact sanitized reason, rather than asserting that the server IP is blocked.
  - The pipeline never silently substitutes failed or unsupported music tracks with generated test tones. Synthetic tests remain strictly isolated behind the explicit diagnostic endpoint.
