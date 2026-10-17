# Export reliability patch: scope and verification

This branch is not production-ready. The code and regression tests in this patch have not been executed by the assistant. No successful YouTube retrieval or no-card deployment has been verified.

Changes: a single bounded worker queue; cancellation checked after each async stage; retry blocked until the previous attempt settles; counts recomputed from track states; stale artifact fields invalidated before retry; successful local tracks reused; expired or failed ZIPs rebuildable; cleanup skips running/queued work and includes failed terminal jobs. ZIP publication uses a staging file and rename. Cancellation during ZIP creation prevents publication but waits for the archiver operation to settle before releasing the worker slot; immediate archiver abort is not implemented.

Media commands use a shared bounded-output runner with timeout, abort, and POSIX process-group termination. Source audio is converted to MP3 only in the final tagging stage. Expected title, artist, album artist, album, original track/disc numbers, year, and artwork are compared against ffprobe output. Track totals are omitted because the current API does not supply trustworthy original per-disc totals; selected track counts are not used as album totals.

Cover fetching is limited to HTTPS Google/YouTube image hosts, disallows redirects, limits bytes and time, and accepts only JPEG/PNG/WebP content types. Missing artwork remains optional; the UI still needs an explicit warning when cover retrieval fails. Progress is track-outcome based, not a measured byte-transfer percentage.

Run after installing the project dependencies:

- npx tsx --test test/auth.test.ts test/worker-reliability.test.ts
- npm run lint
- npm run build

Worker tests inject fake media/ZIP operations; they test lifecycle behavior, not valid audio or valid archive content. The command-runner test uses Node itself. Existing server integration tests still require a running server and authentication headers; the previous tests do not automatically configure either. Real FFmpeg/ffprobe and authorized source integration must be verified separately.

Not addressed here: complete paginated discographies, source-verified release metadata and disc numbers, client polling recovery, IndexedDB transaction/restore durability, orphan cleanup after server restart, global storage quotas, browser login UI, live hosting validation, and Telegram. In-memory job metadata still disappears on server restart. Do not merge automatically.
