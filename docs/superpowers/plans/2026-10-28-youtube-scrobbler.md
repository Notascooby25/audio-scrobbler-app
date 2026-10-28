# YouTube Music & Concert Scrobbler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to follow YouTube music channels (e.g. NPR Music, KEXP, BBC Music), browse recent uploads or search concert sessions, extract tracklists (from descriptions, timestamps, and titles), edit/review setlists, and scrobble tracks to their listening history (with optional Spotify playlist export).

**Architecture:** Backend service (`youtube_service.py`) handles channel resolution, public RSS feed parsing for recent uploads, search parsing, and setlist parsing with iTunes/Deezer artwork fallback. REST API endpoints in `tools.py` support followed channels and video fetching. A new SQLAlchemy model `FollowedYouTubeChannel` with Alembic migration stores channels per user. The React frontend provides a responsive `YouTubeScrobblerTools.jsx` integrated into Settings > Scrobble alongside BBC Sounds.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, React 18, Vite, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-10-28-youtube-scrobbler-design.md`

## Global Constraints

- **Python Standards:** PEP 8 and PEP 484 type hints (`from __future__ import annotations`), module-level imports (enforcing `PLC0415`), SQLAlchemy 2.0 typed models (`Mapped`, `mapped_column`), Pydantic v2 schemas.
- **Frontend Standards:** React 18 functional components, standard ES Modules, strict adherence to `DESIGN.md` (no box-shadows, no gradients, 0.5px hairline borders, `#0066FF` accent).
- **Rate-limit & Security:** Never call the Spotify API inline during video fetch or scrobble requests; perform Spotify search only on-demand during explicit playlist export.
- **Deduplication Invariant:** Enforce `play_id` uniqueness while allowing repeat concert listens across different sessions: `play_id = f"yt_{video_id}_{index}_{int(played_at.timestamp())}"`.
- **Database Migrations:** Every schema addition must include an Alembic migration tested against PostgreSQL.

## Review Focus

1. **YouTube Consent & Geo-Redirects:** YouTube watch/channel pages in the UK/EU issue HTTP 302 redirects to `consent.youtube.com`. Ensure all outbound requests carry the `SOCS` consent cookie and user-agent headers.
2. **Idiosyncratic Setlist Formatting:** YouTube video descriptions vary widely (curly quotes, `SET LIST` headers, `00:00 - Title`, or single-song videos). The parser must handle timestamped lists, headered lists, and single-song fallbacks gracefully, with frontend inline editing as a safeguard.
3. **Missing or Incomplete Durations:** Videos with timestamped tracks might omit the last track's end time. Ensure duration is computed by taking the difference to the next timestamp, or falling back to total video length.
4. **Spotify Auth Absence:** Users who only scrobble or do not have a Spotify account must not encounter errors during fetch or scrobble.
5. **Re-scrobbling Collision:** Re-scrobbling a concert watched on different dates must succeed without database `IntegrityError` collisions.

---

### Task 1: Data Model and Alembic Migration for Followed Channels

**Files:**
- Create: `backend/migrations/versions/0019_add_followed_youtube_channels.py`
- Modify: `backend/app/models.py`
- Test: `backend/app/tests/test_youtube_models.py`

**Interfaces:**
- Consumes: `backend/app/db/base.py`, `User` model.
- Produces: `FollowedYouTubeChannel` model (`id`, `user_id`, `channel_id`, `channel_handle`, `title`, `image_url`, `created_at`, unique `(user_id, channel_id)`).

- [ ] **Step 1: Write failing model and migration test**
  Create `backend/app/tests/test_youtube_models.py` asserting `FollowedYouTubeChannel` can be created, persisted, and queried by `user_id`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_youtube_models.py -q`
  Expected: FAIL (`ImportError: cannot import name 'FollowedYouTubeChannel'`).

- [ ] **Step 3: Implement `FollowedYouTubeChannel` model and migration**
  Add `FollowedYouTubeChannel` in `backend/app/models.py` and create `backend/migrations/versions/0019_add_followed_youtube_channels.py` with `down_revision = '669e05e5205e'`.

- [ ] **Step 4: Run test and migration to verify they pass**
  Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_youtube_models.py -q`
  Expected: PASS.
  Run: `ruff check backend/app worker scripts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add backend/app/models.py backend/migrations/versions/0019_add_followed_youtube_channels.py backend/app/tests/test_youtube_models.py
  git commit -m "feat(db): add followed_youtube_channels table and migration (Planner Step 1)"
  ```

---

### Task 2: YouTube Extraction & Service Engine

**Files:**
- Create: `backend/app/services/youtube_service.py`
- Test: `backend/app/tests/test_youtube_service.py`

**Interfaces:**
- Consumes: `ArtworkCache`, `requests` / `httpx`, `resolve_artwork` from `backend/app/api/tools.py`.
- Produces:
  - `resolve_channel_info(url_or_handle: str) -> dict`
  - `get_channel_recent_videos(channel_id: str) -> list[dict]`
  - `search_youtube_videos(query: str, channel_title: str | None = None) -> list[dict]`
  - `extract_youtube_tracklist(video_url_or_id: str) -> dict`

- [ ] **Step 1: Write failing service unit tests**
  Create `backend/app/tests/test_youtube_service.py` testing timestamp parsing, setlist block parsing, video ID extraction from diverse URL formats (`watch?v=`, `youtu.be/`, `/shorts/`), and single-track fallback.

- [ ] **Step 2: Run test to verify it fails**
  Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_youtube_service.py -q`
  Expected: FAIL (`ModuleNotFoundError: No module named 'backend.app.services.youtube_service'`).

- [ ] **Step 3: Implement `backend/app/services/youtube_service.py`**
  Implement channel resolution, RSS recent video parser, search parser, and description/setlist regex engine with fallback heuristics and artwork lookups.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_youtube_service.py -q`
  Expected: PASS.
  Run: `ruff check backend/app worker scripts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add backend/app/services/youtube_service.py backend/app/tests/test_youtube_service.py
  git commit -m "feat(tools): implement YouTube metadata and tracklist extraction service (Planner Step 2)"
  ```

---

### Task 3: Backend API Endpoints for YouTube Tools

**Files:**
- Modify: `backend/app/api/tools.py`
- Test: `backend/app/tests/test_youtube_tools_api.py`

**Interfaces:**
- Consumes: `youtube_service.py`, `ingest_listening_event`, `FollowedYouTubeChannel`, `current_user`.
- Produces:
  - `GET /tools/youtube/followed-channels`
  - `POST /tools/youtube/followed-channels`
  - `DELETE /tools/youtube/followed-channels/{channel_id}`
  - `GET /tools/youtube/followed-channels/{channel_id}/videos`
  - `GET /tools/youtube/search`
  - `POST /tools/youtube/fetch`
  - `POST /tools/youtube/scrobble`

- [ ] **Step 1: Write failing API endpoint tests**
  Create `backend/app/tests/test_youtube_tools_api.py` with mock YouTube responses verifying following/unfollowing, fetching videos, and scrobbling with `source="youtube"` and unique `play_id`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_youtube_tools_api.py -q`
  Expected: FAIL (`404 Not Found`).

- [ ] **Step 3: Implement API endpoints in `backend/app/api/tools.py`**
  Add endpoints and Pydantic schemas for YouTube channel management, search, fetch, and scrobble.

- [ ] **Step 4: Run test to verify it passes**
  Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_youtube_tools_api.py -q`
  Expected: PASS.
  Run: `ruff check backend/app worker scripts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add backend/app/api/tools.py backend/app/tests/test_youtube_tools_api.py
  git commit -m "feat(api): add YouTube followed channels, search, and scrobble endpoints (Planner Step 3)"
  ```

---

### Task 4: Frontend YouTube Scrobbler Component

**Files:**
- Create: `frontend/src/components/YouTubeScrobblerTools.jsx`
- Create: `frontend/src/components/YouTubeScrobblerTools.test.jsx`
- Modify: `frontend/src/pages/SettingsPage.jsx`
- Modify: `frontend/src/components/ScopeCreepTools.jsx` (or wrap into segmented tabs)

**Interfaces:**
- Consumes: Backend `/tools/youtube/*` endpoints, `readSession()`, `DESIGN.md` styling tokens.
- Produces: Accessible interactive React component with channel pills, recent videos picker, search bar, editable track table, played-at picker, and scrobble/export actions.

- [ ] **Step 1: Write failing component tests**
  Create `frontend/src/components/YouTubeScrobblerTools.test.jsx` testing rendering, channel following, video search/fetch, track selection, inline title editing, and scrobble submission.

- [ ] **Step 2: Run frontend test to verify it fails**
  Run: `cd frontend && npm test -- src/components/YouTubeScrobblerTools.test.jsx`
  Expected: FAIL.

- [ ] **Step 3: Implement `YouTubeScrobblerTools.jsx` and mount in `SettingsPage.jsx`**
  Create `YouTubeScrobblerTools.jsx` following `DESIGN.md`. In `SettingsPage.jsx`, add a clean segmented control (`Radio / BBC Sounds` | `YouTube Videos`) under the Scrobble settings tab so users can seamlessly toggle between BBC Sounds and YouTube.

- [ ] **Step 4: Run frontend tests, linter, and build**
  Run: `cd frontend && npm run lint && npm test && npm run build`
  Expected: PASS with 0 lint errors and successful production build.

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/components/YouTubeScrobblerTools.jsx frontend/src/components/YouTubeScrobblerTools.test.jsx frontend/src/pages/SettingsPage.jsx
  git commit -m "feat(ui): add YouTube concert and channel scrobbler interface (Planner Step 4)"
  ```

---

### Task 5: User Guide, FAQ, Changelog, and Package Version Bump

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`
- Modify: `frontend/src/components/settings/FaqSection.jsx`
- Modify: `docs/RUNBOOK.md`

- [ ] **Step 1: Bump version and add changelog entry**
  Bump version in `frontend/package.json` (e.g. to `v0.13.0`). Add top entry in `frontend/src/changelogData.js` detailing the new YouTube Music & Concert Scrobbler tool.

- [ ] **Step 2: Update User Guide and FAQ**
  Add guide instructions and FAQ entries explaining how to follow YouTube channels (NPR Music, KEXP, BBC Music), extract setlists from live performances, edit tracks, and scrobble them.

- [ ] **Step 3: Run full verification suite**
  Run:
  ```bash
  ruff check backend/app worker scripts
  ruff format --check backend/app worker scripts
  PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
  cd frontend && npm run lint && npm test && npm run build
  ```
  Expected: All checks passing clean.

- [ ] **Step 4: Commit and Push**
  ```bash
  git add frontend/package.json frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx frontend/src/components/settings/FaqSection.jsx docs/RUNBOOK.md
  git commit -m "docs(changelog): document YouTube concert scrobbler and bump version to v0.13.0 (Planner Step 5)"
  ```

---

## Post-Deploy Verification

1. **Followed Channels Test:** Under Settings > Scrobble > YouTube Videos, add `@nprmusic` and `@kexp`. Verify channel avatars and titles load correctly.
2. **Channel Recent Videos / Search Test:** Select NPR Music and verify recent Tiny Desk concert uploads appear in the dropdown. Search for "Dua Lipa".
3. **Setlist Extraction Test:** Click to load the concert. Verify the 4 tracks are extracted with accurate titles, artists, and durations.
4. **Scrobble Verification:** Select all tracks, click "Scrobble 4 Tracks", and verify that 4 new scrobbles appear immediately in Library and Overview with `source="youtube"`.
5. **Spotify Playlist Export Test:** Click "Export to Spotify Playlist" to verify tracks can be saved to a user's Spotify account.
