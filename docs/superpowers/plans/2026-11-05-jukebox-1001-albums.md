# Jukebox 1001 Albums Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "1001 Albums You Must Hear Before You Die" generator to the Album Jukebox with decade and unified parent-genre filtering, 90% historical track threshold auto-detection, post-listen confirmation prompt, interactive decade-tabbed checklist modal, and full album cover artwork display.

**Architecture:** A static canonical JSON dataset of the 1001 albums (`backend/app/data/1001_albums.json`) is loaded by a new backend service that matches against user scrobbles (90% track threshold) and tracks completion state via PostgreSQL table `user_1001_album_completions`. Frontend components (`JukeboxCard`, `FlatJukebox`, `RetroJukebox`, `JukeboxFilters`) consume `/jukebox/1001-albums` endpoints, unifying parent-genre filtering across both 1001 albums and user library modes, with an interactive modal (`1001AlbumsChecklistModal`) for decade-by-decade tracking.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, Pydantic v2, React 18, Vite, Vitest, Testing Library.

**Spec:** [`docs/superpowers/specs/2026-11-05-jukebox-1001-albums-design.md`](file:///home/andyl/Audio%20Scrobbler%20App/docs/superpowers/specs/2026-11-05-jukebox-1001-albums-design.md)

## Global Constraints
- Target branch: `feat/jukebox-1001-albums` (PR #43). Never push directly to `main`.
- Protected Component: Do not restyle or modify custom CSS in `RetroJukebox.jsx` or `RetroJukebox.module.css`. Place mode toggles cleanly at the `JukeboxCard` level.
- No inline Spotify API calls: The 1001 dataset and artwork URLs are bundled locally; user completion state is stored locally in PostgreSQL.
- Album artwork uses remote Spotify CDN URLs (`https://i.scdn.co/image/...`), not heavy local binary files in the repository.
- Scrobble completion threshold: An album is only auto-marked from scrobble history if at least 90% of its tracks have been scrobbled ($\text{distinct scrobbled tracks} / \text{track\_count} \ge 0.90$).
- Manual unmarking persistence: If a user unmarks an album, `is_completed` is set to `False` (`source="manual_unmark"`). Subsequent scrobble passes must never re-mark it.

## Review Focus
1. An album with only 1 or 2 tracks scrobbled (e.g. casual single play) must NOT be marked as completed.
2. Explicitly unmarking an album must persist across page reloads and never be reverted by auto-detection.
3. Selecting a parent genre like "Rock" in "My Library" mode must match subgenres like "indie rock" or "hard rock" rather than returning 0 results.
4. Clicking "Open in Spotify" in 1001 mode must register a pending confirmation that prompts the user on their next visit.
5. In the checklist modal, toggling an album's completion checkbox must update the progress counter immediately without closing or resetting scroll position.

---

### Task 1: Canonical 1001 Albums Dataset and Catalog Service

**Files:**
- Create: `backend/app/data/1001_albums.json`
- Create: `backend/app/services/catalog_1001_service.py`
- Test: `backend/app/tests/test_catalog_1001_service.py`

**Interfaces:**
- Produces: `get_canonical_1001_albums() -> list[dict]`, `get_1001_album_by_id(album_id: int) -> dict | None`
- Format of each album record:
  ```json
  {
    "id": 1,
    "album_name": "In the Court of the Crimson King",
    "artist_name": "King Crimson",
    "release_year": 1969,
    "decade": 1960,
    "genres": ["Rock", "Progressive"],
    "track_count": 5,
    "spotify_album_id": "5wec5905Q58Es5T7b774m7",
    "spotify_url": "https://open.spotify.com/album/5wec5905Q58Es5T7b774m7",
    "artwork_url": "https://i.scdn.co/image/ab67616d0000b2734a1796c9eaecbf3d5b008d53"
  }
  ```

- [ ] **Step 1: Write failing unit test for `catalog_1001_service`**

```python
# backend/app/tests/test_catalog_1001_service.py
from backend.app.services.catalog_1001_service import get_canonical_1001_albums, get_1001_album_by_id

def test_catalog_loads_canonical_albums():
    albums = get_canonical_1001_albums()
    assert len(albums) >= 1000
    first = albums[0]
    assert "id" in first
    assert "album_name" in first
    assert "artist_name" in first
    assert "release_year" in first
    assert "decade" in first
    assert "genres" in first
    assert "track_count" in first
    assert first["track_count"] > 0
    assert "artwork_url" in first

def test_get_1001_album_by_id_found_and_missing():
    album = get_1001_album_by_id(1)
    assert album is not None
    assert album["id"] == 1
    missing = get_1001_album_by_id(999999)
    assert missing is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. pytest backend/app/tests/test_catalog_1001_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.app.services.catalog_1001_service'`

- [ ] **Step 3: Build `backend/app/data/1001_albums.json` and implement `catalog_1001_service.py`**

Create `backend/app/data/1001_albums.json` containing the canonical 1001 albums catalog.
Implement `get_canonical_1001_albums` with cached file reading (`lru_cache`) and `get_1001_album_by_id` dictionary lookup.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. pytest backend/app/tests/test_catalog_1001_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/data/1001_albums.json backend/app/services/catalog_1001_service.py backend/app/tests/test_catalog_1001_service.py
git commit -m "feat(backend): add canonical 1001 albums dataset and catalog service"
```

---

### Task 2: Database Models & Alembic Migration for Completions & Pending Confirmations

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/migrations/versions/0031_add_1001_albums_tables.py`
- Test: `backend/app/tests/test_1001_albums_models.py`

**Interfaces:**
- Produces SQLAlchemy models: `User1001AlbumCompletion`, `User1001PendingConfirmation`
- `User1001AlbumCompletion`: `id`, `user_id`, `album_id`, `is_completed: bool`, `source: str`, `completed_at: datetime`, `created_at: datetime`. Unique on `(user_id, album_id)`.
- `User1001PendingConfirmation`: `id`, `user_id`, `album_id`, `opened_at: datetime`, `dismissed: bool`. Unique on `(user_id, album_id)`.

- [ ] **Step 1: Write failing test for `User1001AlbumCompletion` and `User1001PendingConfirmation`**

```python
# backend/app/tests/test_1001_albums_models.py
from datetime import datetime, timezone
import pytest
from sqlalchemy.exc import IntegrityError
from backend.app.models import User, User1001AlbumCompletion, User1001PendingConfirmation

def test_user_1001_album_completion_uniqueness(db_session):
    user = User(email="1001@example.com", hashed_password="pw", is_active=True)
    db_session.add(user)
    db_session.commit()

    c1 = User1001AlbumCompletion(user_id=user.id, album_id=42, is_completed=True, source="manual")
    db_session.add(c1)
    db_session.commit()

    c2 = User1001AlbumCompletion(user_id=user.id, album_id=42, is_completed=False, source="manual_unmark")
    db_session.add(c2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_user_1001_pending_confirmation_lifecycle(db_session):
    user = User(email="1001_pending@example.com", hashed_password="pw", is_active=True)
    db_session.add(user)
    db_session.commit()

    p = User1001PendingConfirmation(user_id=user.id, album_id=10, opened_at=datetime.now(timezone.utc), dismissed=False)
    db_session.add(p)
    db_session.commit()

    saved = db_session.query(User1001PendingConfirmation).filter_by(user_id=user.id, album_id=10).first()
    assert saved is not None
    assert saved.dismissed is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. pytest backend/app/tests/test_1001_albums_models.py -v`
Expected: FAIL with `ImportError: cannot import name 'User1001AlbumCompletion'`

- [ ] **Step 3: Add models to `backend/app/models.py` and generate Alembic migration 0031**

Add `User1001AlbumCompletion` and `User1001PendingConfirmation` to `backend/app/models.py`.
Create `backend/migrations/versions/0031_add_1001_albums_tables.py` creating both tables with unique constraints and foreign keys to `users.id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. pytest backend/app/tests/test_1001_albums_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/migrations/versions/0031_add_1001_albums_tables.py backend/app/tests/test_1001_albums_models.py
git commit -m "feat(db): add user 1001 album completions and pending confirmations tables"
```

---

### Task 3: Backend Completion Logic, 90% Scrobble Threshold & API Routes

**Files:**
- Modify: `backend/app/services/catalog_1001_service.py`
- Create: `backend/app/api/jukebox_1001.py`
- Modify: `backend/app/main.py`
- Test: `backend/app/tests/test_jukebox_1001_api.py`

**Interfaces:**
- Produces:
  - `GET /jukebox/1001-albums -> Jukebox1001Response`
  - `POST /jukebox/1001-albums/{album_id}/toggle-completed -> ToggleCompletedResponse`
  - `POST /jukebox/1001-albums/pending-play -> StatusResponse`
  - `POST /jukebox/1001-albums/dismiss-pending -> StatusResponse`
- Threshold Logic:
  - Match scrobbles where `clean_title(listening_events.album_name) == clean_title(album.album_name)` and artist matches.
  - Count distinct `track_name` scrobbled. If `distinct_tracks / album.track_count >= 0.90`, seed `is_completed=True, source="scrobble_90pct"`.
  - Manual unmarks (`is_completed=False`) are never overwritten.

- [ ] **Step 1: Write failing API test for `/jukebox/1001-albums`**

```python
# backend/app/tests/test_jukebox_1001_api.py
from datetime import datetime, timezone
import pytest
from backend.app.models import ListeningEvent, User1001AlbumCompletion, User1001PendingConfirmation

def test_get_1001_albums_seeding_and_threshold(client, auth_headers, db_session, test_user):
    # Add scrobbles for King Crimson (5 tracks total on album)
    # 4 distinct tracks = 4/5 = 80% (under 90% threshold -> NOT completed)
    for i in range(1, 5):
        db_session.add(ListeningEvent(
            user_id=test_user.id,
            track_name=f"Track {i}",
            artist_name="King Crimson",
            album_name="In the Court of the Crimson King",
            played_at=datetime.now(timezone.utc),
            play_id=f"kc_{i}"
        ))
    db_session.commit()

    resp = client.get("/jukebox/1001-albums", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "albums" in data
    assert "completed_count" in data
    assert "decade_stats" in data
    kc = next(a for a in data["albums"] if a["id"] == 1)
    assert kc["is_completed"] is False

    # Add 5th track -> 5/5 = 100% (>= 90% -> completed)
    db_session.add(ListeningEvent(
        user_id=test_user.id,
        track_name="Track 5",
        artist_name="King Crimson",
        album_name="In the Court of the Crimson King",
        played_at=datetime.now(timezone.utc),
        play_id="kc_5"
    ))
    db_session.commit()

    resp2 = client.get("/jukebox/1001-albums", headers=auth_headers)
    assert resp2.status_code == 200
    kc2 = next(a for a in resp2.json()["albums"] if a["id"] == 1)
    assert kc2["is_completed"] is True

def test_toggle_completed_and_persistent_unmark(client, auth_headers, test_user):
    # Manually mark album 2 as completed
    resp = client.post("/jukebox/1001-albums/2/toggle-completed", json={"is_completed": True, "source": "manual"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_completed"] is True

    # Manually unmark album 2
    resp2 = client.post("/jukebox/1001-albums/2/toggle-completed", json={"is_completed": False, "source": "manual_unmark"}, headers=auth_headers)
    assert resp2.status_code == 200
    assert resp2.json()["is_completed"] is False

def test_pending_play_and_dismissal(client, auth_headers):
    resp = client.post("/jukebox/1001-albums/pending-play", json={"album_id": 3}, headers=auth_headers)
    assert resp.status_code == 200

    catalog = client.get("/jukebox/1001-albums", headers=auth_headers).json()
    assert catalog.get("pending_confirmation") is not None
    assert catalog["pending_confirmation"]["album_id"] == 3

    client.post("/jukebox/1001-albums/dismiss-pending", headers=auth_headers)
    catalog2 = client.get("/jukebox/1001-albums", headers=auth_headers).json()
    assert catalog2.get("pending_confirmation") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. pytest backend/app/tests/test_jukebox_1001_api.py -v`
Expected: FAIL with 404 Not Found for `/jukebox/1001-albums`

- [ ] **Step 3: Implement service functions and API routes**

In `backend/app/services/catalog_1001_service.py`, implement scrobble threshold calculation using `ListeningEvent`, completion upsert, and pending confirmation queries.
Create `backend/app/api/jukebox_1001.py` with the 4 endpoints and register the router in `backend/app/main.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. pytest backend/app/tests/test_jukebox_1001_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/catalog_1001_service.py backend/app/api/jukebox_1001.py backend/app/main.py backend/app/tests/test_jukebox_1001_api.py
git commit -m "feat(api): add 1001 albums catalog, 90% scrobble threshold, and confirmation routes"
```

---

### Task 4: Frontend API Client & Unified Parent-Genre Engine

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/components/jukebox/useJukeboxEngine.js`
- Modify: `frontend/src/components/jukebox/JukeboxFilters.jsx`
- Test: `frontend/src/components/jukebox/useJukeboxEngine.test.js`
- Test: `frontend/src/components/jukebox/JukeboxFilters.test.jsx`

**Interfaces:**
- Produces API methods:
  - `fetch1001Albums({ token })`
  - `toggle1001AlbumCompleted({ token, albumId, isCompleted, source })`
  - `record1001PendingPlay({ token, albumId })`
  - `dismiss1001PendingPlay({ token })`
- Engine additions in `useJukeboxEngine`:
  - `sourceMode: "library" | "1001"`, `setSourceMode`
  - `excludeCompleted: boolean`, `setExcludeCompleted`
  - Parent genre mapping: Top 10 parent genres (Rock, Pop, Electronic, Soul, Jazz, Punk, Hip Hop, Folk, Metal, Funk). In library mode, parent genre matches subgenres (e.g. "Rock" matches "indie rock").

- [ ] **Step 1: Write failing test for parent genre mapping and 1001 engine filtering**

```javascript
// frontend/src/components/jukebox/useJukeboxEngine.test.js
import { renderHook, act } from "@testing-library/react";
import { useJukeboxEngine } from "./useJukeboxEngine";

test("parent genre keyword matching works on library albums with micro-genres", () => {
  const albums = [
    { id: 1, album_name: "Kid A", artist_name: "Radiohead", genres: ["art rock", "electronic"] },
    { id: 2, album_name: "Blue", artist_name: "Joni Mitchell", genres: ["folk"] },
    { id: 3, album_name: "Kind of Blue", artist_name: "Miles Davis", genres: ["modal jazz"] },
  ];
  const { result } = renderHook(() => useJukeboxEngine(albums));

  act(() => {
    result.current.toggleFilter("genre", "Rock");
  });

  expect(result.current.filteredAlbums.map((a) => a.album_name)).toEqual(["Kid A"]);
});

test("excludeCompleted filter omits completed albums in 1001 mode", () => {
  const albums = [
    { id: 1, album_name: "Album One", is_completed: true },
    { id: 2, album_name: "Album Two", is_completed: false },
  ];
  const { result } = renderHook(() => useJukeboxEngine(albums));

  act(() => {
    result.current.setExcludeCompleted(true);
  });

  expect(result.current.filteredAlbums.map((a) => a.album_name)).toEqual(["Album Two"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/components/jukebox/useJukeboxEngine.test.js`
Expected: FAIL

- [ ] **Step 3: Implement API functions, parent genre mapping, and excludeCompleted filter**

Add API calls in `frontend/src/api.js`.
In `frontend/src/components/jukebox/useJukeboxEngine.js`, implement parent genre normalization / regex keyword matching (`ROCK_KEYWORDS`, etc.) and `excludeCompleted` filter check.
In `frontend/src/components/jukebox/JukeboxFilters.jsx`, render the unified top 10 parent genres and the `Exclude previously played albums` checkbox when in 1001 mode.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/components/jukebox/useJukeboxEngine.test.js src/components/jukebox/JukeboxFilters.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.js frontend/src/components/jukebox/useJukeboxEngine.js frontend/src/components/jukebox/JukeboxFilters.jsx frontend/src/components/jukebox/useJukeboxEngine.test.js frontend/src/components/jukebox/JukeboxFilters.test.jsx
git commit -m "feat(frontend): add unified parent genre filtering and exclude completed engine logic"
```

---

### Task 5: Decade-Tabbed Checklist Modal Component

**Files:**
- Create: `frontend/src/components/jukebox/1001AlbumsChecklistModal.jsx`
- Create: `frontend/src/components/jukebox/1001AlbumsChecklistModal.test.jsx`

**Interfaces:**
- Props:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `albums: list` (all 1001 albums with `is_completed`, `decade`, `release_year`, `artwork_url`)
  - `completedCount: number`
  - `totalCount: number`
  - `onToggleCompleted: (albumId, isCompleted) => Promise<void>`

- [ ] **Step 1: Write failing test for `1001AlbumsChecklistModal`**

```javascript
// frontend/src/components/jukebox/1001AlbumsChecklistModal.test.jsx
import { render, screen, fireEvent } from "@testing-library/react";
import 1001AlbumsChecklistModal from "./1001AlbumsChecklistModal";

test("renders decade tabs, switches decades, and toggles album completion", () => {
  const mockToggle = vi.fn();
  const albums = [
    { id: 1, album_name: "Abbey Road", artist_name: "The Beatles", release_year: 1969, decade: 1960, is_completed: true, artwork_url: "" },
    { id: 2, album_name: "Dark Side", artist_name: "Pink Floyd", release_year: 1973, decade: 1970, is_completed: false, artwork_url: "" },
  ];

  render(
    <1001AlbumsChecklistModal
      isOpen={true}
      onClose={vi.fn()}
      albums={albums}
      completedCount={1}
      totalCount={2}
      onToggleCompleted={mockToggle}
    />
  );

  expect(screen.getByText(/1001 Albums Progress/i)).toBeInTheDocument();
  expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument();

  // Click on 70s decade tab
  const tab70s = screen.getByRole("button", { name: /70s/i });
  fireEvent.click(tab70s);
  expect(screen.getByText("Dark Side")).toBeInTheDocument();

  // Click checkbox on Dark Side
  const checkbox = screen.getByRole("checkbox", { name: /Dark Side/i });
  fireEvent.click(checkbox);
  expect(mockToggle).toHaveBeenCalledWith(2, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/components/jukebox/1001AlbumsChecklistModal.test.jsx`
Expected: FAIL with component not found

- [ ] **Step 3: Implement `1001AlbumsChecklistModal.jsx`**

Implement modal dialog adhering to `DESIGN.md` flat styling:
- Header with title, progress bar (`completedCount / totalCount`), and close button.
- Horizontal pill tabs for decades (50s through 20s) with completion badge (e.g. `70s (1/1)`).
- Scrollable list of albums for selected decade with thumbnail artwork, artist, title, year, and toggle checkbox.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/components/jukebox/1001AlbumsChecklistModal.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/jukebox/1001AlbumsChecklistModal.jsx frontend/src/components/jukebox/1001AlbumsChecklistModal.test.jsx
git commit -m "feat(frontend): add interactive 1001 albums decade checklist modal"
```

---

### Task 6: Jukebox Integration (Source Switch, Confirmation Banner, Artwork & Protected Retro Jukebox)

**Files:**
- Modify: `frontend/src/components/jukebox/FlatJukebox.jsx`
- Modify: `frontend/src/components/jukebox/JukeboxCard.jsx`
- Modify: `frontend/src/components/jukebox/RetroJukebox.jsx` (functional props only; zero CSS / styling changes)
- Test: `frontend/src/components/jukebox/FlatJukebox.test.jsx`
- Test: `frontend/src/components/jukebox/JukeboxCard.test.jsx`

**Interfaces:**
- In `JukeboxCard.jsx`:
  - Source switch buttons: `[ 🎧 My Library ] [ 📖 1001 Albums ]`
  - In 1001 mode: progress bar button (opens `1001AlbumsChecklistModal`).
  - Confirmation prompt banner: When `pendingConfirmation` exists, render banner above player controls: *"Did you listen to {album_name} by {artist_name}?"* with `[✓ Yes, mark played]` and `[✕ Not yet]`.
- In `FlatJukebox.jsx`:
  - Render album artwork thumbnail in vinyl center / pick card.
  - Render completion status tick button next to album title in 1001 mode.
- In `RetroJukebox.jsx`:
  - Pass 1001 album pick data and artwork cleanly into display panel while keeping all arcade cabinet CSS module rules untouched.

- [ ] **Step 1: Write failing tests for JukeboxCard source switch and confirmation banner**

```javascript
// frontend/src/components/jukebox/JukeboxCard.test.jsx
test("renders source toggle, switches between library and 1001 albums, and shows confirmation banner", async () => {
  // test that clicking [📖 1001 Albums] switches mode, loads 1001 albums, displays progress, and shows confirmation prompt when pending
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/components/jukebox/JukeboxCard.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement JukeboxCard source switch, confirmation banner, and pick view enhancements**

Wire `sourceMode` toggle, progress button opening `1001AlbumsChecklistModal`, pending confirmation prompt banner, and album artwork display.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/components/jukebox/JukeboxCard.test.jsx src/components/jukebox/FlatJukebox.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/jukebox/FlatJukebox.jsx frontend/src/components/jukebox/JukeboxCard.jsx frontend/src/components/jukebox/RetroJukebox.jsx frontend/src/components/jukebox/FlatJukebox.test.jsx frontend/src/components/jukebox/JukeboxCard.test.jsx
git commit -m "feat(frontend): integrate 1001 albums mode, confirmation prompt, and artwork in Jukebox"
```

---

### Task 7: Full Test Suite, Linters, Changelog & User Guide Updates

**Files:**
- Modify: `frontend/package.json` (bump version e.g. v0.31.0)
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`
- Modify: `frontend/src/components/settings/FaqSection.jsx`

- [ ] **Step 1: Update documentation and version**
Add changelog entry at top of `frontend/src/changelogData.js` describing the 1001 Albums generator, 90% threshold, confirmation prompt, and decade checklist modal.
Update `UserGuideSection.jsx` and `FaqSection.jsx` explaining how the 1001 challenge works. Bump version in `frontend/package.json`.

- [ ] **Step 2: Run Python and frontend linters**
```bash
ruff check backend/app worker scripts
ruff format --check backend/app worker scripts
cd frontend && npm run lint
```
Fix any formatting or lint warnings.

- [ ] **Step 3: Run full backend and frontend test suites**
```bash
PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
cd frontend && npm test && npm run build
```
Verify 100% passing tests and successful production build.

- [ ] **Step 4: Commit**
```bash
git add frontend/package.json frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx frontend/src/components/settings/FaqSection.jsx
git commit -m "docs(changelog): document 1001 albums generator and bump version to v0.31.0"
```
