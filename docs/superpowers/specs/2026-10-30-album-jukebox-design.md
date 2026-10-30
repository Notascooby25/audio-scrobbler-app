# Album Jukebox — Feature Design Document

- **Date:** 2026-10-30
- **Status:** Draft / Pending User Approval
- **Origin:** Feature request & spec by brother, adapted to Audio Scrobbler App architecture.

---

## 1. Intent & Problem Statement
Streaming algorithms and shuffle feeds trap listeners in repetitive loops of single tracks. The **Album Jukebox** brings intentional, whole-album listening back to the user's music routine.

It solves choice paralysis through two constraints:
1. **Lucky Dip:** Pulls a single album from the user's saved/favourited catalog (or filtered subset).
2. **Commitment Rule (3 Re-Rolls Max):** Once you spin Lucky Dip, you receive 3 re-rolls maximum before the controls lock. You must commit to an album (by clicking "Open in Spotify") to unlock the next listening session.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- Display an **Album of the Day** on app launch that is stable for the local calendar day and independent of filters.
- Allow users to filter their album collection by **Artist**, **Decade (1950s–2020s)**, **Genre**, **Length (<35m, 35–50m, >50m)**, and **Added Date**.
- Support 4 pick modes: **Any** (default), **Least played**, **Most played**, and **Recently added**. The sorted modes draw uniformly from the top/bottom 25% pool.
- Enforce the **3-roll session rule**: mid-session spins count toward the roll limit; "Open in Spotify" commits the session and resets the count for the next listen.
- Provide a dual aesthetic: **Clean Flat Utility** by default (conforming to `DESIGN.md`), with an instant toggle to the full **Retro Skeuomorphic Arcade Cabinet** (featuring the animated claw, marquee, and turntable from the brother's original spec).
- Integrate cleanly into the **Overview Page** (`frontend/src/pages/OverviewPage.jsx`) alongside the Rediscover feature.

### Non-Goals
- Internal in-app audio playback or streaming controls (the Jukebox directs the user to listen in Spotify).
- Social sharing, multi-user rooms, or public voting.
- Manual tagging or complex mood analysis (deferred to a future release to avoid fragile Spotify audio analysis dependencies).

### Anti-Goals
- Do not make the app feel cluttered or break the clean flat design system (`DESIGN.md`). The arcade cabinet is an opt-in toggle, not the default styling.
- Do not call Spotify APIs synchronously during HTTP requests. All album library syncing runs through the asynchronous background worker.

---

## 3. Data Architecture & Backend Design

### 3.1 Database Models
Create a new table `saved_albums` in `backend/app/models.py` (and Alembic migration):
```python
class SavedAlbum(Base):
    __tablename__ = "saved_albums"
    __table_args__ = (
        UniqueConstraint("user_id", "spotify_album_id", name="uq_saved_album_user_spotify_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    spotify_album_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    album_name: Mapped[str] = mapped_column(String(255), nullable=False)
    artist_name: Mapped[str] = mapped_column(String(255), nullable=False)
    release_date: Mapped[str | None] = mapped_column(String(32), nullable=True) # YYYY or YYYY-MM-DD
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genres: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    artwork_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    spotify_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_picked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

Add worker tracking columns to `UserScrobbleSettings`:
- `saved_albums_sync_enabled: Mapped[bool] = mapped_column(Boolean, default=True)`
- `saved_albums_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)`
- `saved_albums_backfill_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)`

Add user preference:
- `jukebox_source: Mapped[str] = mapped_column(String(32), default="spotify_saved", nullable=False)` (options: `"spotify_saved"` or `"library_archive"`)

### 3.2 Spotify Background Sync (`worker/`) & Metadata Enrichment
- Mirror the incremental pagination pattern used in `sync_liked_tracks_for_user`:
  - Worker calls Spotify `/v1/me/albums` with `limit=50`.
  - Normalizes release year, album duration (sum of track durations), artwork URL, and record label.
  - Submits batches to backend via internal route `POST /internal/users/{user_id}/saved-albums`.
- **Genre Resolution:** Because Spotify album endpoints omit genres, the worker maps the primary artist's Spotify ID against the app's existing `genre_cache` (or enriches in batches of up to 50 artists via `/v1/artists?ids=...`).

### 3.3 Backend API Endpoints & Selection Architecture
- **Client-Side Filtering & Selection:**
  - `GET /api/jukebox/albums`: Returns the user's saved albums (lightweight payload). Filtering, indicator lights, and the 4-mode 25% pool sampling run client-side for immediate responsiveness.
- **Roll Persistence:**
  - `POST /api/jukebox/record-pick`: Persists `last_picked_at = now()` when an album is revealed.
  - `GET /api/jukebox/daily`: Returns the deterministic Album of the Day (seeded by local calendar date `YYYY-MM-DD`).

### 3.4 Fallback Source (`library_archive`) & Empty States
- **Library Archive Fallback:** When selected in settings (or if 0 Spotify saved albums exist), the backend synthesizes the top 100 most-scrobbled albums from `listening_events`.
- **Empty Filter State:** When active filters match 0 albums, Lucky Dip and Re-roll are disabled with a clean "Clear filters" action.

---

## 4. Frontend & UX Architecture

### 4.1 Component Breakdown
- `frontend/src/components/jukebox/JukeboxCard.jsx`:
  - Placed on `OverviewPage.jsx` directly above or below `RediscoverCard`.
  - Supports collapsible view / expandable full Jukebox mode.
  - Contains mode toggle: `[⚡ Flat View] ↔ [🕹️ Arcade View]`.
- `frontend/src/components/jukebox/FlatJukebox.jsx`:
  - Follows `DESIGN.md`: clean borders (`--color-border`), dynamic accent tokens (`--color-primary`), card containers (`--color-surface`).
  - Flat vector turntable with spinning CSS animation during rolls.
  - Active filter badges, lucky dip button, and 3-roll quota badge.
- `frontend/src/components/jukebox/RetroJukebox.jsx`:
  - Full faithful port of the brother's complete standalone CSS/JS mockup (arched retro cabinet, marquees, indicator lamps, mechanical claw grabber, vinyl platter, and tone arm animation) wrapped as a clean React component.
- `frontend/src/components/jukebox/JukeboxFilters.jsx`:
  - Collapsible filter accordion: Artist text search, Decade chips, Genre chips, Length chips, and Added Date chips.

### 4.2 Interaction Rules & Session State
- **Session Lifecycle:**
  - Initial load shows **Album of the Day** (no rolls spent).
  - Tapping **Lucky Dip** initializes a listening session with `rollsLeft = 3`.
  - Tapping **Re-roll** (or Lucky Dip mid-session) spends 1 roll.
  - When `rollsLeft === 0`, Lucky Dip and Re-roll disable with message: *"No more rolls – give it a spin!"*.
  - Tapping **Open in Spotify** opens the album in Spotify in a new tab and marks the session committed.
  - Session state persists in `sessionStorage` so refreshing a tab doesn't immediately cheat the roll limit, but closing the tab starts fresh.

---

## 5. Security & Verification
- Strict user isolation: user can only query and pick from their own saved albums.
- Standard backend authentication via JWT token.
- Background sync secured via `WORKER_INGESTION_TOKEN`.
- Full test suite:
  - Worker unit tests for `/v1/me/albums` ingestion and watermark handling.
  - Backend API tests for `/api/jukebox/*` query filters and roll limits.
  - Frontend component tests for roll exhaustion, theme mode toggle, and filter math.
