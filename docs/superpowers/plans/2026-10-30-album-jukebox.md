# Album Jukebox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Album Jukebox" on the Overview page, allowing users to spin for a full favourited album with a 3-roll limit, supporting both Flat Utility and Retro Arcade themes.

**Architecture:** A new `saved_albums` PostgreSQL table stores user-saved Spotify albums, populated periodically by background worker sync against Spotify `/v1/me/albums` and enriched with artist genres. A backend API serves user albums with play counts and records pick timestamps. A React Jukebox component mounted on `OverviewPage` provides client-side instant filtering, roll quota tracking, turntable animations, and seamless toggle between a Flat Utility view and a faithful Retro Arcade Cabinet.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, React 18, Vite, CSS Modules / scoped styles.

**Spec:** `docs/superpowers/specs/2026-10-30-album-jukebox-design.md`

## Global Constraints

- **Python:** Strict PEP 8, PEP 484 type hints (`from __future__ import annotations`), SQLAlchemy 2.0 `Mapped`/`mapped_column`, Pydantic v2 schemas. All imports at module top.
- **Frontend:** React 18 functional components, strictly following `DESIGN.md` for Flat Utility mode (flat-by-default, zero `box-shadow`, dynamic CSS accent tokens).
- **Security:** Strict JWT user authentication for `/api/jukebox/*` routes; `WORKER_INGESTION_TOKEN` for `/internal/` endpoints. Never call Spotify APIs inline during HTTP request cycles.
- **Rules & Limits:** 3 re-rolls maximum per Lucky Dip session. Album of the Day is deterministic by date `YYYY-MM-DD` and ignores filters.

## Review Focus

1. **Empty Album Catalog:** When a user has 0 saved albums, the Jukebox falls back to top scrobbled albums from `listening_events` or displays an actionable prompt without throwing runtime errors.
2. **0-Match Filter Pool:** When active filters match 0 albums, Lucky Dip and Re-roll buttons disable gracefully, the counter displays 0, and a "Clear filters" action restores the state.
3. **Roll Quota Bypass Attempt:** Mid-session Lucky Dip clicks consume a roll just like Re-roll, ensuring the 3-roll quota cannot be bypassed.
4. **Spotify 429 Rate Limits in Worker:** Album sync uses incremental pagination (`limit=50`), saves watermark checkpoints, and honors backoff without hammering Spotify.
5. **Reduced Motion Accessibility:** When `prefers-reduced-motion: reduce` is active, the 3.5s turntable and claw animation is skipped immediately, loading the album card with zero delay.

---

### Task 1: Database Models & Alembic Migration

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/migrations/versions/0028_add_saved_albums_and_jukebox_settings.py`
- Test: `backend/app/tests/test_saved_albums_model.py`

**Interfaces:**
- Consumes: SQLAlchemy `Base`, `UserScrobbleSettings`, `UserPreferences`
- Produces: `SavedAlbum` model table, `UserScrobbleSettings.saved_albums_*` columns, `UserPreferences.jukebox_source` column

- [ ] **Step 1: Write the failing test for `SavedAlbum` model**

```python
# backend/app/tests/test_saved_albums_model.py
from datetime import datetime
from backend.app.models import SavedAlbum

def test_saved_album_instantiation():
    album = SavedAlbum(
        user_id=1,
        spotify_album_id="album123",
        album_name="Abbey Road",
        artist_name="The Beatles",
        release_date="1969-09-26",
        release_year=1969,
        genres=["Rock"],
        duration_ms=2843000,
        label="Apple Records",
        artwork_url="https://img.spotify.com/123",
        spotify_url="https://open.spotify.com/album/album123",
        added_at=datetime.utcnow(),
    )
    assert album.album_name == "Abbey Road"
    assert album.release_year == 1969
```

- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=. pytest backend/app/tests/test_saved_albums_model.py -v`
Expected: FAIL (cannot import `SavedAlbum`)

- [ ] **Step 3: Implement `SavedAlbum` and update settings in `backend/app/models.py` and create migration `0028`**
Define `SavedAlbum` with columns `id`, `user_id`, `spotify_album_id`, `album_name`, `artist_name`, `release_date`, `release_year`, `genres` (JSON), `duration_ms`, `label`, `artwork_url`, `spotify_url`, `added_at`, `last_picked_at`, `created_at`. Add `saved_albums_sync_enabled`, `saved_albums_last_synced_at`, `saved_albums_backfill_offset` to `UserScrobbleSettings`. Add `jukebox_source` to `UserPreferences`.

- [ ] **Step 4: Run test to verify it passes**
Run: `PYTHONPATH=. pytest backend/app/tests/test_saved_albums_model.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/models.py backend/migrations/versions/0028_add_saved_albums_and_jukebox_settings.py backend/app/tests/test_saved_albums_model.py
git commit -m "feat(db): add SavedAlbum model and jukebox settings migration"
```

---

### Task 2: Spotify Worker Ingestion for Saved Albums

**Files:**
- Modify: `worker/spotify_ingestion.py`
- Modify: `worker/app.py`
- Create: `worker/tests/test_saved_albums_sync.py`

**Interfaces:**
- Consumes: Spotify Web API `/v1/me/albums`, `genre_cache`
- Produces: `sync_saved_albums_for_user(session, user, settings, client, backend_url, worker_token)`

- [ ] **Step 1: Write the failing worker test**

```python
# worker/tests/test_saved_albums_sync.py
from datetime import datetime
from worker.spotify_ingestion import sync_saved_albums_for_user

def test_sync_saved_albums_one_page(monkeypatch):
    # Mock client.saved_albums returning 1 album
    pass
```

- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=worker pytest worker/tests/test_saved_albums_sync.py -v`
Expected: FAIL (`sync_saved_albums_for_user` not found)

- [ ] **Step 3: Implement `saved_albums` method on Spotify client and `sync_saved_albums_for_user`**
In `worker/spotify_ingestion.py`, implement `saved_albums(access_token, offset, limit=50)`. Normalize response (album name, artist name, release year, duration sum, artwork, label). Map primary artist to genres using cache. Schedule in `worker/app.py` on an interval job.

- [ ] **Step 4: Run worker tests to verify it passes**
Run: `PYTHONPATH=worker pytest worker/tests/test_saved_albums_sync.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add worker/spotify_ingestion.py worker/app.py worker/tests/test_saved_albums_sync.py
git commit -m "feat(worker): add Spotify saved albums synchronization job"
```

---

### Task 3: Backend Ingestion and Jukebox API Endpoints

**Files:**
- Create: `backend/app/api/jukebox.py`
- Modify: `backend/app/main.py`
- Create: `backend/app/tests/test_jukebox_api.py`

**Interfaces:**
- Consumes: `SavedAlbum`, `ListeningEvent`, `UserPreferences`
- Produces:
  - `POST /internal/users/{user_id}/saved-albums`: Worker batch ingestion
  - `GET /api/jukebox/albums`: List albums with scrobble play counts
  - `POST /api/jukebox/record-pick`: Record `last_picked_at`
  - `GET /api/jukebox/daily`: Deterministic album of the day

- [ ] **Step 1: Write the failing API tests**

```python
# backend/app/tests/test_jukebox_api.py
def test_get_jukebox_albums_unauthorized(client):
    res = client.get("/api/jukebox/albums")
    assert res.status_code == 401

def test_get_daily_album_stable_for_date(client, auth_headers):
    res = client.get("/api/jukebox/daily", headers=auth_headers)
    assert res.status_code in (200, 404)
```

- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=. pytest backend/app/tests/test_jukebox_api.py -v`
Expected: FAIL (404 Not Found on `/api/jukebox/albums`)

- [ ] **Step 3: Implement `/api/jukebox/*` router and register in `backend/app/main.py`**
Implement `/api/jukebox/albums` with play counts calculated from `ListeningEvent` matching, `/api/jukebox/record-pick` updating `last_picked_at`, `/api/jukebox/daily` picking deterministically based on date hash, and `/internal/users/{user_id}/saved-albums` for worker ingestion.

- [ ] **Step 4: Run test to verify it passes**
Run: `PYTHONPATH=. pytest backend/app/tests/test_jukebox_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/api/jukebox.py backend/app/main.py backend/app/tests/test_jukebox_api.py
git commit -m "feat(api): implement Jukebox endpoints and internal ingestion router"
```

---

### Task 4: Frontend Jukebox State Engine & Logic

**Files:**
- Create: `frontend/src/components/jukebox/useJukeboxEngine.js`
- Create: `frontend/src/components/jukebox/useJukeboxEngine.test.js`

**Interfaces:**
- Consumes: album list from API, localStorage/sessionStorage
- Produces: `useJukeboxEngine` hook returning `{ filteredAlbums, pool, currentPick, rollsLeft, sessionActive, mode, filters, setMode, toggleFilter, clearFilters, roll, commitPick }`

- [ ] **Step 1: Write failing unit test for Jukebox engine**

```javascript
// frontend/src/components/jukebox/useJukeboxEngine.test.js
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useJukeboxEngine } from './useJukeboxEngine'

describe('useJukeboxEngine', () => {
  it('initializes with 3 rolls and applies filter correctly', () => {
    // Test initial state, roll exhaustion, and pool sampling
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test frontend/src/components/jukebox/useJukeboxEngine.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `useJukeboxEngine.js`**
Handle active filters (Artist, Decade, Genre, Length, Added Date), pick modes (Any, Least played, Most played, Recently added with 25% pool math), 3-roll limit, session locking, and roll decrementing.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test frontend/src/components/jukebox/useJukeboxEngine.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/jukebox/useJukeboxEngine.js frontend/src/components/jukebox/useJukeboxEngine.test.js
git commit -m "feat(frontend): create core Jukebox engine hook and filtering logic"
```

---

### Task 5: Flat Utility Jukebox Component (`FlatJukebox.jsx`)

**Files:**
- Create: `frontend/src/components/jukebox/FlatJukebox.jsx`
- Create: `frontend/src/components/jukebox/FlatJukebox.test.jsx`

**Interfaces:**
- Consumes: `useJukeboxEngine` state and handlers
- Produces: Flat-by-default UI component complying with `DESIGN.md` (flat vector vinyl platter, dynamic CSS accent tokens, responsive cards)

- [ ] **Step 1: Write failing component test**

```javascript
// frontend/src/components/jukebox/FlatJukebox.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FlatJukebox from './FlatJukebox'

describe('FlatJukebox', () => {
  it('renders flat vinyl platter and disables roll when 0 rolls left', () => {
    // Test controls and state rendering
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test frontend/src/components/jukebox/FlatJukebox.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `FlatJukebox.jsx`**
Build the clean flat interface: vinyl turntable with groove ring styling, spinning animation on roll, active filter pills, Lucky Dip button, Re-roll button with remaining count, and Open in Spotify commitment link.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test frontend/src/components/jukebox/FlatJukebox.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/jukebox/FlatJukebox.jsx frontend/src/components/jukebox/FlatJukebox.test.jsx
git commit -m "feat(frontend): build FlatJukebox component with clean flat aesthetic"
```

---

### Task 6: Retro Skeuomorphic Arcade Cabinet Component (`RetroJukebox.jsx`)

**Files:**
- Create: `frontend/src/components/jukebox/RetroJukebox.jsx`
- Create: `frontend/src/components/jukebox/RetroJukebox.module.css`
- Create: `frontend/src/components/jukebox/RetroJukebox.test.jsx`

**Interfaces:**
- Consumes: `useJukeboxEngine` state and handlers
- Produces: Faithful arcade cabinet with claw grabber animation, indicator light bulbs, record rack grid, and marquee.

- [ ] **Step 1: Write failing component test**

```javascript
// frontend/src/components/jukebox/RetroJukebox.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RetroJukebox from './RetroJukebox'

describe('RetroJukebox', () => {
  it('renders cabinet marquee and record rack', () => {
    // Assert MARQUEE and rack elements render
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test frontend/src/components/jukebox/RetroJukebox.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `RetroJukebox.jsx` and CSS module**
Port the exact CSS styles, claw coordinate animations, and stage layout from the brother's standalone HTML/CSS mockup into a modular React component.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test frontend/src/components/jukebox/RetroJukebox.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/jukebox/RetroJukebox.jsx frontend/src/components/jukebox/RetroJukebox.module.css frontend/src/components/jukebox/RetroJukebox.test.jsx
git commit -m "feat(frontend): port retro arcade jukebox cabinet with claw physics"
```

---

### Task 7: Jukebox Container & Overview Page Integration

**Files:**
- Create: `frontend/src/components/jukebox/JukeboxCard.jsx`
- Modify: `frontend/src/pages/OverviewPage.jsx`
- Modify: `frontend/src/api.js`
- Create: `frontend/src/components/jukebox/JukeboxCard.test.jsx`
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `fetchJukeboxAlbums`, `recordJukeboxPick`
- Produces: Integrated Jukebox container on Overview dashboard with theme mode toggle (`[⚡ Flat View] ↔ [🕹️ Arcade View]`)

- [ ] **Step 1: Write failing test for `JukeboxCard`**

```javascript
// frontend/src/components/jukebox/JukeboxCard.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import JukeboxCard from './JukeboxCard'

describe('JukeboxCard', () => {
  it('toggles between Flat View and Arcade View', () => {
    // Assert toggle switches view mode
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test frontend/src/components/jukebox/JukeboxCard.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `JukeboxCard.jsx`, API functions, mount in `OverviewPage.jsx`, and update changelog**
Add `fetchJukeboxAlbums` and `recordJukeboxPick` in `api.js`. Mount `JukeboxCard` on `OverviewPage.jsx` with collapsible expander and mode switch. Add changelog entry in `changelogData.js` and bump version in `package.json`.

- [ ] **Step 4: Run frontend tests to verify it passes**
Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/jukebox/ frontend/src/pages/OverviewPage.jsx frontend/src/api.js frontend/src/changelogData.js frontend/package.json
git commit -m "feat(jukebox): integrate Jukebox with mode toggle on Overview dashboard"
```

---

### Task 8: Full Verification, Security Review & Build Check

**Files:**
- Project-wide verification

- [ ] **Step 1: Run Python linting and formatting**
```bash
ruff check backend/app worker scripts
ruff format --check backend/app worker scripts
```
Expected: PASS with 0 errors.

- [ ] **Step 2: Run Python test suite**
```bash
PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
```
Expected: All tests PASS.

- [ ] **Step 3: Run Frontend linting, formatting and tests**
```bash
cd frontend && npm run lint && npm test && npm run build
```
Expected: ESLint 0 errors, Vitest all pass, Vite production build completes.

- [ ] **Step 4: Run differential-review security check**
Audit git diff against `AGENTS.md` rules (no secrets, parameterized queries, strict JWT auth, access checks).

- [ ] **Step 5: Final commit & push**
```bash
git status
git commit -m "feat: complete Album Jukebox feature with flat & arcade modes"
git push origin main
```
