# Set List Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build native Setlist.fm gig attendance tracking, support act detection, automatic concert scrobbling into `listening_events`, historical import/export, and live statistics (Artists Seen, Songs Heard, Venues) inside the Audio Scrobbler App.

**Architecture:** A dedicated SQLAlchemy 2.0 data layer (`attended_concerts`, `setlist_cache`, `setlist_api_usage`) backed by PostgreSQL; a throttled Setlist.fm API client guaranteeing ≤2 req/s and ≤1,440 calls/day across backend and worker containers; an attendance service that sequences non-overlapping concert scrobbles; and a flat, responsive React UI in a new `Set Lists` navigation tab.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, PostgreSQL, React 18, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-setlist-tracking-design.md`

## Global Constraints

- Python backend code must follow PEP 8 and PEP 484 type hints (`from __future__ import annotations`), SQLAlchemy 2.0 typed mapped columns, with all imports placed strictly at the top of files.
- Setlist.fm API rate limit must never exceed 2 requests/second or 1,440 requests/day, mediated centrally across containers using the `setlist_api_usage` PostgreSQL table.
- Third-party API secret `SETLIST_FM_API_KEY` lives strictly in server environment / `.env`; never commit secrets or expose them to the browser.
- Frontend must adhere to `DESIGN.md`: Flat-by-default, zero box-shadows, zero gradients, 0.5px hairline borders (`#333` in dark mode, `#E5E5E5` in light mode), and outline icons only.
- Ingestion of concert tracks into `listening_events` must set `source="setlistfm"` and unique `play_id="setlistfm_{setlist_id}_{song_index}"` to guarantee deduplication and clean cascade deletion.
- Every commit or PR must pass linters (`ruff check`, `ruff format --check`, `npm run lint`) and tests (`pytest`, `npm test`, `npm run build`).

## Review Focus

1. **Festival Lineup Prompt Overflow:** When logging a gig at a festival venue with 30+ setlists on the same date, the support acts prompt must not render dozens of checkboxes; it must cap suggestions or switch to a searchable picker so the UI never crashes or overwhelms.
   * *Pinning test:* `test_support_acts_festival_capping()` in Task 2.
2. **Support Band and Headliner Timestamp Overlap:** If a headliner and 2 support acts are logged for the same night, their scrobbles must be chronologically sequenced backwards (e.g. 6:45 PM, 7:30 PM, 8:45 PM) so no two songs have identical `played_at` timestamps.
   * *Pinning test:* `test_attendance_scrobble_sequencing_non_overlapping()` in Task 3.
3. **Empty or Missing Setlist Handling:** A gig logged with zero songs (common on the day of a show) must record attendance without crashing the scrobble pipeline, and must support future update via "Refresh Setlist".
   * *Pinning test:* `test_log_attendance_with_empty_setlist_and_refresh()` in Task 3.
4. **Historical Import Rate-Limit Exceeded (429 or 1,440 Cap):** If Setlist.fm returns HTTP 429 or the daily 1,400 call cap is hit mid-import, the worker must pause gracefully, save progress, and notify the user rather than failing catastrophically or spamming retries.
   * *Pinning test:* `test_setlist_import_worker_pauses_on_quota_limit()` in Task 6.
5. **Cascading Scrobble Purge on Gig Deletion:** Deleting an attended concert with the "also delete support acts" option checked must purge both the headliner and support act records from `attended_concerts` and purge all associated rows from `listening_events`.
   * *Pinning test:* `test_delete_attended_concert_cascade_purges_scrobbles()` in Task 3.

---

### Task 1: Database Models & Alembic Migration

**Files:**
- Modify: `backend/app/models.py:200-251`
- Create: `backend/migrations/versions/0020_add_setlist_tracking.py`
- Test: `backend/app/tests/test_setlist_models.py`

**Interfaces:**
- Produces: `AttendedConcert`, `SetlistCache`, `SetlistApiUsage` SQLAlchemy models.

- [ ] **Step 1: Write failing model test**
Create `backend/app/tests/test_setlist_models.py` verifying model instantiation, column types, unique constraints on `(user_id, setlist_id)`, and `SetlistApiUsage` initialization.
- [ ] **Step 2: Run test to verify it fails**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_models.py -q`
Expected: FAIL with `ImportError: cannot import name 'AttendedConcert'`
- [ ] **Step 3: Define models in `backend/app/models.py`**
Add `AttendedConcert`, `SetlistCache`, and `SetlistApiUsage` using SQLAlchemy 2.0 `Mapped` and `mapped_column` with constraints specified in spec Section 4.1.
- [ ] **Step 4: Create Alembic migration `0020_add_setlist_tracking.py`**
Generate migration revising `0019_add_followed_youtube_channels` creating `attended_concerts`, `setlist_cache`, and `setlist_api_usage`.
- [ ] **Step 5: Run tests to verify they pass**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_models.py -q`
Expected: PASS
- [ ] **Step 6: Commit**
```bash
git add backend/app/models.py backend/migrations/versions/0020_add_setlist_tracking.py backend/app/tests/test_setlist_models.py
git commit -m "feat(backend): add setlist tracking database models and migration"
```

---

### Task 2: Setlist.fm Rate Limiter & API Client

**Files:**
- Create: `backend/app/services/setlist_service.py`
- Test: `backend/app/tests/test_setlist_service.py`

**Interfaces:**
- Consumes: `SetlistCache`, `SetlistApiUsage`, `SETLIST_FM_API_KEY`
- Produces: `SetlistService` with methods:
  - `search_setlists(artist_name: str, country_code: str | None, year: int | None, venue_name: str | None, p: int = 1) -> dict`
  - `get_setlist(setlist_id: str) -> dict`
  - `get_venue_date_setlists(venue_id: str, event_date_str: str) -> list[dict]`
  - `get_user_attended(username: str, p: int = 1) -> dict`

- [ ] **Step 1: Write failing tests for SetlistService**
Write tests in `backend/app/tests/test_setlist_service.py` mocking `httpx.get`:
- Test rate limit enforcement (minimum 500ms between calls using `SetlistApiUsage`).
- Test caching in `SetlistCache` (second call returns cached response without HTTP call).
- Test Review Focus 1 (`test_support_acts_festival_capping` capping venue/date support acts if >10).
- [ ] **Step 2: Run test to verify it fails**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_service.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.app.services.setlist_service'`
- [ ] **Step 3: Implement `SetlistService` in `backend/app/services/setlist_service.py`**
Implement database-backed token-bucket check on `SetlistApiUsage`, caching layer via `SetlistCache`, headers (`x-api-key`), and response parsing.
- [ ] **Step 4: Run tests to verify they pass**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_service.py -q`
Expected: PASS
- [ ] **Step 5: Commit**
```bash
git add backend/app/services/setlist_service.py backend/app/tests/test_setlist_service.py
git commit -m "feat(backend): implement rate-limited setlist.fm api service with caching"
```

---

### Task 3: Attendance Logging & Scrobble Sequencing Service

**Files:**
- Create: `backend/app/services/setlist_attendance_service.py`
- Test: `backend/app/tests/test_setlist_attendance_service.py`

**Interfaces:**
- Consumes: `AttendedConcert`, `ListeningEvent`, `SetlistService`
- Produces:
  - `log_concert_attendance(db: Session, user_id: int, setlist_id: str, support_setlist_ids: list[str]) -> AttendedConcert`
  - `delete_concert_attendance(db: Session, user_id: int, concert_id: int, include_support_acts: bool = True) -> int`
  - `refresh_concert_setlist(db: Session, user_id: int, concert_id: int) -> AttendedConcert`

- [ ] **Step 1: Write failing tests for Attendance Service**
Write tests in `backend/app/tests/test_setlist_attendance_service.py`:
- Test Review Focus 2 (`test_attendance_scrobble_sequencing_non_overlapping` verifying support acts start at 6:45/7:30 PM, headliner at 8:45 PM, 210s increments).
- Test Review Focus 3 (`test_log_attendance_with_empty_setlist_and_refresh` logging empty show and refreshing when songs appear).
- Test Review Focus 5 (`test_delete_attended_concert_cascade_purges_scrobbles` verifying scrobbles and linked support acts are removed).
- [ ] **Step 2: Run test to verify it fails**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_attendance_service.py -q`
Expected: FAIL
- [ ] **Step 3: Implement `setlist_attendance_service.py`**
Implement setlist song extraction, non-overlapping timestamp generation, `ListeningEvent` batch insertion with `source='setlistfm'`, and cascade deletion logic.
- [ ] **Step 4: Run tests to verify they pass**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_attendance_service.py -q`
Expected: PASS
- [ ] **Step 5: Commit**
```bash
git add backend/app/services/setlist_attendance_service.py backend/app/tests/test_setlist_attendance_service.py
git commit -m "feat(backend): implement concert attendance logging and scrobble sequencing"
```

---

### Task 4: Concert Stats, Leaderboards & Data Export

**Files:**
- Create: `backend/app/services/setlist_stats_service.py`
- Test: `backend/app/tests/test_setlist_stats_service.py`

**Interfaces:**
- Consumes: `AttendedConcert`, `ListeningEvent`
- Produces:
  - `get_my_gigs(db: Session, user_id: int, limit: int = 50, offset: int = 0) -> list[dict]`
  - `get_artists_seen_leaderboard(db: Session, user_id: int) -> list[dict]` (includes list of gig dates/venues for accordion)
  - `get_songs_heard_leaderboard(db: Session, user_id: int) -> list[dict]`
  - `get_venues_visited_leaderboard(db: Session, user_id: int) -> list[dict]`
  - `export_attended_gigs(db: Session, user_id: int, format: str = "json") -> tuple[str, str]` (content, media_type)

- [ ] **Step 1: Write failing tests for stats and export service**
Write tests in `backend/app/tests/test_setlist_stats_service.py` testing aggregation queries, artist accordion gig drilldown, song live playcounts, and JSON/CSV export formatting.
- [ ] **Step 2: Run test to verify it fails**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_stats_service.py -q`
Expected: FAIL
- [ ] **Step 3: Implement `setlist_stats_service.py`**
Write efficient SQLAlchemy grouping and ranking queries matching spec Section 3.3.
- [ ] **Step 4: Run tests to verify they pass**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_stats_service.py -q`
Expected: PASS
- [ ] **Step 5: Commit**
```bash
git add backend/app/services/setlist_stats_service.py backend/app/tests/test_setlist_stats_service.py
git commit -m "feat(backend): add concert stats queries, leaderboards, and data export"
```

---

### Task 5: FastAPI Routes & Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/setlists.py`
- Create: `backend/app/api/setlists.py`
- Modify: `backend/app/main.py:40-70` (register router)
- Test: `backend/app/tests/test_setlist_routes.py`

**Interfaces:**
- Produces: API router mounted at `/api/setlists`:
  - `GET /api/setlists/search`
  - `GET /api/setlists/{setlist_id}`
  - `GET /api/setlists/venue-date-support`
  - `POST /api/setlists/attend`
  - `GET /api/setlists/attendances`
  - `DELETE /api/setlists/{id}`
  - `POST /api/setlists/{id}/refresh`
  - `GET /api/setlists/stats/artists`
  - `GET /api/setlists/stats/songs`
  - `GET /api/setlists/stats/venues`
  - `GET /api/setlists/export`

- [ ] **Step 1: Write failing route integration tests**
Write tests in `backend/app/tests/test_setlist_routes.py` with `TestClient(app)` testing authenticated endpoints, parameter validation, attendance logging, and delete confirmation.
- [ ] **Step 2: Run test to verify it fails**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_routes.py -q`
Expected: FAIL with 404 Not Found
- [ ] **Step 3: Define schemas and route handlers**
Implement Pydantic schemas in `backend/app/schemas/setlists.py` and endpoints in `backend/app/api/setlists.py`, registering router in `backend/app/main.py`.
- [ ] **Step 4: Run tests to verify they pass**
Run: `.venv/bin/pytest backend/app/tests/test_setlist_routes.py -q`
Expected: PASS
- [ ] **Step 5: Commit**
```bash
git add backend/app/schemas/setlists.py backend/app/api/setlists.py backend/app/main.py backend/app/tests/test_setlist_routes.py
git commit -m "feat(backend): expose setlist search, attendance, stats, and export endpoints"
```

---

### Task 6: Background Worker for Historical Setlist.fm Import

**Files:**
- Create: `worker/setlist_import.py`
- Modify: `worker/app.py:50-100` (register job handler)
- Test: `worker/tests/test_setlist_import.py`

**Interfaces:**
- Consumes: Setlist.fm user profile API (`/1.0/user/{userId}/attended`)
- Produces: `sync_user_setlist_history(user_id: int, setlist_username: str)`

- [ ] **Step 1: Write failing worker test**
Write `worker/tests/test_setlist_import.py` testing paginated ingestion of attended concerts, scrobble backfill, and Review Focus 4 (`test_setlist_import_worker_pauses_on_quota_limit`).
- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=worker .venv/bin/pytest worker/tests/test_setlist_import.py -q`
Expected: FAIL
- [ ] **Step 3: Implement `worker/setlist_import.py`**
Implement worker routine fetching pages of attended concerts, creating `AttendedConcert` records, and batch inserting `ListeningEvent` rows with `setlistfm` source.
- [ ] **Step 4: Run tests to verify they pass**
Run: `PYTHONPATH=worker .venv/bin/pytest worker/tests/test_setlist_import.py -q`
Expected: PASS
- [ ] **Step 5: Commit**
```bash
git add worker/setlist_import.py worker/app.py worker/tests/test_setlist_import.py
git commit -m "feat(worker): implement background worker for setlist.fm profile history import"
```

---

### Task 7: Frontend Set Lists Hub, Search & "I Was There" Flow

**Files:**
- Create: `frontend/src/api/setlists.js`
- Create: `frontend/src/components/setlists/SetlistsPage.jsx`
- Create: `frontend/src/components/setlists/GigSearchBar.jsx`
- Create: `frontend/src/components/setlists/GigCard.jsx`
- Create: `frontend/src/components/setlists/SupportActsPromptModal.jsx`
- Modify: `frontend/src/App.jsx:40-80` (add "Set Lists" to navigation)
- Test: `frontend/src/components/setlists/SetlistsPage.test.jsx`

**Interfaces:**
- Produces: Primary `SetlistsPage` component with search bar, filters (Country, Venue, Year), result cards, and support acts prompt modal.

- [ ] **Step 1: Write failing frontend unit tests**
Create `frontend/src/components/setlists/SetlistsPage.test.jsx` testing search input rendering, filter selection, gig result rendering, and opening the "I Was There" support acts modal.
- [ ] **Step 2: Run frontend test to verify it fails**
Run: `cd frontend && npm test -- src/components/setlists/SetlistsPage.test.jsx`
Expected: FAIL
- [ ] **Step 3: Implement Setlists API client and Search/Attendance components**
Build `frontend/src/api/setlists.js`, `GigSearchBar.jsx`, `GigCard.jsx`, `SupportActsPromptModal.jsx`, and `SetlistsPage.jsx` adhering strictly to `DESIGN.md` (flat dark cards, 0.5px hairline borders, `#2563eb` primary buttons, `#16a34a` "I Was There" button).
- [ ] **Step 4: Add "Set Lists" to Navigation in `App.jsx`**
Register the new route/tab in `App.jsx`.
- [ ] **Step 5: Run frontend tests to verify they pass**
Run: `cd frontend && npm test -- src/components/setlists/SetlistsPage.test.jsx`
Expected: PASS
- [ ] **Step 6: Commit**
```bash
git add frontend/src/api/setlists.js frontend/src/components/setlists/ frontend/src/App.jsx
git commit -m "feat(frontend): add set lists navigation hub, search bar, and attendance logger"
```

---

### Task 8: Frontend Stats Views, Delete Modal, Import/Export & Changelog

**Files:**
- Create: `frontend/src/components/setlists/MyGigsTimeline.jsx`
- Create: `frontend/src/components/setlists/ArtistsSeenLeaderboard.jsx`
- Create: `frontend/src/components/setlists/SongsHeardLeaderboard.jsx`
- Create: `frontend/src/components/setlists/VenuesLeaderboard.jsx`
- Create: `frontend/src/components/setlists/DeleteGigConfirmModal.jsx`
- Create: `frontend/src/components/setlists/ImportExportModal.jsx`
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`
- Test: `frontend/src/components/setlists/SetlistsStats.test.jsx`

**Interfaces:**
- Produces: Complete sub-views for My Gigs, Artists Seen (accordion drilldowns), Songs Heard Live, Venues, double-confirm delete modal with support act checkbox, and import/export modal.

- [ ] **Step 1: Write failing tests for stats views and delete modal**
Create `frontend/src/components/setlists/SetlistsStats.test.jsx` testing artist accordion expanding gig dates, songs leaderboard count rendering, and double-confirmation delete modal interaction.
- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- src/components/setlists/SetlistsStats.test.jsx`
Expected: FAIL
- [ ] **Step 3: Implement stats sub-views, delete modal, and import/export**
Build `MyGigsTimeline.jsx` (with "Refresh Setlist" button), `ArtistsSeenLeaderboard.jsx`, `SongsHeardLeaderboard.jsx`, `VenuesLeaderboard.jsx`, `DeleteGigConfirmModal.jsx`, and `ImportExportModal.jsx`.
- [ ] **Step 4: Update changelog and bump version**
Update `frontend/src/changelogData.js` with version entry for Set List Tracking & Gig Scrobbling, and bump `version` in `frontend/package.json`.
- [ ] **Step 5: Run frontend lint, unit tests, and production build**
Run: `cd frontend && npm run lint && npm test && npm run build`
Expected: All PASS and build succeeds.
- [ ] **Step 6: Commit**
```bash
git add frontend/src/components/setlists/ frontend/src/changelogData.js frontend/package.json
git commit -m "feat(frontend): add concert stats leaderboards, delete confirmation, and import/export"
```

---

### Task 9: System Integration, Security Review & End-to-End Verification

**Files:**
- Test: Full backend & frontend test suites
- Test: `scripts/run_differential_review.sh` (or security audit)

- [ ] **Step 1: Run complete backend and worker tests**
Run: `PYTHONPATH=worker .venv/bin/pytest backend/app/tests worker/tests -q`
Expected: All tests pass.
- [ ] **Step 2: Run Ruff linting and formatting check**
Run: `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`
Expected: Clean.
- [ ] **Step 3: Run full frontend test and build**
Run: `cd frontend && npm run lint && npm test && npm run build`
Expected: Clean.
- [ ] **Step 4: Differential security review**
Review all changes against OWASP guidelines, checking API key safety, rate limiting, and parameter validation.
- [ ] **Step 5: Final commit & push**
```bash
git status
git commit -m "feat: complete setlist tracking and concert scrobbling feature"
git push origin main
```
