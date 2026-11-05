# Jukebox 1001 Albums Generator — Feature Design Document

- **Date:** 2026-11-05
- **Status:** Approved by Builder Review / Ready for User Review
- **Origin:** Feature request for "1001 Albums You Must Hear Before You Die" generator within the existing Jukebox area.

---

## 1. Intent & Problem Statement
The existing Album Jukebox lets users spin and rediscover albums from their own saved/scrobbled catalog. However, users also want an intentional discovery vehicle for the classic musical canon: Robert Dimery's renowned book **"1001 Albums You Must Hear Before You Die"**.

This feature adds a dedicated **1001 Albums** mode to the Album Jukebox on the Overview page. Users can pull random classic albums from the 1001 list, narrow their selections by decade and genre, exclude albums they have already listened to, track their overall progress through the 1001 challenge, and jump directly into Spotify to play each record. In addition, genre filtering is unified across both the 1001 Albums generator and the standard user library Jukebox.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **1001 Albums Pool Switch:** Add a clean source toggle between **"My Library"** and **"1001 Albums"** in the Jukebox card on the Overview page.
- **Full Album Artwork Display:** Render high-quality album cover art for the selected 1001 album alongside artist name, album title, release year, and genres.
- **Lucky Dip & 3-Roll Session Limit:** Retain the familiar Lucky Dip spin and 3 re-rolls constraint for intentional listening sessions.
- **Decade Filtering:** Filter 1001 albums by release decade (spanning 1950s through 2020s).
- **Genre Filtering (Both Modes):**
  - Add genre filter chips to both "1001 Albums" and "My Library" modes.
  - Limit displayed genres to the top 10 parent genres (Rock, Pop, Electronic, Soul/R&B, Jazz, Punk, Hip Hop, Folk, Metal, Funk) to keep mobile layouts clean and prevent micro-genre clutter.
  - Support parent-genre keyword matching so selecting "Rock" matches library albums tagged with "indie rock", "classic rock", etc.
- **"Exclude Previously Played" Filter:**
  - A checkbox allowing users to omit albums they have already heard from the random pick pool.
- **Completion Tracking:**
  - **Auto-detection from Scrobbles:** Audio Scrobbler cross-references the user's scrobble history and pre-marks any 1001 albums where tracks have been scrobbled (noting that listening to tracks lets the user know they have at least heard some of it).
  - **Auto-mark on Spotify Play:** When the user taps "Open in Spotify", the app records the click and automatically marks that 1001 album as played.
  - **Manual Toggle with Persistent Override:** A visible completion tick on the album card allows the user to manually mark or unmark an album. Unmarking is saved as an explicit override so background or future passes never re-mark it.
- **Progress Tracker:** Display the user's overall progress through the 1001 challenge (e.g., `142 / 1001 completed (14%)`) in the 1001 Jukebox header.
- **Dual Theme Support:**
  - Support both **Flat Jukebox** (`FlatJukebox.jsx`) and the skeuomorphic **Retro Arcade Cabinet** (`RetroJukebox.jsx`).
  - Keep `RetroJukebox.jsx` and `RetroJukebox.module.css` protected, placing the source toggle cleanly at the `JukeboxCard` level without altering any retro CSS or layout.

### Non-Goals
- Standalone multi-page encyclopedia, tracklist viewer, or editorial review reader for all 1001 albums. The feature is focused on discovery and album-play generation within the Jukebox.
- Modifying or curating the canonical 1001 album list via the UI.
- Direct inline Spotify streaming (playback is launched in Spotify via deep-links).

### Anti-Goals
- **Do not restyle the Retro Jukebox:** `RetroJukebox.jsx` and `RetroJukebox.module.css` are protected components preserving original retro artwork and arcade aesthetics.
- **Do not clutter the mobile screen with 100+ subgenres:** Stick to the top 10 most common parent genres.
- **Do not call external Spotify APIs synchronously in request handlers:** The 1001 dataset and artwork URLs are bundled locally; user completion state is stored locally in PostgreSQL.
- **Do not bundle heavy binary images in the repository:** Album cover images use remote Spotify CDN URLs (`https://i.scdn.co/image/...`), keeping the repository and container images lean.

---

## 3. Data Architecture & Backend Design

### 3.1 Canonical 1001 Albums Dataset
A static curated JSON dataset bundled in the backend: `backend/app/data/1001_albums.json`.
Each record contains:
- `id`: Unique integer identifier (1–1001)
- `album_name`: Normalized album title
- `artist_name`: Normalized artist name
- `release_year`: Year of release (integer)
- `decade`: Decade string or integer (e.g., 1970)
- `genres`: Array of standardized parent genres (e.g., `["Rock", "Psychedelic"]`)
- `spotify_album_id`: Canonical Spotify album ID
- `spotify_url`: Deep-link URL (`https://open.spotify.com/album/...` or search fallback)
- `artwork_url`: Spotify CDN image URL

### 3.2 Database Model for User Completions
Create a new table `user_1001_album_completions` in `backend/app/models.py` (with Alembic migration):
```python
class User1001AlbumCompletion(Base):
    __tablename__ = "user_1001_album_completions"
    __table_args__ = (
        UniqueConstraint("user_id", "album_id", name="uq_user_1001_album_completion"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    album_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="manual", nullable=False) # "scrobble", "spotify_click", "manual", "manual_unmark"
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

**Manual Override & Scrobble Seeding Logic:**
- When `GET /jukebox/1001-albums` runs, if the user has no completion rows yet, an initial scrobble matching pass queries `listening_events` for matching `(artist_name, album_name)` and seeds records with `is_completed=True, source="scrobble"`.
- If a user manually unmarks an album, the backend updates `is_completed = False, source = "manual_unmark"`.
- Any subsequent scrobble matching uses `INSERT ... ON CONFLICT DO NOTHING`, guaranteeing that an album explicitly unmarked by the user is never re-marked as completed.
- Tapping "Open in Spotify" executes an idempotent mark: `is_completed = True, source = "spotify_click"`.

### 3.3 Backend API Endpoints
All endpoints live under `/jukebox/1001-albums`:

1. `GET /jukebox/1001-albums`:
   - Returns the full catalog of 1001 albums.
   - Includes user-specific metadata: `is_completed: bool` and `completed_at`.
   - Summary payload includes `total_albums: int`, `completed_count: int`, and `available_genres: list[str]`.

2. `POST /jukebox/1001-albums/{album_id}/toggle-completed`:
   - Toggles or sets the completion status for the current authenticated user.
   - Body accepts `{ is_completed?: bool, source?: "spotify_click" | "manual" }`.
   - Returns updated completion state and new total completed count.

---

## 4. Frontend & UX Architecture

### 4.1 Jukebox Header & Source Toggle
In `frontend/src/components/jukebox/JukeboxCard.jsx`:
- A clean segmented control at the top of the card:
  `[ 🎧 My Library ] [ 📖 1001 Albums ]`
- In **1001 Albums** mode:
  - Header displays progress: `Progress: 142 / 1001 (14%)` with a subtle progress bar or pill badge.
  - Subtitle updates to "1001 Albums You Must Hear Before You Die".

### 4.2 Jukebox Engine (`useJukeboxEngine.js`)
Extend the existing engine hook to accept either user albums or the 1001 albums catalog:
- Maintain independent filter state: `sourceMode: "library" | "1001"`.
- Support `excludeCompleted: boolean` filter in 1001 mode.
- Compute dynamic pools based on active filters (decade, parent genre, excludeCompleted).

### 4.3 Filter UI (`JukeboxFilters.jsx`)
- **Parent Genre Filtering (Unified):**
  - Displays the top 10 parent genres as pill buttons: Rock, Pop, Electronic, Soul, Jazz, Punk, Hip Hop, Folk, Metal, Funk.
  - In "1001 Albums" mode: matches against the album's assigned parent genres.
  - In "My Library" mode: matches parent keywords against Spotify micro-genres (e.g. "Rock" matches "indie rock", "hard rock", "classic rock").
- **Exclude Played Checkbox:**
  - Rendered when in 1001 Albums mode: `[ ] Exclude previously played albums`.
- **Decade Pills:**
  - Auto-populated from the available decades in the active pool (50s, 60s, 70s, 80s, 90s, 00s, 10s, 20s).

### 4.4 Pick Presentation & Completion Action
- **Flat Jukebox (`FlatJukebox.jsx`):**
  - Displays high-resolution album cover art inside the spinning vinyl / LP sleeve.
  - Next to the album title, render a completion checkmark button:
    - Checked (`✓ Played`) vs Unchecked (`○ Mark as played`).
    - Tapping toggles the status via `toggle1001AlbumCompleted`.
  - When the user taps **"Open in Spotify"**, the click handler automatically marks the album as played (`source="spotify_click"`).
- **Retro Jukebox (`RetroJukebox.jsx`):**
  - Source toggle lives cleanly on the outer card level.
  - Display album art and completed badge in the display panel.
  - Preserve all existing CSS animations, pastels, shadows, marquees, and turntable behaviors.

---

## 5. Security & Verification
- **User Isolation:** Completion records are strictly isolated by `current_user.id`.
- **Protected Components:** Zero modifications to `RetroJukebox.module.css` color variables or skeuomorphic styling.
- **Performance:** Client-side pool filtering for instantaneous spins (<16ms) without extra network round-trips.
- **Verification Plan:**
  - Unit tests for `User1001AlbumCompletion` SQLAlchemy model and migration.
  - API endpoint tests for `/jukebox/1001-albums` (filtering, completion toggles, scrobble auto-marking, persistent unmarking).
  - Frontend unit tests for `useJukeboxEngine.js`, `JukeboxFilters.jsx`, `FlatJukebox.jsx`, and `JukeboxCard.jsx`.
  - Impeccable review on desktop and mobile viewports.
