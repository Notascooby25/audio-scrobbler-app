# Phase 1: Protect User Data and Spotify Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1 security and reliability hardening (SEC-1, NAV-11, REL-1, REL-2, SEC-2, SEC-3, OPS-1) to eliminate client private data leaks on shared devices, provide a public Sign Out button, prevent Spotify token loss, reduce real-time sync polling volume by 50%, prevent SSRF, shield internal routes, and safeguard database migrations.

**Architecture:** 
1. Service worker PWA cache restricted strictly to static shell assets; client cache storage purged on sign-out.
2. Sign-out button exposed in production `ProfilePage.jsx` and `HeaderNav.jsx`.
3. Rotated Spotify refresh tokens committed immediately via `db.commit()` in backend and worker.
4. Background worker caches active access tokens in memory for their TTL, skipping redundant token refresh calls.
5. Strict domain allowlist for YouTube URL resolution and push notification endpoints.
6. Nginx configuration blocks `/internal/` and `/metrics` from public ingress, constant-time token comparison for ingestion, and backend port bound to `127.0.0.1`.
7. Pre-migration backup snapshot safety in container entrypoint.

**Tech Stack:** FastAPI (Python 3.12), SQLAlchemy 2.0, APScheduler, React 18, Vite, Service Worker API, Nginx.

**Spec:** Review findings SEC-1, NAV-11, REL-1, REL-2, SEC-2, SEC-3, OPS-1 from Combined Review.

## Global Constraints
- Strictly follow `AGENTS.md` and `references/engineering-checks.md`.
- No uncommitted work; work on dedicated branch `fix/protect-data-and-spotify-phase-1`.
- Tests must pass: `ruff check`, `shellcheck`, `pytest`, `npm test`, `npm run build`.

---

### Task 1: SEC-1 & NAV-11 — Service Worker Private Data Isolation & Production Sign Out

**Files:**
- Modify: `frontend/public/service-worker.js`
- Modify: `frontend/src/pages/HomePage.jsx`
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/components/HeaderNav.jsx`
- Test: `frontend/src/pages/ProfilePage.test.jsx`
- Test: `frontend/src/pages/HomePage.test.jsx`

**Interfaces:**
- Produces: `clearClientSession()` helper that purges `localStorage` and `caches.delete()` for all keys in `window.caches`.

- [ ] **Step 1: Write failing test asserting Sign Out is rendered in production and clears caches**
Add unit test in `ProfilePage.test.jsx` asserting that when `token` is present and viewing own profile (`is_self: true`), a "Sign out" button is rendered and clicking it clears tokens and CacheStorage.

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- src/pages/ProfilePage.test.jsx`
Expected: FAIL (Sign Out button missing on Profile).

- [ ] **Step 3: Update `frontend/public/service-worker.js` to only cache static shell assets**
Update `service-worker.js` `fetch` listener:
- Only cache requests whose path begins with `/assets/`, `/icons/`, or exact `/manifest.json`, `/favicon.ico`, `/logo.png`.
- Completely bypass caching for ANY other request (never cache `/library`, `/setlists`, `/reports`, `/notifications`, `/preferences`, etc.).

- [ ] **Step 4: Expose Sign Out in `ProfilePage.jsx` and `HomePage.jsx` in production**
- Move `Sign out` out of `import.meta.env.DEV` in `HomePage.jsx`.
- Add `Sign out` action button to `ProfilePage.jsx` when viewing own profile.
- Create shared session clearer that executes `if ('caches' in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k)))`.

- [ ] **Step 5: Run tests and verify they pass**
Run: `cd frontend && npm test -- src/pages/ProfilePage.test.jsx src/pages/HomePage.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/public/service-worker.js frontend/src/pages/ProfilePage.jsx frontend/src/pages/ProfilePage.test.jsx frontend/src/pages/HomePage.jsx
git commit -m "fix(auth): isolate service worker caching and add public sign out (Planner Step 1)"
```

---

### Task 2: REL-1 — Immediate Transaction Commit on Rotated Spotify Refresh Tokens

**Files:**
- Modify: `backend/app/services/spotify_library_service.py`
- Modify: `worker/spotify_ingestion.py`
- Test: `backend/app/tests/test_spotify_library_service.py`
- Test: `worker/tests/test_spotify_ingestion.py`

**Interfaces:**
- Consumes: `_refresh_access_token(db: Session, user: User)`
- Produces: Persistent `user.refresh_token_cipher` immediately committed to DB upon rotation.

- [ ] **Step 1: Write failing test in `test_spotify_library_service.py`**
Test that `_refresh_access_token` commits the DB session when `refresh_token` is present in Spotify's response.

- [ ] **Step 2: Run test to verify failure**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_spotify_library_service.py -k test_refresh_token_commit -v`
Expected: FAIL (only `db.flush()` was called).

- [ ] **Step 3: Implement immediate `commit()` on token rotation**
- In `backend/app/services/spotify_library_service.py`: when `rotated_token` is received, set `user.refresh_token_cipher` and call `db.commit()`.
- In `worker/spotify_ingestion.py`: immediately commit `rotated_refresh_token` right after `client.refresh_access_token(...)` before making downstream calls.

- [ ] **Step 4: Run tests to verify pass**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_spotify_library_service.py worker/tests/test_spotify_ingestion.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/services/spotify_library_service.py worker/spotify_ingestion.py backend/app/tests/test_spotify_library_service.py
git commit -m "fix(spotify): commit rotated refresh tokens immediately (Planner Step 2)"
```

---

### Task 3: REL-2 — In-Memory Access Token Caching in Real-Time Playback Worker

**Files:**
- Modify: `worker/spotify_ingestion.py`
- Test: `worker/tests/test_realtime_token_cache.py`

**Interfaces:**
- Produces: `_get_or_refresh_access_token(user, client, session) -> tuple[str, bool]` which checks in-memory cache before requesting fresh token.

- [ ] **Step 1: Write failing test in `worker/tests/test_realtime_token_cache.py`**
Assert that calling `sync_currently_playing` twice in succession for the same user only makes ONE call to `client.refresh_access_token`.

- [ ] **Step 2: Run test to verify failure**
Run: `PYTHONPATH=worker python -m pytest worker/tests/test_realtime_token_cache.py -v`
Expected: FAIL (two calls made).

- [ ] **Step 3: Implement memory token caching in `worker/spotify_ingestion.py`**
- Maintain `_TOKEN_CACHE: dict[int, tuple[str, datetime]]` mapping `user_id` to `(access_token, expires_at)`.
- If cached token has > 5 minutes until expiry, reuse it.
- On 401 response from `currently_playing`, evict from cache and retry once.

- [ ] **Step 4: Run test to verify pass**
Run: `PYTHONPATH=worker python -m pytest worker/tests/test_realtime_token_cache.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add worker/spotify_ingestion.py worker/tests/test_realtime_token_cache.py
git commit -m "perf(worker): cache active access tokens in memory to throttle sync polling (Planner Step 3)"
```

---

### Task 4: SEC-2 — SSRF Protection on YouTube Channel Resolution and Push Subscriptions

**Files:**
- Modify: `backend/app/services/youtube_service.py`
- Modify: `backend/app/schemas/notifications.py`
- Test: `backend/app/tests/test_ssrf_protection.py`

**Interfaces:**
- Validates URLs against strict hostname allowlists (`youtube.com`, `youtu.be`, and known web-push providers).

- [ ] **Step 1: Write failing tests in `test_ssrf_protection.py`**
Test that `resolve_channel_info("http://127.0.0.1:8000")` and `resolve_channel_info("http://192.168.1.1/secret")` raise `ValueError("Only YouTube URLs are allowed")`.
Test that push subscriptions with arbitrary non-push endpoints raise validation error.

- [ ] **Step 2: Run test to verify failure**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_ssrf_protection.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement URL domain validation**
- In `youtube_service.py`: parse `url_or_handle` with `urllib.parse.urlparse`. Restrict scheme to `http`/`https` and hostname to `{"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}`.
- In `schemas/notifications.py`: validate endpoint is `https` and matches approved push domain patterns.

- [ ] **Step 4: Run test to verify pass**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_ssrf_protection.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/services/youtube_service.py backend/app/schemas/notifications.py backend/app/tests/test_ssrf_protection.py
git commit -m "security(ssrf): restrict youtube channel lookups and push endpoints to allowlisted domains (Planner Step 4)"
```

---

### Task 5: SEC-3 — Reverse Proxy Path Shielding, Constant-Time Auth, and Port Binding

**Files:**
- Modify: `frontend/nginx.conf`
- Modify: `backend/app/api/ingestion.py`
- Modify: `docker-compose.prod.yml`
- Test: `backend/app/tests/test_worker_auth.py`

**Interfaces:**
- Nginx explicitly returns 404 for any path matching `/internal/`.
- Ingestion token check uses `hmac.compare_digest`.
- Production compose binds backend port strictly to `127.0.0.1`.

- [ ] **Step 1: Write test for constant-time worker authentication in `test_worker_auth.py`**
Test valid and invalid tokens, ensuring empty tokens are rejected with 401.

- [ ] **Step 2: Run test to verify behavior**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_worker_auth.py -v`

- [ ] **Step 3: Implement changes in `nginx.conf`, `ingestion.py`, and `docker-compose.prod.yml`**
- In `frontend/nginx.conf`:
  ```nginx
  location ~ /internal/ {
      return 404;
  }
  ```
- In `backend/app/api/ingestion.py`:
  Replace `!=` with `hmac.compare_digest(x_worker_token, settings.worker_ingestion_token)`.
- In `docker-compose.prod.yml`:
  Change `- "${BACKEND_HOST_PORT:-8000}:8000"` to `- "127.0.0.1:${BACKEND_HOST_PORT:-8000}:8000"`.

- [ ] **Step 4: Run test suite and compose validation**
Run: `docker compose -f docker-compose.prod.yml config -q && PYTHONPATH=worker python -m pytest backend/app/tests/test_worker_auth.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/nginx.conf backend/app/api/ingestion.py docker-compose.prod.yml backend/app/tests/test_worker_auth.py
git commit -m "security(ingress): shield internal routes in nginx, use constant-time auth, and bind localhost (Planner Step 5)"
```

---

### Task 6: OPS-1 — Pre-Migration Database Snapshot Entrypoint Safety

**Files:**
- Create: `backend/scripts/pre_migration_backup.sh`
- Modify: `backend/Dockerfile`
- Test: `backend/scripts/tests/test_pre_migration_backup.sh`

**Interfaces:**
- Produces: Safe fallback that attempts a schema/data dump if `pg_dump` is available and database is reachable before executing `alembic upgrade head`.

- [ ] **Step 1: Write test script for pre-migration backup logic**
Create hermetic test verifying the script handles database availability, creates timestamped snapshot if tools present, and continues safely.

- [ ] **Step 2: Run test script**
Run: `bash backend/scripts/tests/test_pre_migration_backup.sh`
Expected: PASS.

- [ ] **Step 3: Add pre-migration script and update `backend/Dockerfile` entrypoint**
Add `pre_migration_backup.sh` in backend container and execute before `alembic upgrade head`.

- [ ] **Step 4: Verify Docker build**
Run: `docker build -t audio-scrobbler-backend-test backend/`
Expected: Build passes cleanly.

- [ ] **Step 5: Commit**
```bash
git add backend/scripts/ backend/Dockerfile
git commit -m "ops(db): add pre-migration snapshot check before alembic upgrade (Planner Step 6)"
```

---

### Task 7: Full System Verification, Security Audit & Release Prep

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/changelogData.js`
- Modify: `HANDOVER.md`

- [ ] **Step 1: Run full verification suite**
```bash
ruff check backend/app worker scripts
shellcheck scripts/*.sh
cd frontend && npm run lint && npm test && npm run build
PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
bash scripts/tests/test_restore_drill.sh
```

- [ ] **Step 2: Run `pip-audit` and `npm audit`**
Audit dependencies and record clean/fixed state.

- [ ] **Step 3: Bump version to `v0.34.0` and update changelog & handover**
Add `v0.34.0` entry covering Phase 1 security, reliability, and data protection improvements.

- [ ] **Step 4: Commit**
```bash
git add frontend/package.json frontend/src/changelogData.js HANDOVER.md
git commit -m "docs(release): bump version to v0.34.0 and record Phase 1 protections (Planner Step 7)"
```
