# Site Integrity Cleanups & Scope Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve identified audit issues and warnings across the site: align live server `SPOTIFY_SCOPES`, modernize Python `datetime.utcnow()` usages to eliminate 1,640 test deprecation warnings, resolve the Vite static/dynamic import warning in `SettingsPage.jsx`, and add React Router future flags to silence console warnings.

**Architecture:** 
1. Frontend cleanups: Replace dynamic import in `SettingsPage.jsx` with static imports; supply React Router future flags to `<BrowserRouter>` and test `<MemoryRouter>`.
2. Backend & Worker: Introduce naive UTC helper `utc_now()` in `backend/app/datetime_utils.py` and replace `datetime.utcnow()` across services, queries, and worker to maintain 100% database compatibility while eliminating deprecation warnings.
3. Production configuration: Verify and align `SPOTIFY_SCOPES` on the live production server, verified with `preview_settings_check.sh`.
4. Release documentation: Bump patch version to `v0.33.1` in `package.json` and add `changelogData.js` entry.

**Tech Stack:** React 18, React Router v6 (with v7 future flags), Vite 5, Python 3.12 (FastAPI, SQLAlchemy 2, Alembic), Docker Compose.

**Spec:** [`docs/security/2026-11-06-site-integrity-and-security-audit.md`](../../security/2026-11-06-site-integrity-and-security-audit.md)

## Global Constraints
- Preserve exact SQLAlchemy and database column types (naive UTC datetimes without timezone offset).
- Adhere to the "One Voice Rule" and flat design standards in `DESIGN.md`.
- No modification to protected Retro Jukebox component styles.
- Commit to working branch `fix/site-integrity-cleanups-and-scope-alignment` only, never `main`.

## Review Focus
1. Database timestamp compatibility: Naive UTC datetimes must be returned so SQLite and Postgres naive `DateTime` columns continue comparing without `TypeError: can't compare offset-naive and offset-aware datetimes`.
2. Static API imports: `fetchNotifications` and `markNotificationsRead` must retain identical runtime error handling and notification event dispatching (`window.dispatchEvent(new Event("notifications_read"))`).
3. React Router future flags: Adding `v7_startTransition` and `v7_relativeSplatPath` must not break page transitions or splat routes.
4. Settings checker: `preview_settings_check.sh` must report `Settings match.` without error.
5. Automated test integrity: 100% of existing 411 pytest and 366 Vitest tests must pass without regressions.

---

### Task 1: Frontend Cleanups (Static Imports & React Router Future Flags)

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx:4-20,136-155`
- Modify: `frontend/src/App.jsx:36-56`
- Modify: `frontend/src/pages/ChangelogPage.test.jsx:1-25`
- Test: `frontend/src/pages/SettingsPage.test.jsx`, `frontend/src/App.test.jsx`

**Interfaces:**
- Consumes: `fetchNotifications`, `markNotificationsRead` from `frontend/src/api.js`
- Produces: Clean Vite build without static/dynamic collision warning; React Router future flags enabled

- [ ] **Step 1: Update `SettingsPage.jsx` to statically import notification functions**
  Add `fetchNotifications, markNotificationsRead` to static import from `../api` at top of `SettingsPage.jsx`. Replace dynamic `import("../api").then(...)` at line 139 with direct invocation of `fetchNotifications`.

- [ ] **Step 2: Add future flags to `App.jsx` and test `ChangelogPage.test.jsx`**
  In `frontend/src/App.jsx`:
  ```jsx
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  ```
  In `frontend/src/pages/ChangelogPage.test.jsx`:
  Add `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` to `<MemoryRouter>`.

- [ ] **Step 3: Verify frontend tests and production build**
  Run: `cd frontend && npm run lint && npm test && npm run build`
  Expected: All 366 unit tests pass, and `npm run build` succeeds without `(!) /home/andyl/Audio Scrobbler App/frontend/src/api.js is dynamically imported...` warning.

- [ ] **Step 4: Commit frontend cleanups**
  ```bash
  git add frontend/src/pages/SettingsPage.jsx frontend/src/App.jsx frontend/src/pages/ChangelogPage.test.jsx
  git commit -m "fix(frontend): static notification imports and react-router v7 future flags (Planner Step 1)"
  ```

---

### Task 2: Backend & Worker Datetime Modernization (`datetime.utcnow()` Deprecation)

**Files:**
- Create: `backend/app/datetime_utils.py`
- Modify: `backend/app/api/analytics.py`
- Modify: `backend/app/queries/analytics_queries.py`
- Modify: `backend/app/services/catalog_1001_service.py`
- Modify: `backend/app/services/geocoding_service.py`
- Modify: `backend/app/services/gig_reports_service.py`
- Modify: `backend/app/services/setlist_artwork_service.py`
- Modify: `backend/app/services/setlist_attendance_service.py`
- Modify: `backend/app/services/setlist_import_job_service.py`
- Modify: `backend/app/services/setlist_service.py`
- Modify: `backend/app/services/social_service.py`
- Modify: `backend/app/services/spotify_library_service.py`
- Modify: `worker/spotify_ingestion.py`
- Test: `backend/app/tests/test_datetime_utils.py`, `backend/app/tests/test_setlist_service.py`, `backend/app/tests/test_spotify_library_likes.py`

**Interfaces:**
- Produces: `utc_now() -> datetime` returning naive UTC `datetime.now(timezone.utc).replace(tzinfo=None)`

- [ ] **Step 1: Create `backend/app/datetime_utils.py` with tests**
  ```python
  from __future__ import annotations
  from datetime import datetime, timezone

  def utc_now() -> datetime:
      """Returns the current UTC datetime without tzinfo for database compatibility."""
      return datetime.now(timezone.utc).replace(tzinfo=None)
  ```
  Write unit tests in `backend/app/tests/test_datetime_utils.py` asserting return type is `datetime`, `tzinfo is None`, and timestamp matches current UTC within reasonable delta.

- [ ] **Step 2: Replace `datetime.utcnow()` across backend services and queries**
  Import `utc_now` from `..datetime_utils` (or `.datetime_utils`) and replace `datetime.utcnow()` in:
  - `backend/app/api/analytics.py`
  - `backend/app/queries/analytics_queries.py`
  - `backend/app/services/catalog_1001_service.py`
  - `backend/app/services/geocoding_service.py`
  - `backend/app/services/gig_reports_service.py`
  - `backend/app/services/setlist_artwork_service.py`
  - `backend/app/services/setlist_attendance_service.py`
  - `backend/app/services/setlist_import_job_service.py`
  - `backend/app/services/setlist_service.py`
  - `backend/app/services/social_service.py`
  - `backend/app/services/spotify_library_service.py`

- [ ] **Step 3: Replace `datetime.utcnow()` in `worker/spotify_ingestion.py`**
  In `worker/spotify_ingestion.py`, define or import helper to use `datetime.now(timezone.utc).replace(tzinfo=None)`.

- [ ] **Step 4: Update backend tests using `datetime.utcnow()` to use `utc_now()`**
  Replace remaining `datetime.utcnow()` calls in `backend/app/tests/` to eliminate remaining test deprecation warnings.

- [ ] **Step 5: Run linters and full pytest suite**
  Run:
  ```bash
  ruff check backend/app worker scripts
  PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
  ```
  Expected: Clean ruff check; all 411+ tests pass with 0 deprecation warnings from our code.

- [ ] **Step 6: Commit backend modernization**
  ```bash
  git add backend/app/datetime_utils.py backend/app/ backend/app/tests/ worker/
  git commit -m "refactor(backend): modernize datetime.utcnow to naive timezone.utc helper (Planner Step 2)"
  ```

---

### Task 3: Production Server Scope Alignment & Verification

**Files:**
- Verification: `scripts/preview_settings_check.sh`
- Server Target: `/srv/audio-scrobbler-app/docker-compose.prod.yml`

- [ ] **Step 1: Run pre-check on settings**
  Run: `bash scripts/preview_settings_check.sh`
  Confirm current discrepancy: `SPOTIFY_SCOPES: different on live from this branch's default`.

- [ ] **Step 2: Provide clear, copyable instructions or run server alignment**
  Ensure `/srv/audio-scrobbler-app/docker-compose.prod.yml` on the NUC contains line 41:
  ```yaml
        SPOTIFY_SCOPES: ${SPOTIFY_SCOPES:-user-read-recently-played user-library-read user-library-modify user-read-currently-playing playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public}
  ```
  And backend container is restarted with:
  ```bash
  cd /srv/audio-scrobbler-app && docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps backend
  ```

- [ ] **Step 3: Run `scripts/preview_settings_check.sh` to verify settings match**
  Run: `bash scripts/preview_settings_check.sh`
  Expected: `Settings match.` (exit code 0).

---

### Task 4: Release Version Bump, Changelog & Handover Documentation

**Files:**
- Modify: `frontend/package.json` (bump to `0.33.1`)
- Modify: `frontend/src/changelogData.js` (add v0.33.1 entry)
- Modify: `HANDOVER.md`
- Track: `docs/security/2026-11-06-site-integrity-and-security-audit.md`
- Track: `docs/superpowers/plans/2026-11-06-site-integrity-and-hygiene-fixes.md`

- [ ] **Step 1: Bump version and add changelog entry**
  In `frontend/package.json`, set `"version": "0.33.1"`.
  In `frontend/src/changelogData.js`, add entry at the top:
  ```javascript
  {
    version: "v0.33.1",
    date: "2026-11-06",
    title: "Site Integrity & Modernization Updates",
    highlights: [
      "Modernized backend datetime handling to eliminate Python 3.12+ deprecation warnings.",
      "Resolved frontend bundle static/dynamic import warnings in Settings.",
      "Enabled React Router v7 future transition flags.",
      "Aligned production host Spotify library permissions for two-way likes."
    ]
  }
  ```

- [ ] **Step 2: Format modified frontend files with Prettier**
  Run: `npx prettier --write frontend/src/changelogData.js frontend/package.json`

- [ ] **Step 3: Run full CI verification suite**
  ```bash
  ruff check backend/app worker scripts
  .venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh
  bash scripts/tests/test_restore_drill.sh
  bash scripts/tests/test_preview_settings_check.sh
  bash scripts/tests/test_preview.sh
  PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
  cd frontend && npm run lint && npm test && npm run build
  ```

- [ ] **Step 4: Commit release documentation**
  ```bash
  git add frontend/package.json frontend/src/changelogData.js HANDOVER.md docs/
  git commit -m "docs: bump version to v0.33.1 and document integrity audit cleanups (Planner Step 4)"
  ```

---

## Verification Plan

### Automated Tests
1. **Python Linter:** `ruff check backend/app worker scripts`
2. **ShellCheck:** `.venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh`
3. **Backend & Worker Pytest:** `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q` (Assert all pass with 0 deprecation warnings)
4. **Frontend Linter & Unit Tests:** `cd frontend && npm run lint && npm test`
5. **Frontend Production Build:** `cd frontend && npm run build` (Assert build succeeds with zero import warnings)
6. **Script Fixture Tests:** `bash scripts/tests/test_restore_drill.sh && bash scripts/tests/test_preview_settings_check.sh && bash scripts/tests/test_preview.sh`
7. **Live Settings Match:** `bash scripts/preview_settings_check.sh`

### Manual Verification
1. Open the preview (`scripts/preview.sh up`) and verify:
   - Navigate across Play, Library, Reports, Gigs, Settings.
   - In Settings > Notifications, confirm notifications load and mark as read without console errors.
   - Check footer What's New dialog opens with `v0.33.1` changes visible.
