# Two-Way Spotify Likes (Tracks & Albums) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement interactive two-way like/unlike synchronization with Spotify for both tracks and albums across the Library page, Overview page, Connect page, and Album Jukebox.

**Architecture:** Add `user-library-modify` to Spotify OAuth scopes. Create backend routes to save/remove tracks and albums on Spotify Web API and immediately update local `liked_tracks` and `saved_albums` cache tables. Enhance `analytics_service.py` to support `is_liked` and Spotify album IDs for albums. Upgrade `LikedHeart.jsx` to an interactive, accessible button with optimistic UI, error rollback, and non-Spotify fallback notices. Wire interactive hearts into Library (Tracks, Scrobbles, Albums), Overview Top Tracks, Connect Recent Scrobbles, and Flat Album Jukebox.

**Tech Stack:** Python 3.12 (FastAPI, SQLAlchemy 2.0, Pydantic v2), React 18, Vitest, `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-10-31-two-way-spotify-likes-design.md`

## Global Constraints

- Never reformat unrelated code; follow existing PEP 8 and ESLint/Prettier styles.
- Strictly adhere to `DESIGN.md`: Flat-By-Default, zero box-shadows, zero gradients, standard color tokens.
- Protected component: `frontend/src/components/jukebox/RetroJukebox.jsx` and `RetroJukebox.module.css` are protected from restyling.
- Handle Spotify API errors gracefully (respect HTTP 429 Retry-After, handle 403 scope errors with reconnect prompt).
- Gated by `isOwnLibrary`: When browsing another user's profile, hearts remain read-only badges showing that user's likes.
- Version bump: Increment minor version to `0.30.0` in `frontend/package.json` and document in `frontend/src/changelogData.js`, `UserGuideSection.jsx`, and `FaqSection.jsx`.

## Review Focus

1. **Missing OAuth scope (HTTP 403):** If a user's Spotify token lacks `user-library-modify`, the backend returns `detail: "needs_spotify_reconnect"` and the UI shows a friendly notice to reconnect Spotify in Settings.
2. **Non-Spotify items:** When an item has no Spotify ID (e.g. YouTube or BBC Sounds import), clicking the heart does not call Spotify or fail silently; it shows *"Only able to like tracks/albums played through Spotify"*.
3. **Optimistic rollback:** If Spotify or the backend returns an error, the heart state reverts immediately to its previous state with an error toast.
4. **Foreign profile safety:** In followed users' libraries, clicking hearts is disabled to prevent accidental modifications to the viewer's Spotify library.
5. **Local cache integrity:** Successful likes/unlikes immediately update `liked_tracks` and `saved_albums` so the state persists across page reloads without waiting for background worker sync cycles.

---

### Task 1: Spotify OAuth Scope and Backend Like/Unlike Endpoints

**Files:**
- Modify: `backend/app/config.py:30-33`
- Modify: `.env.example:22-26`
- Modify: `backend/app/schemas/spotify_library.py:1-85`
- Modify: `backend/app/services/spotify_library_service.py:1-170`
- Modify: `backend/app/api/spotify_library.py:1-75`
- Test: `backend/app/tests/test_spotify_library_likes.py`

**Interfaces:**
- Consumes: `_refresh_access_token`, `User`, `LikedTrack`, `SavedAlbum`, `db.query`
- Produces:
  - `PUT /spotify/like-track/{track_id}` -> `LikeTrackResponse(success=True, is_liked=True)`
  - `DELETE /spotify/like-track/{track_id}` -> `LikeTrackResponse(success=True, is_liked=False)`
  - `PUT /spotify/like-album/{album_id_or_name}` -> `LikeAlbumResponse(success=True, is_liked=True, spotify_album_id=str)`
  - `DELETE /spotify/like-album/{album_id}` -> `LikeAlbumResponse(success=True, is_liked=False)`

- [ ] **Step 1: Write failing tests in `backend/app/tests/test_spotify_library_likes.py`**

Test happy path like/unlike for tracks and albums, 403 missing scope handling, and album search fallback.

```python
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models import User, LikedTrack, SavedAlbum

client = TestClient(app)

def test_like_track_success(db_session, auth_headers):
    # Tests PUT /spotify/like-track/{track_id}
    ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=worker pytest backend/app/tests/test_spotify_library_likes.py -q`
Expected: FAIL (routes not found).

- [ ] **Step 3: Update `config.py`, `.env.example`, schemas, services, and routes**

1. In `config.py` and `.env.example`, add `user-library-modify` to `SPOTIFY_SCOPES`.
2. In `schemas/spotify_library.py`, add `LikeTrackPayload`, `LikeTrackResponse`, `LikeAlbumPayload`, `LikeAlbumResponse`.
3. In `services/spotify_library_service.py`, implement:
   - `toggle_like_track(db, user, track_id, payload, like=True)`: Calls Spotify `PUT` or `DELETE` on `/v1/me/tracks?ids={track_id}` using user's token. On success, upserts or removes from `LikedTrack`.
   - `toggle_like_album(db, user, album_id_or_name, payload, like=True)`: Resolves Spotify album ID (from ID, scrobble metadata, or Spotify search `q=album:... artist:...`), calls Spotify `/v1/me/albums?ids={album_id}`, and upserts or removes from `SavedAlbum`.
4. In `api/spotify_library.py`, expose the endpoints with bearer auth.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=worker pytest backend/app/tests/test_spotify_library_likes.py -q`
Expected: PASS.

- [ ] **Step 5: Run linter and commit**

```bash
ruff check backend/app
git add backend/app/config.py .env.example backend/app/schemas/spotify_library.py backend/app/services/spotify_library_service.py backend/app/api/spotify_library.py backend/app/tests/test_spotify_library_likes.py
git commit -m "feat(spotify): add two-way like and unlike endpoints for tracks and albums"
```

---

### Task 2: Backend Library Albums `is_liked` and Spotify Album ID Resolution

**Files:**
- Modify: `backend/app/schemas/analytics.py:34-45`
- Modify: `backend/app/services/analytics_service.py:230-265`
- Test: `backend/app/tests/test_library_albums_liked.py`

**Interfaces:**
- Consumes: `SavedAlbum` table, `build_library_entities_query`
- Produces: `LibraryEntry.is_liked: bool`, `LibraryEntry.spotify_album_id: str | None` when `entity == "albums"`.

- [ ] **Step 1: Write failing test in `backend/app/tests/test_library_albums_liked.py`**

Verify that `GET /library/albums` returns `is_liked=True` and `spotify_album_id` for albums matching a user's `SavedAlbum` records, and `is_liked=False` for others.

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=worker pytest backend/app/tests/test_library_albums_liked.py -q`
Expected: FAIL.

- [ ] **Step 3: Update `analytics.py` and `analytics_service.py`**

1. In `schemas/analytics.py`, add `spotify_album_id: str | None = None` to `LibraryEntry`.
2. In `services/analytics_service.py`, in `get_library_entities`, when `entity == "albums"`, query `SavedAlbum` for `user_id` matching candidate album names and artists. Populate `is_liked=True` and `spotify_album_id` for matches.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=worker pytest backend/app/tests/test_library_albums_liked.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/analytics.py backend/app/services/analytics_service.py backend/app/tests/test_library_albums_liked.py
git commit -m "feat(library): support is_liked and album id on library albums"
```

---

### Task 3: Frontend API & Interactive `LikedHeart` Component

**Files:**
- Modify: `frontend/src/api.js:150-185`
- Modify: `frontend/src/components/LikedHeart.jsx:1-35`
- Create: `frontend/src/components/LikedHeart.test.jsx`
- Modify: `frontend/src/styles.css:2860-2900`

**Interfaces:**
- Consumes: `api.likeTrack`, `api.unlikeTrack`, `api.likeAlbum`, `api.unlikeAlbum`
- Produces: `<LikedHeart liked={bool} interactive={bool} onToggle={fn} disabled={bool} title={str} />`

- [ ] **Step 1: Write failing tests in `frontend/src/components/LikedHeart.test.jsx`**

Test static badge mode (default), interactive button mode, click handling, keyboard trigger (Enter/Space), disabled non-Spotify notice, and active heart burst animation.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/components/LikedHeart.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement API functions, interactive LikedHeart, and CSS**

1. In `frontend/src/api.js`, export `likeTrack`, `unlikeTrack`, `likeAlbum`, `unlikeAlbum`.
2. In `frontend/src/components/LikedHeart.jsx`, support `interactive`, `onToggle`, `busy`, `disabled`, and render `<button type="button" className="liked-heart liked-heart-btn ...">` when interactive.
3. In `frontend/src/styles.css`, style `.liked-heart-btn` as a borderless, transparent button with accessible focus rings and smooth transitions.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/components/LikedHeart.test.jsx`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write frontend/src/api.js frontend/src/components/LikedHeart.jsx frontend/src/components/LikedHeart.test.jsx frontend/src/styles.css
git add frontend/src/api.js frontend/src/components/LikedHeart.jsx frontend/src/components/LikedHeart.test.jsx frontend/src/styles.css
git commit -m "feat(ui): add interactive LikedHeart button with toggle support"
```

---

### Task 4: Wire Hearts in Library (Tracks, Scrobbles, and Albums tabs)

**Files:**
- Modify: `frontend/src/components/LibraryRankList.jsx:1-120`
- Modify: `frontend/src/components/LibraryScrobbleList.jsx:1-100`
- Modify: `frontend/src/pages/LibraryPage.jsx:250-320`
- Modify: `frontend/src/components/LibraryRankList.test.jsx`
- Modify: `frontend/src/components/LibraryScrobbleList.test.jsx`

**Interfaces:**
- Consumes: `LikedHeart`, `likeTrack`, `unlikeTrack`, `likeAlbum`, `unlikeAlbum`, `isOwnLibrary`
- Produces: Clickable like/unlike toggles on Library tracks and albums, read-only on foreign profiles.

- [ ] **Step 1: Write tests for interactive hearts in `LibraryRankList.test.jsx` and `LibraryScrobbleList.test.jsx`**

Verify hearts render on albums as well as tracks, trigger `onToggleLike` when clicked in own library, and remain read-only when `isOwnLibrary` is false.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test src/components/LibraryRankList.test.jsx src/components/LibraryScrobbleList.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Update `LibraryRankList`, `LibraryScrobbleList`, and `LibraryPage`**

1. In `LibraryRankList.jsx`, show `<LikedHeart>` for both `kind === 'tracks'` and `kind === 'albums'`. Pass `interactive={isOwnLibrary}` and `onToggle={() => onToggleLike(entry)}`.
2. In `LibraryScrobbleList.jsx`, pass `interactive={isOwnLibrary}` and `onToggle={() => onToggleLike(scrobble)}`.
3. In `LibraryPage.jsx`, implement `handleToggleLike(item, kind)`:
   - Check if item is Spotify-linked; if not, set `actionNotice = "Only able to like tracks/albums played through Spotify"`.
   - Optimistically toggle `is_liked` in `data`.
   - Call API. If 403 `needs_spotify_reconnect`, revert and show notice: "Please reconnect your Spotify account in Settings to enable liking." If other failure, revert and show error notice.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test src/components/LibraryRankList.test.jsx src/components/LibraryScrobbleList.test.jsx`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write frontend/src/components/LibraryRankList.jsx frontend/src/components/LibraryScrobbleList.jsx frontend/src/pages/LibraryPage.jsx
git add frontend/src/components/LibraryRankList.jsx frontend/src/components/LibraryScrobbleList.jsx frontend/src/pages/LibraryPage.jsx frontend/src/components/LibraryRankList.test.jsx frontend/src/components/LibraryScrobbleList.test.jsx
git commit -m "feat(library): wire interactive like hearts across tracks, scrobbles, and albums"
```

---

### Task 5: Wire Hearts in Overview, Connect Recent Scrobbles, and Album Jukebox

**Files:**
- Modify: `frontend/src/components/RankedList.jsx:1-75`
- Modify: `frontend/src/components/ScrobbleList.jsx:1-65`
- Modify: `frontend/src/components/jukebox/FlatJukebox.jsx:165-210`
- Modify: `frontend/src/components/jukebox/JukeboxCard.jsx:35-85`
- Modify: `frontend/src/pages/OverviewPage.jsx:80-120`
- Test: `frontend/src/components/jukebox/FlatJukebox.test.jsx`
- Test: `frontend/src/components/ScrobbleList.test.jsx`

**Interfaces:**
- Consumes: `LikedHeart`, `likeTrack`, `likeAlbum`
- Produces: Hearts on Overview Top Tracks, Connect Recent Scrobbles, and Jukebox picks.

- [ ] **Step 1: Write tests in `FlatJukebox.test.jsx` and `ScrobbleList.test.jsx`**

Verify that `FlatJukebox` displays a heart for the current pick album and calls `onToggleLike`, and `ScrobbleList` renders hearts on recent scrobbles.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test src/components/jukebox/FlatJukebox.test.jsx src/components/ScrobbleList.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Update `RankedList`, `ScrobbleList`, `FlatJukebox`, `JukeboxCard`, and `OverviewPage`**

1. In `RankedList.jsx`, when displaying tracks, include `<LikedHeart liked={entry.is_liked} interactive={true} onToggle=... />`.
2. In `ScrobbleList.jsx`, include `<LikedHeart>` on each scrobble row.
3. In `FlatJukebox.jsx`, render `<LikedHeart>` next to the album title and artist of the current pick.
4. Wire like/unlike handlers in `OverviewPage.jsx` and `JukeboxCard.jsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test src/components/jukebox/FlatJukebox.test.jsx src/components/ScrobbleList.test.jsx`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write frontend/src/components/RankedList.jsx frontend/src/components/ScrobbleList.jsx frontend/src/components/jukebox/FlatJukebox.jsx frontend/src/components/jukebox/JukeboxCard.jsx frontend/src/pages/OverviewPage.jsx
git add frontend/src/components/RankedList.jsx frontend/src/components/ScrobbleList.jsx frontend/src/components/jukebox/FlatJukebox.jsx frontend/src/components/jukebox/JukeboxCard.jsx frontend/src/pages/OverviewPage.jsx frontend/src/components/jukebox/FlatJukebox.test.jsx frontend/src/components/ScrobbleList.test.jsx
git commit -m "feat(overview): add interactive like hearts to top tracks, scrobble list, and jukebox"
```

---

### Task 6: Documentation, User Guide, FAQ, and Version Bump (v0.30.0)

**Files:**
- Modify: `frontend/package.json:4`
- Modify: `frontend/src/changelogData.js:1-15`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx:45-90`
- Modify: `frontend/src/components/settings/FaqSection.jsx:40-90`
- Modify: `agents/page_specs.md:30-110`

**Interfaces:**
- Public documentation and user-facing guide updates.

- [ ] **Step 1: Update User Guide and FAQ**

Document:
- How two-way liking works for tracks and albums directly into Spotify.
- Note about reconnecting Spotify in Settings if permissions are needed.
- Explanation of the notice for tracks played from non-Spotify sources.

- [ ] **Step 2: Update Changelog and bump version to `0.30.0`**

Add top release entry in `changelogData.js` and bump version in `package.json`.

- [ ] **Step 3: Run full verification suite**

Run:
```bash
ruff check backend/app worker scripts
ruff format --check backend/app worker scripts
PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
cd frontend && npm run lint && npm test && npm run build
```
Expected: All suites 100% green.

- [ ] **Step 4: Security Differential Review and Commit**

Run differential security review.
Stage and commit:
```bash
git add frontend/package.json frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx frontend/src/components/settings/FaqSection.jsx agents/page_specs.md
git commit -m "docs: document two-way spotify likes in user guide, faq, and changelog (v0.30.0)"
```
