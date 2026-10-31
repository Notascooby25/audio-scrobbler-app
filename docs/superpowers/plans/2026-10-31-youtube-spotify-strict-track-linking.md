# Strict 100% YouTube-to-Spotify Track Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link YouTube Music tracks to their Spotify Track IDs using strict 100% exact `(track_name, artist_name)` matching—both automatically from the user's synced `liked_tracks` table (covering 542 existing tracks immediately) and on-demand via Spotify `/v1/search` when tapping a heart on any YouTube-only track—while preserving accurate YouTube play history and source badges.

**Architecture:**
1. Expand `_resolve_spotify_track_ids_by_name()` in `backend/app/services/analytics_service.py` to resolve missing `spotify_track_id` values from both `ListeningEvent` (`spotify` / `spotify_realtime`) and `LikedTrack` (`liked_tracks`) using strict normalized `(track_name.strip().lower(), artist_name.strip().lower())` matching.
2. Enhance `toggle_like_track()` in `backend/app/services/spotify_library_service.py` (and `LikeTrackResponse` in `backend/app/schemas/spotify_library.py`) so that when a track has no `spotify_track_id` yet (`track_id == "__resolve__"`), it checks local DB tables first and then queries `GET https://api.spotify.com/v1/search?type=track`, accepting a result **only** if both normalized `track_name` and `artist_name` match 100% character-for-character, then saves and returns `spotify_track_id`.
3. Update `HomePage.jsx`, `LibraryPage.jsx`, and `OverviewPage.jsx` so tapping the heart on a track without a `spotify_track_id` sends `trackId: "__resolve__"` with `{ track_name, artist_name, album_name, artwork_url }` instead of blocking with `"Only able to like tracks played through Spotify"`, and stores the returned `spotify_track_id` in state.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, React 18, Vitest, Pytest.

**Spec:** Inline in this plan (`docs/superpowers/plans/2026-10-31-youtube-spotify-strict-track-linking.md`).

## Global Constraints

- Strict 100% exact matching only: `track_name.strip().lower()` and `artist_name.strip().lower()` must match character-for-character (either against a primary/listed artist on the Spotify track or the full comma-joined artist string). Never accept partial/substring/remix/live matches unless the title itself matches 100%.
- Preserve YouTube play history and source badges (`source = 'youtube'`) in `listening_events`.
- Never call the Spotify API in bulk during an HTTP page-load request; page loads only query the local PostgreSQL `listening_events` and `liked_tracks` tables, while Spotify `/v1/search` is called only once on-demand when the user clicks the heart button on an unlinked track.

## Review Focus

- A YouTube-only track whose song is not on Spotify or has a YouTube-specific video title (e.g., `"Song Name (Official Music Video)"`) must fail strict 100% matching with HTTP 404 (`"No 100% exact track and artist match found on Spotify"`) and revert the optimistic heart cleanly without liking the wrong song.
- A track with leading/trailing whitespace or different casing between YouTube (`"  Getting Started "`, `"SAM FENDER"`) and Spotify (`"Getting Started"`, `"Sam Fender"`) must still match 100% after `.strip().lower()`.
- Malformed track IDs passed directly to `PUT /spotify/like-track/bad_id&extra=1` (when not `"__resolve__"`) must still return HTTP 400 (`"Invalid Spotify track ID"`).
- Once a YouTube-only track is liked via `"__resolve__"`, the frontend state must update `spotify_track_id` on matching rows so immediately clicking the heart a second time unlikes it cleanly using the resolved Spotify track ID.
- Multi-artist Spotify tracks where Spotify lists `artists: [{"name": "Artist A"}, {"name": "Artist B"}]` must match if the scrobble's `artist_name` matches the primary artist (`artists[0]["name"]`) or the comma-joined artist string (`"Artist A, Artist B"`).

---

### Task 1: Resolve `spotify_track_id` from `LikedTrack` in `analytics_service.py`

**Files:**
- Modify: `backend/app/services/analytics_service.py:67-112`
- Test: `backend/app/tests/test_library_entities_liked.py`

**Interfaces:**
- Produces: `_resolve_spotify_track_ids_by_name(db: Session, user_id: int, rows) -> dict[tuple[str, str], str]` using `(track_name.strip().lower(), artist_name.strip().lower())` keys from both `ListeningEvent` (`spotify`, `spotify_realtime`) and `LikedTrack`.

- [ ] **Step 1: Write the failing test in `backend/app/tests/test_library_entities_liked.py`**
  Add `test_youtube_only_track_resolves_spotify_track_id_and_is_liked_from_liked_tracks()` verifying that a track with only `source="youtube"` in `ListeningEvent` (`track_id="yt-uuid-123"`) and a matching `(track_name, artist_name)` row in `LikedTrack` (`spotify_track_id="6rqhFgbbKwnb9MLmUQDhG6"`) returns `spotify_track_id == "6rqhFgbbKwnb9MLmUQDhG6"` and `is_liked is True` in `get_library_entities`, `get_user_charts`, `get_library_scrobbles`, and `get_recent_scrobbles`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests/test_library_entities_liked.py -q`
  Expected: FAIL (`assert None == "6rqhFgbbKwnb9MLmUQDhG6"`).

- [ ] **Step 3: Update `_resolve_spotify_track_ids_by_name` and `_effective_spotify_track_id` in `backend/app/services/analytics_service.py`**
  Normalize keys with `.strip().lower()` and query `LikedTrack` (`user_id == user_id`, `func.lower(func.trim(LikedTrack.track_name)).in_(missing_names)`) in addition to `ListeningEvent`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests/test_library_entities_liked.py -q`
  Expected: PASS.

---

### Task 2: Add On-Demand Strict 100% Exact Spotify Track Resolution to `toggle_like_track`

**Files:**
- Modify: `backend/app/schemas/spotify_library.py:93-96`
- Modify: `backend/app/api/spotify_library.py:45-64`
- Modify: `backend/app/services/spotify_library_service.py:263-310`
- Test: `backend/app/tests/test_spotify_library_likes.py`

**Interfaces:**
- Modifies `LikeTrackResponse` to include `spotify_track_id: str | None = None`.
- Modifies `toggle_like_track(db: Session, user: User, track_id: str, payload: LikeTrackPayload | None = None, like: bool = True) -> tuple[bool, str]` to resolve `track_id == "__resolve__"` via local DB (`LikedTrack`, `ListeningEvent`) or Spotify `/v1/search?type=track` with strict 100% exact `(track_name, artist_name)` matching.

- [ ] **Step 1: Write failing tests in `backend/app/tests/test_spotify_library_likes.py`**
  Add:
  - `test_like_track_resolve_exact_match_on_spotify(mock_user)`: sends `PUT /spotify/like-track/__resolve__` with `{"track_name": "Hypersonic Missiles", "artist_name": "Sam Fender"}`, mocks `requests.get` returning a partial/live track first and the exact match second, asserts the exact match ID `6rqhFgbbKwnb9MLmUQDhG6` is chosen, saved to `LikedTrack`, and returned as `spotify_track_id`.
  - `test_like_track_resolve_rejects_non_exact_match(mock_user)`: sends `PUT /spotify/like-track/__resolve__` with `{"track_name": "Hypersonic Missiles", "artist_name": "Sam Fender"}` when Spotify only returns `"Hypersonic Missiles - Live"` or a different artist, asserts HTTP 404 (`"No 100% exact track and artist match found on Spotify"`).

- [ ] **Step 2: Run tests to verify they fail**
  Run: `PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests/test_spotify_library_likes.py -q`
  Expected: FAIL.

- [ ] **Step 3: Implement strict 100% exact resolution in `spotify_library_service.py`, `spotify_library.py`, and `schemas/spotify_library.py`**
  - Add `_resolve_exact_spotify_track(db: Session, user: User, payload: LikeTrackPayload | None) -> tuple[str, str | None, str | None]` in `backend/app/services/spotify_library_service.py`.
  - Return `(is_liked, clean_id)` from `toggle_like_track` and populate `spotify_track_id` on `LikeTrackResponse`.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests/test_spotify_library_likes.py -q`
  Expected: PASS.

---

### Task 3: Allow Liking Unlinked Tracks in `HomePage.jsx`, `LibraryPage.jsx`, and `OverviewPage.jsx`

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx:206-268`
- Modify: `frontend/src/pages/LibraryPage.jsx:216-339`
- Modify: `frontend/src/pages/OverviewPage.jsx:38-135`
- Modify: `frontend/package.json`
- Modify: `frontend/src/changelogData.js`

- [ ] **Step 1: Update `handleToggleLike` in `HomePage.jsx`, `LibraryPage.jsx`, and `OverviewPage.jsx`**
  - When liking a track without `spotify_track_id`, pass `trackId: item.spotify_track_id || "__resolve__"` to `likeTrack` instead of returning early with `"Only able to like tracks played through Spotify"`.
  - When `likeTrack` returns `res?.spotify_track_id`, update matching entries/scrobbles in component state with `spotify_track_id: res.spotify_track_id`.

- [ ] **Step 2: Bump version to `0.30.4` in `frontend/package.json` and add changelog entry in `frontend/src/changelogData.js`**

- [ ] **Step 3: Run all linters, tests, and production build**
  Run:
  - `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`
  - `PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests worker/tests -q`
  - `cd frontend && npm run lint && npm test && npm run build`
