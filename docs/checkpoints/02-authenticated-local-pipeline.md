# Checkpoint 2: Authenticated Local Pipeline & Synthetic Export

## 1. Environment & Source State

- **Node.js**: `v22.23.3`
- **npm**: `10.9.9`
- **Working Branch**: `test/authenticated-pipeline`
- **Tracking Branch**: `origin/main`
- **Baseline Commit**: `6dc9d5a7bce93e88f9197c3ed5e2ed1e49c051f0` (`refactor: improve null safety and repository code`)
- **Repository**: `KnightMare97/mrip`
- **System Tools Verified**:
  - `/usr/bin/ffmpeg` (v4.4.2)
  - `/usr/bin/ffprobe` (v4.4.2)
  - `/usr/bin/unzip` (v6.00)
  - `/usr/bin/zipinfo` (v3.00)

---

## 2. Changes Made & Rationale

1. **`server.ts`**:
   - Supported `MUSICRIP_EXPORT_DIR` environment variable with fallback to `/tmp/musicrip_exports`, allowing integration tests to direct exports into isolated, unique temporary directories.
   - Allowed fast test server startup by skipping Vite dev middlewares when `NODE_ENV === 'test'`.
   - Bound Express to dynamic ephemeral ports when specified (`PORT=0` or any available port), logging the actual assigned port.
   - Added graceful `SIGTERM` and `SIGINT` listeners to cleanly shut down the server and dispose pipeline interval timers.

2. **`test/authenticated-pipeline.test.ts`** (New Integration Test Harness):
   - Implemented an isolated test runner that boots its own server on an ephemeral port.
   - Generated a random 32-byte secret per test run without logging, printing, or persisting credentials.
   - Cleaned up child processes and temporary working directories in `finally` blocks without terminating the AI Studio preview server.
   - Tested HTTP authentication enforcement: missing credentials (401), invalid Bearer (401), invalid Basic (401), valid Bearer (authorized), valid Basic (authorized), and `x-musicrip-token` (authorized).
   - Tested server fail-closed state: unconfigured `MUSICRIP_API_SECRET` yields HTTP 503.
   - Dispatched a 2-track synthetic diagnostic export, polled to completion, and verified 2 successful tracks, zero failed tracks, and artifact availability.
   - Verified authenticated ZIP download, archive binary integrity (`unzip -t`), entry list (`zipinfo -1`), safe path traversal constraints, track ordering, and filename format.
   - Extracted and verified each MP3 file using real `/usr/bin/ffprobe` for positive audio duration, MP3 stream codec, and ID3v2 tags.
   - Verified local artwork generation (FFmpeg lavfi without internet), Persian title and artist metadata (`نوای شبانه`, `کیهان کلهر`), non-first disc (`disc: 2`), non-first track (`track: 3/8`), and embedded artwork stream disposition (`attached_pic == 1`).

3. **`test/server-export.test.ts`**:
   - Conditioned network-dependent YouTube retrieval tests behind `RUN_LIVE_SERVER_TESTS=1` so offline local checkpoints run cleanly without attempting external network requests.

4. **`docs/checkpoints/01-build-and-unit-tests.md`**:
   - Clarified that unit tests in `test/backup-validation.test.ts` verified only schema validation, record deduplication, and memory sanitization; real browser IndexedDB transaction durability and storage behaviors remain unverified.

---

## 3. Execution Commands & Results

All verification commands executed cleanly on `test/authenticated-pipeline`:

| Command | Exit Code | Observed Output / Result |
|---|---|---|
| `npm run lint` | 0 | `tsc --noEmit` passed with 0 errors |
| `npm run build` | 0 | `vite build` completed in 898ms (`dist/index.html`, `dist/assets/*`) |
| `npx tsx --test test/auth.test.ts test/worker-reliability.test.ts test/backup-validation.test.ts` | 0 | 9 targeted unit tests passed (1.29s) |
| `npx tsx --test test/authenticated-pipeline.test.ts` | 0 | 12 integration assertions passed (5.65s) |
| `npm test` | 0 | 38 passed, 0 failed, 1 skipped (live YouTube network test) in 8.68s |

---

## 4. Archive & Media Probe Verification Evidence

### ZIP Archive Inspection (`/usr/bin/zipinfo -1`)
```text
01 - Audio Diagnostic Verifier - Synthetic Test Release #1.mp3
02 - Audio Diagnostic Verifier - Synthetic Test Release #2.mp3
```
- Total entries: exactly 2.
- Path safety: All paths relative, no leading slashes, no `..` traversal segments.
- Archive integrity (`/usr/bin/unzip -t`): `No errors detected in compressed data of downloaded.zip`.

### Extracted MP3 Stream & Tag Probe (`/usr/bin/ffprobe`)
- **Track 1**:
  - Audio Stream: `codec_name: mp3`, sample rate `44100 Hz`, stereo.
  - Duration: `2.040000 s` (positive, finite).
  - ID3v2 Tags: `title: Synthetic Test Release #1`, `artist: Audio Diagnostic Verifier`, `album: Synthetic Pipeline Diagnostic`, `track: 1`.
- **Track 2**:
  - Audio Stream: `codec_name: mp3`, sample rate `44100 Hz`, stereo.
  - Duration: `2.040000 s` (positive, finite).
  - ID3v2 Tags: `title: Synthetic Test Release #2`, `artist: Audio Diagnostic Verifier`, `album: Synthetic Pipeline Diagnostic`, `track: 2`.

### Artwork & Persian Metadata Probe (`/usr/bin/ffprobe`)
- **Video Stream (Attached Picture)**:
  - `codec_name: mjpeg`
  - `disposition.attached_pic: 1`
  - `tags.title: Album cover`
- **Audio Stream**:
  - `codec_name: mp3`
  - `duration: 2.040000 s`
- **ID3v2 Tags**:
  - `title: نوای شبانه (Night Melody)`
  - `artist: کیهان کلهر (Kayhan Kalhor)`
  - `album: سفر به دیار ناشناخته (Journey Beyond)`
  - `album_artist: کیهان کلهر`
  - `track: 3/8`
  - `disc: 2`
  - `date: 2024`

---

## 5. Verified Capabilities & Confirmed Boundaries

### Verified Capabilities
1. HTTP authentication on personal export endpoints fails closed: 401 when unauthenticated or bad token, 503 when secret is unconfigured.
2. HTTP authentication supports Bearer tokens, Basic authorization, and `x-musicrip-token`.
3. Server export pipeline correctly isolates and processes multi-track synthetic diagnostic jobs without mock fallbacks.
4. Real FFmpeg lavfi audio synthesis produces valid MP3 files with accurate durations.
5. Real packaging produces structured, valid ZIP archives with safe relative paths.
6. Real FFmpeg transcoding embeds local artwork (`attached_pic`) and ID3v2 tags containing UTF-8 Persian script and non-first disc/track numbers.
7. Full unit and integration test suite runs deterministically offline without network calls.

### Confirmed Boundaries & Remaining Blockers
1. **No YouTube Access Claimed**: Successful local synthetic audio synthesis and ZIP packaging does **not** prove or verify YouTube stream extraction. YouTube audio download remains unverified and subject to YouTube bot verification/network restrictions.
2. **Browser IndexedDB Unverified**: Real browser IndexedDB transaction commit, rollbacks, and storage quotas are not verified by Node-based tests.
3. **No Automatic Push or Deployment**: Changes remain on local branch `test/authenticated-pipeline` awaiting user review.
