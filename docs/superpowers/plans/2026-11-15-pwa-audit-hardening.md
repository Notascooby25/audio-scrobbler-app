# PWA Audit Hardening — Implementation Plan

1. **Externalize theme-init script & add nginx security headers**
   - Extract the inline `<script>` from `frontend/index.html` into `frontend/public/theme-init.js` and reference `<script src="/theme-init.js"></script>`.
   - Add `/theme-init.js` to `APP_SHELL_URLS` / `isStaticShellAsset` in `frontend/public/service-worker.js` and `Cache-Control: no-cache` in `frontend/nginx.conf`.
   - Add security headers in `frontend/nginx.conf` (inside `server {}` and repeated in `location` blocks that use `add_header` so nginx header inheritance is preserved):
     - `X-Content-Type-Options "nosniff"`
     - `X-Frame-Options "DENY"`
     - `Referrer-Policy "strict-origin-when-cross-origin"`
     - `Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"`

2. **Service worker update & notification badge**
   - In `frontend/public/service-worker.js`:
     - Bump `CACHE_NAME` to `"audio-scrobbler-shell-v14"`.
     - Replace `badge: "/icons/badge-72x72.png"` with `badge: "/icons/icon-192.png"` (which exists in `frontend/public/icons/`).
     - Remove unconditional `self.skipWaiting()` from `install` and `self.clients.claim()` from `activate`; add a `message` listener for `{ type: "SKIP_WAITING" }` so `UpdateBanner` / `clearAppCaches` activates the waiting worker on user confirmation.

3. **Offline banner**
   - Create `frontend/src/components/OfflineBanner.jsx` + `OfflineBanner.test.jsx` using `navigator.onLine` and `online`/`offline` window events, styled with `.update-banner` tokens in `frontend/src/styles.css`.
   - Render `<OfflineBanner />` in `frontend/src/components/Layout.jsx`.

4. **Backend config polish**
   - In `backend/app/config.py`: remove unused `vapid_claims` (and `__post_init__`), and in `backend/app/main.py` startup log a warning if `settings.environment.lower() == "production"` and `not settings.allowed_spotify_ids()`.
   - Add/update unit test in `backend/app/tests/test_auth.py`.

5. **Safe npm dependency fixes**
   - Run `cd frontend && npm audit fix` (without `--force`) to patch non-breaking advisories (`zod`, `source-map-js`, etc.).

6. **Verification & release prep**
   - Run Ruff (`ruff check`, `ruff format --check`), pytest (`backend/app/tests worker/tests`), frontend lint + unit tests + build (`npm run lint && npm test && npm run build`), and Playwright E2E (`npm run test:e2e`).
   - Run `differential-review` and `pwa-failure-points` quick check, bump version/changelog (`frontend/package.json`, `frontend/src/changelogData.js`), commit, push to `fix/pwa-audit-hardening`, and hand over for preview & merge go-ahead.
