# Jukebox 1001 Albums Generator — Feature Design Document

- **Date:** 2026-11-05
- **Status:** Approved by User & Builder Review / Ready for Implementation Planning
- **Origin:** Feature request for "1001 Albums You Must Hear Before You Die" generator within the existing Jukebox area.

---

## 1. Intent & Problem Statement
The existing Album Jukebox lets users spin and rediscover albums from their own saved/scrobbled catalog. However, users also want an intentional discovery vehicle for the classic musical canon: Robert Dimery's renowned book **"1001 Albums You Must Hear Before You Die"**.

This feature adds a dedicated **1001 Albums** mode to the Album Jukebox on the Overview page. Users can pull random classic albums from the 1001 list, narrow their selections by decade and genre, exclude albums they have already listened to, track their overall progress through the 1001 challenge, confirm completed listening sessions, drill down into an interactive decade-by-decade checklist, and jump directly into Spotify to play each record. In addition, genre filtering is unified across both the 1001 Albums generator and the standard user library Jukebox.

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
- **Robust Completion Tracking:**
  - **90% Historical Track Threshold:** Auto-detection scans the user's scrobble history and only marks a 1001 album as completed if at least **90%** of its tracks have been scrobbled in `listening_events`. Single-track or casual shuffle plays never mark an album as completed.
  - **Post-Listen Confirmation Prompt:** When the user taps "Open in Spotify" on a pick, the Jukebox records the session. The next time the user visits the 1001 Jukebox, a prompt banner asks: *"Did you listen to the full album?"* with actions `[✓ Yes, mark played]` and `[✕ Not yet]`.
  - **Manual Toggle with Persistent Override:** A visible completion tick on the album card allows the user to manually mark or unmark an album. Unmarking is saved as an explicit override so background or future passes never re-mark it.
- **Interactive Progress Tracker & Checklist Modal:**
  - Display the user's overall progress through the 1001 challenge (e.g., `142 / 1001 (14%)`) with an interactive progress bar in the Jukebox header.
  - Tapping the progress bar opens the **1001 Albums Checklist Modal**:
    - Horizontally scrollable decade tabs (50s, 60s, 70s, 80s, 90s, 00s, 10s, 20s) with per-decade progress counts (e.g., `70s (34/180)`).
    - Scrollable album list showing thumbnail cover artwork, artist, album title, release year, and an interactive checkbox to view or toggle completion.
- **Dual Theme Support:**
  - Support both **Flat Jukebox** (`FlatJukebox.jsx`) and the skeuomorphic **Retro Arcade Cabinet** (`RetroJukebox.jsx`).
  - Keep `RetroJukebox.jsx` and `RetroJukebox.module.css` protected, placing the source toggle cleanly at the `JukeboxCard` level without altering any retro CSS or layout.

### Non-Goals
- Standalone multi-page encyclopedia, tracklist viewer, or editorial review reader for all 1001 albums. The feature is focused on discovery, tracking, and album-play generation within the Jukebox.
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
- `decade`: Decade integer (e.g., 1970)
- `genres`: Array of standardized parent genres (e.g., `["Rock", "Psychedelic"]`)
- `track_count`: Total track count on the standard release (integer, e.g., 10)
- `spotify_album_id`: Canonical Spotify album ID
- `spotify_url`: Deep-link URL (`https://open.spotify.com/album/...` or search fallback)
- `artwork_url`: Spotify CDN image URL

### 3.2 Database Model for User Completions & Recent Spins
Create two tables in `backend/app/models.py` (with Alembic migration):

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
    source: Mapped[str] = mapped_column(String(32), default="manual", nullable=False) # "scrobble_90pct", "confirmation_prompt", "manual", "manual_unmark"
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class User1001PendingConfirmation(Base):
    """Tracks albums opened in Spotify awaiting user confirmation next visit."""
    __tablename__ = "user_1001_pending_confirmations"
    __table_args__ = (
        UniqueConstraint("user_id", "album_id", name="uq_user_1001_pending_confirmation"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    album_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
```

**Completion Logic & 90% Scrobble Matching:**
1. **Initial 90% Scrobble Seeding:** When a user first opens the 1001 mode, a background or query pass compares `listening_events` to the 1001 list. An album is only seeded if:
   $$\frac{\text{distinct scrobbled tracks}}{\text{album.track\_count}} \ge 0.90$$
   This prevents single-track shuffle listens from counting.
2. **Persistent Manual Unmarking:** If a user unmarks an album, `is_completed` is set to `False` (`source="manual_unmark"`). Any subsequent auto-detection uses `INSERT ... ON CONFLICT DO NOTHING`, guaranteeing the user's manual unmark is never overwritten.
3. **Pending Confirmation on Spotify Click:** When the user taps "Open in Spotify" on a pick, a record is added to `user_1001_pending_confirmations`. Next time the user loads the 1001 Jukebox, any non-dismissed pending album displays the confirmation prompt banner.

### 3.3 Backend API Endpoints
All endpoints live under `/jukebox/1001-albums`:

1. `GET /jukebox/1001-albums`:
   - Returns the full catalog of 1001 albums.
   - Includes user-specific metadata: `is_completed: bool` and `completed_at`.
   - Returns pending confirmation album (if any).
   - Summary payload includes `total_albums: int`, `completed_count: int`, decade completion breakdown (`decade_stats: dict`), and `available_genres: list[str]`.

2. `POST /jukebox/1001-albums/{album_id}/toggle-completed`:
   - Toggles or sets the completion status for the current authenticated user.
   - Body accepts `{ is_completed: bool, source?: "confirmation_prompt" | "manual" }`.
   - Automatically clears any pending confirmation for this album.
   - Returns updated completion state and new total completed count.

3. `POST /jukebox/1001-albums/pending-play`:
   - Called when user clicks "Open in Spotify". Records the album in `user_1001_pending_confirmations`.

4. `POST /jukebox/1001-albums/dismiss-pending`:
   - Dismisses a pending confirmation without marking as completed (user clicked "Not yet").

---

## 4. Frontend & UX Architecture

### 4.1 Jukebox Header & Source Toggle
In `frontend/src/components/jukebox/JukeboxCard.jsx`:
- A clean segmented control at the top of the card:
  `[ 🎧 My Library ] [ 📖 1001 Albums ]`
- In **1001 Albums** mode:
  - Header displays interactive progress button: `Progress: 142 / 1001 (14%) ↗` with an animated or colored progress bar.
  - Tapping this bar opens the **Checklist Modal**.
  - Subtitle displays "1001 Albums You Must Hear Before You Die".

### 4.2 Confirmation Prompt Banner
When a pending confirmation exists:
- A prominent, friendly card banner appears above the turntable:
  *"Did you listen to [Album Title] by [Artist]?"*
  - `[✓ Yes, mark played]` (Calls `/toggle-completed` with `is_completed: true, source: "confirmation_prompt"`)
  - `[✕ Not yet]` (Calls `/dismiss-pending`)

### 4.3 Checklist Modal (`1001AlbumsChecklistModal.jsx`)
- Opened by clicking the progress bar.
- Header: Total progress bar (`142 / 1001 (14%)`) + close button (`✕`).
- Decade tabs row: `[50s] [60s] [70s] [80s] [90s] [00s] [10s] [20s]` with completion count badges.
- Album rows:
  - Thumbnail artwork (48x48 rounded).
  - Album Title & Artist Name.
  - Release year & parent genres.
  - Checkbox toggle for instant completion updates.

### 4.4 Jukebox Engine (`useJukeboxEngine.js`)
Extend the engine hook to support the 1001 catalog:
- Maintain independent filter state: `sourceMode: "library" | "1001"`.
- Support `excludeCompleted: boolean` filter in 1001 mode.
- Compute dynamic pools based on active filters (decade, parent genre, excludeCompleted).

### 4.5 Filter UI (`JukeboxFilters.jsx`)
- **Parent Genre Filtering (Unified):**
  - Displays the top 10 parent genres as pill buttons: Rock, Pop, Electronic, Soul, Jazz, Punk, Hip Hop, Folk, Metal, Funk.
  - In "1001 Albums" mode: matches against the album's assigned parent genres.
  - In "My Library" mode: matches parent keywords against Spotify micro-genres.
- **Exclude Played Checkbox:**
  - Rendered when in 1001 Albums mode: `[ ] Exclude previously played albums`.
- **Decade Pills:**
  - Auto-populated from the available decades in the active pool (50s through 20s).

### 4.6 Pick Presentation & Actions
- **Flat Jukebox (`FlatJukebox.jsx`):**
  - Displays high-resolution album cover art inside the spinning vinyl / LP sleeve.
  - Next to the album title, render a completion checkmark button:
    - Checked (`✓ Played`) vs Unchecked (`○ Mark as played`).
    - Tapping toggles the status via `toggle1001AlbumCompleted`.
  - When the user taps **"Open in Spotify"**, the click handler calls `/pending-play` so the Jukebox will prompt for confirmation on next visit.
- **Retro Jukebox (`RetroJukebox.jsx`):**
  - Source toggle lives cleanly on the outer card level.
  - Display album art and completed badge in the display panel.
  - Preserve all existing CSS animations, pastels, shadows, marquees, and turntable behaviors.

---

## 5. Security & Verification
- **User Isolation:** All completions and pending confirmations are strictly scoped by `current_user.id`.
- **Protected Components:** Zero modifications to `RetroJukebox.module.css` color variables or skeuomorphic styling.
- **Performance:** Client-side pool filtering for instantaneous spins (<16ms) without extra network round-trips.
- **Verification Plan:**
  - Unit tests for `User1001AlbumCompletion` and `User1001PendingConfirmation` models and migrations.
  - API endpoint tests for `/jukebox/1001-albums` (filtering, 90% scrobble threshold, pending confirmation, persistent unmarking).
  - Frontend unit tests for `useJukeboxEngine.js`, `JukeboxFilters.jsx`, `FlatJukebox.jsx`, and `1001AlbumsChecklistModal.jsx`.
  - Impeccable review on desktop and mobile viewports.
