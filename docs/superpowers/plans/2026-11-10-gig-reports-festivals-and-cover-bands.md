# Gig Reports Accuracy & Cover Band Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct gig reporting metrics so multi-act festival days count as 1 gig/festival visit, exclude upcoming/future events from all Gig Reports metrics, and add a "Cover band" tag to gig logging/editing.

**Architecture:** 
1. Database migration adding `is_cover_band` to `attended_concerts`.
2. Backend updates in `gig_reports_service.py` and `setlist_stats_service.py` applying a strictly-past date cutoff (`event_date.date() < today`) and date-level deduplication for festival counts and period charts.
3. Backend API schemas and routes supporting `is_cover_band`.
4. Frontend modal controls in `ManualConcertModal.jsx` and `EditGigModal.jsx`, and badges in `SetlistGigPage.jsx` and `MyGigsTimeline.jsx`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, React 18, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-11-10-gig-reports-festivals-and-cover-bands-design.md`

## Global Constraints
- Python PEP 8 & PEP 484 with module-level imports only.
- Strict ES2022+ React functional components adhering to `DESIGN.md` flat styling and color tokens.
- No editing of dead code `backend/app/db/queries/analytics_queries.py`.
- Preserve existing Alembic migrations; add new numbered migration `0034_add_cover_band_flag.py`.

## Review Focus
- Date boundary: Ensure events on today's calendar date are treated as upcoming and excluded (`event_date.date() < today`).
- Multi-band festival days: 5 bands logged for the same festival on the same day must show as 1 festival visit in Venue Stomping Grounds and 1 festival outing in Gigs by Period.
- Timezone handling: Use `utc_now().date()` consistently for past-event cutoff.
- Database migration safety: Batch alter table in Alembic for SQLite/Postgres compatibility.
- Backward compatibility: Ensure existing concerts default `is_cover_band=False`.

---

### Task 1: Add `is_cover_band` Column & Migration

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/migrations/versions/0034_add_cover_band_flag.py`
- Test: `backend/app/tests/test_setlist_models.py`

- [ ] Add `is_cover_band: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)` to `AttendedConcert` in `backend/app/models.py`.
- [ ] Create migration `0034_add_cover_band_flag.py` altering `attended_concerts` with `down_revision = "0033_add_artwork_color_and_match_sleeve"`.
- [ ] Add model test in `backend/app/tests/test_setlist_models.py` verifying `is_cover_band` defaults to `False` and persists correctly.
- [ ] Run pytest: `PYTHONPATH=worker python -m pytest backend/app/tests/test_setlist_models.py -q`.

---

### Task 2: Backend Schemas, Routes & Import/Export for Cover Band Flag

**Files:**
- Modify: `backend/app/schemas/setlists.py`
- Modify: `backend/app/services/setlist_attendance_service.py`
- Modify: `backend/app/services/setlist_file_import_service.py`
- Modify: `backend/app/services/setlist_stats_service.py`
- Test: `backend/app/tests/test_setlist_routes.py`
- Test: `backend/app/tests/test_festival_export_import.py`

- [ ] Update `ConcertResponse`, `ManualConcertCreateRequest`, `ConcertUpdateRequest` in `backend/app/schemas/setlists.py` to include `is_cover_band: bool = False`.
- [ ] Update `log_manual_concert` and `update_concert_details` in `setlist_attendance_service.py` to accept and persist `is_cover_band`.
- [ ] Update `SetlistStatsService` (`get_my_gigs`, `get_gig`, `export_attended_gigs`) to serialize and include `is_cover_band`.
- [ ] Update CSV and JSON import/export handling in `setlist_file_import_service.py` to support `is_cover_band`.
- [ ] Write tests verifying manual creation, editing, and import/export with `is_cover_band=True`.
- [ ] Run pytest: `PYTHONPATH=worker python -m pytest backend/app/tests/test_setlist_routes.py backend/app/tests/test_festival_export_import.py -q`.

---

### Task 3: Fix Gig Reports - Same-Day Festival Deduplication & Past Events Cutoff

**Files:**
- Modify: `backend/app/services/gig_reports_service.py`
- Modify: `backend/app/services/setlist_stats_service.py`
- Modify: `backend/app/services/gig_badges_service.py`
- Test: `backend/app/tests/test_gig_reports_service.py`
- Test: `backend/app/tests/test_setlist_stats_service.py`
- Test: `backend/app/tests/test_gig_badges_service.py`

- [ ] In `backend/app/services/gig_reports_service.py`:
  - Define `today = (now or utc_now()).date()`.
  - In `get_gig_travel_and_venues`: Filter `c.event_date.date() < today`. In `venue_groups`, track `distinct_festival_dates = set()` so multiple bands on the same festival date increment `festivals` count once (`len(distinct_festival_dates)`).
  - In `get_gigs_by_period`: Filter `event_date.date() < today`. Group by `(event_date.date(), venue_name)` so multiple festival bands or support acts on the same day register as 1 gig and 1 festival outing.
  - In `get_gig_map_pins`: Filter `c.event_date.date() < today`. Deduplicate pin `gig_count` and `festival_count` by unique calendar dates at that pin.
  - In `get_live_gap`: Filter `seen_live` artist lookup to only concerts where `event_date.date() < today`.
  - In `get_gigs_day_of_week`, `get_gig_cadence_matrix`, `get_live_first_discoveries`: Ensure strict `event_date.date() < today` filtering.
- [ ] In `backend/app/services/setlist_stats_service.py`:
  - In `get_artists_leaderboard`: Filter `c.event_date.date() < today` so upcoming concerts do not count towards live artist rankings.
- [ ] In `backend/app/services/gig_badges_service.py`:
  - Filter `c.event_date.date() < today` so future concerts cannot award badges before they take place.
- [ ] Add unit tests verifying:
  - Weston Park test scenario: 5 bands logged on the same festival day produces `festivals == 1` and `gig_count == 1`.
  - Upcoming events test: Concerts scheduled for today and future dates are excluded from `venue_royalty`, `pins`, `artists_leaderboard`, and `gigs_by_period`.
- [ ] Run pytest: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_reports_service.py backend/app/tests/test_setlist_stats_service.py backend/app/tests/test_gig_badges_service.py -q`.

---

### Task 4: Frontend Cover Band Option in Logging & Badges in UI

**Files:**
- Modify: `frontend/src/api/setlists.js`
- Modify: `frontend/src/components/setlists/ManualConcertModal.jsx`
- Modify: `frontend/src/components/setlists/EditGigModal.jsx`
- Modify: `frontend/src/components/setlists/SetlistGigPage.jsx`
- Modify: `frontend/src/components/setlists/MyGigsTimeline.jsx`
- Test: `frontend/src/components/setlists/ManualConcertModal.test.jsx` (or create if needed)
- Test: `frontend/src/components/setlists/EditGigModal.test.jsx`
- Test: `frontend/src/components/setlists/SetlistGigPage.test.jsx`

- [ ] In `frontend/src/api/setlists.js`: pass `is_cover_band` in `logManualConcert` and `updateConcert`.
- [ ] In `ManualConcertModal.jsx`: Add checkbox/field for "Cover band / Tribute act (`is_cover_band`)".
- [ ] In `EditGigModal.jsx`: Add checkbox for "Cover band / Tribute act (`is_cover_band`)".
- [ ] In `SetlistGigPage.jsx`: Render `<span className="sfm-tag is-muted">Cover band</span>` when `gig.is_cover_band` is true.
- [ ] In `MyGigsTimeline.jsx`: Display `"Cover"` in row tags when `gig.is_cover_band` is true (if not already "Upcoming").
- [ ] Update frontend component tests to verify toggle state and badge rendering.
- [ ] Run frontend test suite: `cd frontend && npm test`.

---

### Task 5: End-to-End Verification, Linters & Changelog

**Files:**
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`

- [ ] Run full automated backend test suite: `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`.
- [ ] Run Python linters: `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`.
- [ ] Run ShellCheck: `.venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh`.
- [ ] Run frontend linter and build: `cd frontend && npm run lint && npm test && npm run build`.
- [ ] Bump version in `frontend/package.json` and add release entry in `frontend/src/changelogData.js`.
- [ ] Document the cover band toggle and festival date counting in `frontend/src/components/settings/UserGuideSection.jsx`.
