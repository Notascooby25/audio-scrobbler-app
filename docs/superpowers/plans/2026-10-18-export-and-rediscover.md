# Implementation Plan - Data Export & Time Capsule Rediscover

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

This plan implements two high-value features for the Audio Scrobbler application:
1. **Data Sovereignty Export**: A full streaming export of listening history in standard CSV and JSON formats from the Settings Data tab.
2. **Time Capsule & Rediscover**: An interactive section on the Overview page surfacing forgotten favorites and "On This Day" anniversary scrobbles, complete with a 1-click "Save to Spotify Playlist" action.

---

## 1. Impact Analysis
- **Backend Components**:
  - `backend/app/api/imports.py` (or new `backend/app/api/export.py`): Streamed CSV & JSON export endpoint.
  - `backend/app/queries/analytics_queries.py`: `get_forgotten_favorites` and `get_on_this_day_tracks` aggregate queries.
  - `backend/app/api/analytics.py`: `GET /analytics/rediscover` and `POST /analytics/rediscover/playlist`.
- **Frontend Components**:
  - `frontend/src/api.js`: `exportScrobbles`, `fetchRediscoverTracks`, and `createRediscoverPlaylist`.
  - `frontend/src/pages/SettingsPage.jsx`: Export Listening History card in Data tab.
  - `frontend/src/components/RediscoverCard.jsx`: New component with tabbed modes (Forgotten Favorites / On This Day) and playlist export action.
  - `frontend/src/pages/OverviewPage.jsx`: Mount `<RediscoverCard>`.
  - `frontend/src/styles.css`: Flat-by-default styling matching `DESIGN.md`.
- **Database / Models**:
  - Zero database schema migrations needed. All required fields (`track_name`, `artist_name`, `album_name`, `track_id`, `played_at`, `duration_ms`, `source`, `artwork_url`, `user_id`) already exist on `listening_events`.
- **Dependencies & Environment**:
  - No new dependencies. Uses FastAPI `StreamingResponse`, standard library `csv` / `json`, and existing `spotify_playlist_service.py`.

---

## 2. Regression Checklist
- **Spotify Rate-Limiting**: Export does not touch Spotify. Playlist creation only executes on explicit user click and uses cached Spotify credentials.
- **Data Isolation**: All queries and exports strictly filter by `user_id == current_user.id`.
- **Blocked Items**: Rediscover queries strictly apply `not_blocked_clause(user_id)`.
- **Memory Consumption on Large Libraries**: Export uses chunked streaming generators instead of loading hundreds of thousands of rows into memory at once.
- **Cross-Dialect Database Portability**: Date filtering uses standard SQL comparison operators (`>=` and `<=`) tested on SQLite and PostgreSQL.

---

## Step 1 - Backend: Streaming Scrobble Export (`feat(export)`)
- **Description:**
  1. Add streaming export endpoint in `backend/app/api/imports.py`:
     - `GET /export/scrobbles?format={csv|json}`
     - Security: Authenticated with signed JWT (`current_user: User = Depends(get_current_user)`).
     - Streams rows ordered by `played_at DESC`.
     - CSV headers: `played_at,track_name,artist_name,album_name,duration_ms,source`
     - JSON format: Streamed array of scrobble objects.
     - Filename header: `Content-Disposition: attachment; filename="audio-scrobbler-history-YYYY-MM-DD.{csv|json}"`.
  2. Add unit tests in `backend/app/tests/test_export_api.py`.
- **Files:**
  - `backend/app/api/imports.py`
  - `backend/app/tests/test_export_api.py`
- **Tests:**
  - `PYTHONPATH=worker python -m pytest backend/app/tests/test_export_api.py -v`
  - `ruff check backend/app/api/imports.py backend/app/tests/test_export_api.py`
- **Regression risk:** None (read-only export).
- **Deploy impact:** Deploys backend on push to `main`.
- **Commit message:** `"feat(export): add streaming csv and json listening history export (Planner Step 1)"`

---

## Step 2 - Frontend: Export Controls in Settings (`feat(settings)`)
- **Description:**
  1. In `frontend/src/api.js`:
     - Add `exportScrobbles({ token, format })` helper that triggers browser download via Blob URL.
  2. In `frontend/src/pages/SettingsPage.jsx`:
     - In the `data` tab (`activeTab === 'data'`), add an **Export Listening History** card with clean buttons for CSV and JSON downloads.
  3. In `frontend/src/styles.css`:
     - Add export button and card styles following `DESIGN.md`.
  4. Add unit test coverage in `frontend/src/pages/SettingsPage.test.jsx`.
- **Files:**
  - `frontend/src/api.js`
  - `frontend/src/pages/SettingsPage.jsx`
  - `frontend/src/styles.css`
  - `frontend/src/pages/SettingsPage.test.jsx`
- **Tests:**
  - `cd frontend && npm test -- src/pages/SettingsPage.test.jsx && npm run lint`
- **Regression risk:** Low.
- **Deploy impact:** Frontend rebuild.
- **Commit message:** `"feat(settings): add export history download controls to data settings (Planner Step 2)"`

---

## Step 3 - Backend: Rediscover & Time Capsule Queries & API (`feat(analytics)`)
- **Description:**
  1. In `backend/app/queries/analytics_queries.py`:
     - Add `get_forgotten_favorites(db, user_id, limit=15, days_unplayed=90, min_plays=3)`: Group by `track_name, artist_name`, filter `not_blocked_clause(user_id)`, `HAVING count >= 3 AND max(played_at) < now - 90 days`, order by `count DESC`.
     - Add `get_on_this_day_tracks(db, user_id, limit=15)`: Query past calendar years around today's date ($\pm 3$ days), filter `not_blocked_clause(user_id)`.
  2. In `backend/app/api/analytics.py`:
     - Add `GET /analytics/rediscover?mode={forgotten|anniversary}`.
     - Add `POST /analytics/rediscover/playlist` which calls `create_playlist()` from `backend/app/services/spotify_playlist_service.py` to create a Spotify playlist.
  3. Add tests in `backend/app/tests/test_rediscover_api.py`.
- **Files:**
  - `backend/app/queries/analytics_queries.py`
  - `backend/app/api/analytics.py`
  - `backend/app/tests/test_rediscover_api.py`
- **Tests:**
  - `PYTHONPATH=worker python -m pytest backend/app/tests/test_rediscover_api.py -v`
  - `ruff check backend/app/queries/analytics_queries.py backend/app/api/analytics.py`
- **Regression risk:** Low (read-only query + explicit user-initiated playlist creation).
- **Deploy impact:** Deploys backend.
- **Commit message:** `"feat(analytics): add rediscover time capsule queries and playlist export (Planner Step 3)"`

---

## Step 4 - Frontend: RediscoverCard Component on Overview (`feat(overview)`)
- **Description:**
  1. Create `frontend/src/components/RediscoverCard.jsx`:
     - Mode switcher: **Forgotten Favorites** (tracks you used to play but haven't heard in 90+ days) and **On This Day** (tracks from 1+ years ago).
     - Renders track items with cover art, artist, track name, and context badge (*"12 plays · Last played Oct 2025"*).
     - **Save to Spotify** button: Triggers playlist creation and displays a direct link to the newly created playlist.
     - Handles empty and loading states cleanly.
  2. In `frontend/src/pages/OverviewPage.jsx`:
     - Mount `<RediscoverCard token={session.accessToken} />` between the stats bar and the date charts.
  3. Add styles to `frontend/src/styles.css` (Flat-by-default, hairline borders, responsive mobile layout).
  4. Unit test: `frontend/src/components/RediscoverCard.test.jsx`.
- **Files:**
  - `frontend/src/components/RediscoverCard.jsx`
  - `frontend/src/pages/OverviewPage.jsx`
  - `frontend/src/styles.css`
  - `frontend/src/components/RediscoverCard.test.jsx`
- **Tests:**
  - `cd frontend && npm test -- src/components/RediscoverCard.test.jsx src/pages/OverviewPage.test.jsx && npm run lint`
- **Regression risk:** Low.
- **Deploy impact:** Frontend rebuild.
- **Commit message:** `"feat(overview): add rediscover time capsule card with spotify playlist export (Planner Step 4)"`

---

## Step 5 - Version Bump (`0.12.0`), Docs & Full Verification (`docs`)
- **Description:**
  1. Bump version to `0.12.0` in `frontend/package.json` (minor bump for two major user-facing features).
  2. Add `0.12.0` entry in `frontend/src/changelogData.js`.
  3. Bump service worker shell cache to `audio-scrobbler-shell-v12` in `frontend/public/service-worker.js`.
  4. Update `agents/page_specs.md` and `HANDOVER.md`.
  5. Run complete verification:
     - `cd frontend && npm run lint && npm test && npm run build`
     - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
     - `ruff check backend/app worker scripts`
- **Files:**
  - `frontend/package.json`
  - `frontend/src/changelogData.js`
  - `frontend/public/service-worker.js`
  - `agents/page_specs.md`
  - `HANDOVER.md`
- **Tests:**
  - Full test suite passes.
- **Commit message:** `"docs: bump version to 0.12.0 and update documentation for export and rediscover features (Planner Step 5)"`

---

## 3. Post-Deploy Verification Plan
1. **Automated Verification**:
   - `npm run lint && npm test && npm run build` (0 errors)
   - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q` (0 errors)
   - `ruff check backend/app worker scripts` (0 errors)
2. **Manual Smoke Check (Settings & Overview)**:
   - Navigate to `/settings?tab=data` and click **Export as CSV** -> Verify browser downloads `audio-scrobbler-history-YYYY-MM-DD.csv`.
   - Navigate to `/overview` -> Verify **Time Capsule & Rediscover** displays old favorites and anniversary tracks with the "Save to Spotify" action.
