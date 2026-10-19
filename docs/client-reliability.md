# Client reliability patch

Not executed: TypeScript typecheck, frontend build, or the authored TypeScript regression tests. The available assistant runtime contains Node 20 and FFmpeg/ffprobe, but no TypeScript/tsx/project dependencies and no usable offline package cache. No internet package installation was attempted.

A separate direct FFmpeg argument-level smoke test succeeded: synthetic WAV to 192 kbps MP3, Persian title, artist, album artist, album, track 7, disc 2, year 2023, and attached JPEG artwork were confirmed with ffprobe. This did not execute the TypeScript metadata module, the worker, or YouTube extraction.

Storage now resolves writes only after transaction completion. Backup records are validated and stripped to allowed fields before writes; restore uses one transaction across all stores, so failed transactions cannot be reported as partial success. Reads propagate errors rather than inventing empty libraries. The existing React provider still needs a comprehensive reactive error-banner/retry UX. Export job history is not included in the IndexedDB backup schema.

Live job polling now uses sequential requests, bounded backoff, stale-response guards, server-confirmed cancellation, runtime state mapping, and a separate history key. Restored files are unverified until refreshed from the server. Only the most recent 20 records are automatically refreshed on subscription. Older job screens require a direct subscription to refresh. Full resumable server persistence is not implemented. Browser-native Basic authentication from the preceding patch still requires manual verification and server configuration; no custom login UI was added here.

Run with installed dependencies:
- npx tsx --test test/auth.test.ts test/worker-reliability.test.ts test/backup-validation.test.ts
- npm run lint
- npm run build

The backup tests validate input normalization only. Real IndexedDB transaction rollback, blocked upgrades, quota errors, and mobile reload behavior require browser tests. Existing server integration tests need authentication setup and a running server before they can pass.

Still outstanding: complete and verified release pagination, server-side catalog re-resolution of export selections, accurate source disc metadata, a working no-card hosted environment, authorized live extraction, cross-device sync, and Telegram. No billing, deployment, or merge is performed by this commit.
