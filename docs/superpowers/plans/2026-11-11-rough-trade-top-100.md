# Rough Trade Top 100 Jukebox Addition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Rough Trade Top 100" as a third jukebox source alongside "My Library" and "1001 Albums", supporting lucky dip generation with optional year filter (2020-2026), played album exclusion, 85% scrobble auto-completion tracking (also applied to 1001 Albums), and a dedicated checklist modal.

**Architecture:** 
A canonical JSON dataset of 700 albums (`backend/app/data/rough_trade_albums.json`, 100 per year from 2020 to 2026) is served and persisted with user completion records via SQLAlchemy (`UserRoughTradeAlbumCompletion`). The backend service inspects user scrobbles against each album's track count, auto-marking completions when >= 85% is played. The frontend expands `JukeboxCard`, `useJukeboxEngine`, `JukeboxFilters`, and both `FlatJukebox` and `RetroJukebox` to handle the new source and year filters, while adding `RoughTradeChecklistModal`.

**Tech Stack:** Python 3.12 (FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2), React 18, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-11-11-rough-trade-top-100-design.md`

## Global Constraints
- PEP 8 and PEP 484 type hints (`from __future__ import annotations`).
- Do not mention the 85% threshold change in `frontend/src/changelogData.js` or user-facing release notes.
- In `RetroJukebox`, preserve the skeuomorphic arcade aesthetics (cabinet styling, pastels, turntable).
- No new third-party dependencies.
- Zero raw SQL; use parameterized SQLAlchemy queries.

## Review Focus
1. Threshold calculation: exact 85% integer division safety (`len(played_tracks) / track_count >= 0.85`), with non-zero default `track_count`.
2. Safe year filtering in `useJukeboxEngine`: selecting a year filters candidates without breaking overall count when returning to "All Years".
3. Checklist modal keyboard and scroll accessibility: escape key dismisses modal; responsive grid/list view across breakpoints.
4. Database migration rollback and idempotent completion toggles.
5. Pending confirmation safety: ensure pending confirmations on Spotify open apply properly to Rough Trade items if triggered.

---

### Task 1: Dataset Compilation (2020-2026)

**Files:**
- Create: `backend/app/data/rough_trade_albums.json`
- Test: `backend/app/tests/test_rough_trade_data.py`

**Interfaces:**
- Produces: `get_canonical_rough_trade_albums() -> list[dict[str, Any]]`
  - Each item: `{ "id": int, "year": int, "rank": int, "artist_name": str, "album_name": str, "track_count": int, "spotify_url": str }`

- [ ] **Step 1: Write data validation test in `backend/app/tests/test_rough_trade_data.py`**
  Assert that exactly 700 albums exist (100 per year from 2020 through 2026), all IDs are 1-based unique integers from 1 to 700, and every entry has valid `artist_name`, `album_name`, `year`, and `rank`.
- [ ] **Step 2: Run test to verify it fails**
  `pytest backend/app/tests/test_rough_trade_data.py -v` (fails: file not found)
- [ ] **Step 3: Compile and write `backend/app/data/rough_trade_albums.json`**
  Extract and format all 700 albums:
  - 2020: from PDF (1-100)
  - 2021: from `RTR100/2021/` screenshots + PDF
  - 2022: from `RTR100/2022/` screenshots + PDF
  - 2023: from `RTR100/2023/` screenshots + PDF
  - 2024: from Spotify 100-track embed
  - 2025: from PDF (1-100)
  - 2026: from user prompt (1-100)
- [ ] **Step 4: Run test to verify it passes**
  `pytest backend/app/tests/test_rough_trade_data.py -v`
- [ ] **Step 5: Commit**
  `git add backend/app/data/rough_trade_albums.json backend/app/tests/test_rough_trade_data.py && git commit -m "feat(data): add canonical 700 rough trade albums dataset (2020-2026)"`

---

### Task 2: Backend Models & Alembic Migration

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/migrations/versions/0034_add_rough_trade_albums_table.py`
- Test: `backend/app/tests/test_rough_trade_models.py`

**Interfaces:**
- Models: `UserRoughTradeAlbumCompletion(user_id, album_id, is_completed, source, completed_at)`

- [ ] **Step 1: Write test for `UserRoughTradeAlbumCompletion` model**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Define model in `backend/app/models.py` and create Alembic migration**
- [ ] **Step 4: Run test to verify passes**
- [ ] **Step 5: Commit**
  `git add backend/app/models.py backend/migrations/versions/* backend/app/tests/test_rough_trade_models.py && git commit -m "feat(db): add user rough trade album completions model and migration"`

---

### Task 3: Backend Services & 85% Scrobble Completion

**Files:**
- Modify: `backend/app/services/catalog_1001_service.py` (adjust threshold to 0.85)
- Create: `backend/app/services/catalog_rough_trade_service.py`
- Test: `backend/app/tests/test_catalog_rough_trade_service.py`
- Test: `backend/app/tests/test_catalog_1001_service.py`

**Interfaces:**
- `get_user_rough_trade_catalog(db: Session, user_id: int) -> dict[str, Any]`
- `toggle_user_rough_trade_album_completion(db: Session, user_id: int, album_id: int, is_completed: bool, source: str) -> dict[str, Any]`

- [ ] **Step 1: Write unit tests for 85% threshold in 1001 and Rough Trade services**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Update `catalog_1001_service.py` threshold to 0.85 and implement `catalog_rough_trade_service.py`**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**
  `git add backend/app/services/ backend/app/tests/ && git commit -m "feat(services): implement rough trade catalog service and 85pct completion check"`

---

### Task 4: Backend API Router

**Files:**
- Create: `backend/app/api/jukebox_rough_trade.py`
- Modify: `backend/app/main.py`
- Test: `backend/app/tests/test_jukebox_rough_trade_api.py`

**Interfaces:**
- `GET /jukebox/rough-trade-albums`
- `POST /jukebox/rough-trade-albums/{album_id}/toggle-completed`

- [ ] **Step 1: Write API tests covering catalog fetch, stats, and toggle**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement router and mount in `backend/app/main.py`**
- [ ] **Step 4: Run tests to verify pass**
- [ ] **Step 5: Commit**
  `git add backend/app/api/ backend/app/main.py backend/app/tests/ && git commit -m "feat(api): add jukebox rough trade endpoints"`

---

### Task 5: Frontend API Client & Engine Updates

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/components/jukebox/useJukeboxEngine.js`
- Test: `frontend/src/components/jukebox/useJukeboxEngine.test.js`

**Interfaces:**
- `fetchRoughTradeAlbums({ token })`
- `toggleRoughTradeAlbumCompleted({ token, albumId, isCompleted, source })`
- `useJukeboxEngine`: support `sourceMode = "rough_trade"` and year filtering (`filters.year`).

- [ ] **Step 1: Write test for `useJukeboxEngine` with year filtering and "rough_trade" source mode**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement API helpers and engine extensions**
- [ ] **Step 4: Run test to verify pass**
- [ ] **Step 5: Commit**
  `git add frontend/src/api.js frontend/src/components/jukebox/useJukeboxEngine.js frontend/src/components/jukebox/useJukeboxEngine.test.js && git commit -m "feat(frontend): add rough trade api bindings and jukebox engine year filtering"`

---

### Task 6: Checklist Modal Component

**Files:**
- Create: `frontend/src/components/jukebox/RoughTradeChecklistModal.jsx`
- Test: `frontend/src/components/jukebox/RoughTradeChecklistModal.test.jsx`

**Interfaces:**
- Props: `isOpen, onClose, albums, completedCount, totalCount, onToggleCompleted`

- [ ] **Step 1: Write component tests for year switching, search, and toggle**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `RoughTradeChecklistModal.jsx`**
- [ ] **Step 4: Run test to verify pass**
- [ ] **Step 5: Commit**
  `git add frontend/src/components/jukebox/RoughTradeChecklistModal.* && git commit -m "feat(frontend): create rough trade checklist modal with year tabs"`

---

### Task 7: Jukebox UI Integration (Flat & Retro Arcade)

**Files:**
- Modify: `frontend/src/components/jukebox/JukeboxFilters.jsx`
- Modify: `frontend/src/components/jukebox/FlatJukebox.jsx`
- Modify: `frontend/src/components/jukebox/RetroJukebox.jsx`
- Modify: `frontend/src/components/jukebox/JukeboxCard.jsx`
- Test: `frontend/src/components/jukebox/JukeboxCard.test.jsx`
- Test: `frontend/src/components/jukebox/RetroJukebox.test.jsx`

- [ ] **Step 1: Update JukeboxCard and RetroJukebox tests for 3-source tab bar and Rough Trade roll**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement 3-way source tab bar, year selector chips in filters, and integrate modal**
- [ ] **Step 4: Run all frontend tests and linter**
  `cd frontend && npm run lint && npm test`
- [ ] **Step 5: Commit**
  `git add frontend/src/components/jukebox/ && git commit -m "feat(jukebox): integrate rough trade top 100 in flat and retro arcade views"`

---

### Task 8: Full Verification & E2E Validation

- [ ] **Step 1: Run Python lint and format checks:**
  `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`
- [ ] **Step 2: Run all backend and worker tests:**
  `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
- [ ] **Step 3: Run frontend unit tests and production build:**
  `cd frontend && npm run lint && npm test && npm run build`
- [ ] **Step 4: Run E2E tests:**
  `cd frontend && npm run test:e2e`
