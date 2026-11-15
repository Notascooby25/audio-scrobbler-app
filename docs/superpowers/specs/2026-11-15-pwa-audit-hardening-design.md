# PWA Audit Hardening — Design

**Date:** 2026-11-15
**Branch:** `fix/pwa-audit-hardening`

## Intent & Why
Address the Medium and Low findings from the 2026-11-15 PWA security and failure-points audit without introducing risky major-version dependency upgrades.

## Scope (Goals & Non-Goals)
- **Goals:**
  1. Add HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`) in `frontend/nginx.conf`, externalizing the small theme-init script from `frontend/index.html` into `frontend/public/theme-init.js` so `script-src 'self'` works without `'unsafe-inline'`.
  2. Fix the missing `/icons/badge-72x72.png` reference in `frontend/public/service-worker.js` (use `/icons/icon-192.png` or add a 72×72 badge) and remove eager `skipWaiting()` + `clients.claim()` so new service workers wait until `UpdateBanner` triggers an explicit reload/update.
  3. Add a lightweight `<OfflineBanner />` in `frontend/src/components/Layout.jsx` listening to `offline`/`online` events so users see a clear notice when disconnected.
  4. Clean up unused `vapid_claims` in `backend/app/config.py` and log a startup warning in `production` if `ALLOWED_SPOTIFY_USER_IDS` is empty.
  5. Run non-breaking `npm audit fix` on `frontend/`.
- **Non-Goals:**
  - Major-version upgrades (`react-router-dom` v7, `vite` v8, `vitest` v5) are deferred to a dedicated upgrade PR.
  - Full offline data caching / IndexedDB sync queue (per `agents/page_specs.md` §9).

## Approaches Considered
1. **Inline CSP `'unsafe-inline'` vs. externalizing `theme-init.js`:** Moving the 15-line inline script in `frontend/index.html` to `frontend/public/theme-init.js` keeps `script-src 'self'` strict with zero `'unsafe-inline'` scripts. (Chosen.)
2. **Non-breaking `npm audit fix` vs. `--force` major bumps:** Keeping major bumps separate avoids mixing routing/bundler breaking changes into a security hardening release. (Chosen.)
