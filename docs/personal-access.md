# Personal export access

## Configuration

Set MUSICRIP_API_SECRET to a long random value in the server environment or a private .env file. Never commit the actual value or use a VITE_ environment variable for it. Export routes return 503 when no secret is configured; catalog browsing is unchanged. The middleware reads the environment on each request so dotenv initialization order does not disable protection.

## Browser access

Use HTTPS outside localhost. Open /api/export/cleanup in a browser tab using GET: because authentication runs before route method matching only on registered routes, use /api/export/job/access-check instead to trigger the authentication challenge. Enter username musicrip and the configured secret as the password. With valid credentials this non-existent job returns 404; that is expected. Return to the app on the same origin and retry the operation. Browser-native Basic authentication allows normal same-origin API requests and ZIP links without placing secrets in download URLs. Browser prompt/credential reuse must be manually verified in the target browser and AI Studio preview; sandboxed previews may require opening the app in a separate tab.

API clients may send Authorization: Bearer <secret> or x-musicrip-token. Query-string tokens are deliberately not accepted. Credentials are not added to IndexedDB, localStorage, JSON backups, or generated files by this patch.

Basic credentials may remain cached by the browser. For shared devices, close the private browsing session after use; this patch does not implement a logout/session-management UI. HTTPS and the shared secret are prerequisites, not a complete production security review. Health and catalog routes are not protected by this middleware.

## Checks

Focused regression test: npx tsx --test test/auth.test.ts
Typecheck: npm run lint
Production frontend build: npm run build

The tests cover missing configuration, invalid credentials, same-origin requests without credentials, Basic/Bearer/header authentication, rejection of URL tokens and cross-site browser requests, and runtime secret changes. They have been authored but not executed by the assistant. Existing server integration tests will need configured authentication before they can pass against this fail-closed server.

## Scope

This first patch only addresses personal export authentication. Worker cancellation/retry races, storage durability, catalog completeness, and successful live media retrieval are not fixed or proven by it. Do not merge or deploy as a claim that all review findings have been resolved.
