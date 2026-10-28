# YouTube Music & Concert Scrobbler Design Spec

## 1. Intent and Why

Many music lovers discover and listen to full live concerts, in-studio performances, and festival sets on YouTube — particularly iconic music hubs like **NPR Music (Tiny Desk Concerts)**, **KEXP (Live on KEXP)**, and **BBC Music (Live Lounge, Glastonbury, Radio 1 Sessions)**.

Currently, the Audio Scrobbler App supports background syncing from Spotify, live tracklist extraction and scrobbling from BBC Sounds (via Scope Creep), and historical file imports from YouTube Takeout JSON. However, when a user finishes watching a live concert or session on YouTube, there is no way to quickly extract the setlist and scrobble the performance into their listening history.

This feature replicates the proven BBC Sounds Scope Creep workflow for YouTube video content:
1. Save and browse followed music channels (e.g. NPR Music, KEXP, BBC Music).
2. Select a channel to view recent concert uploads (via public channel feed) or search for specific sessions, with direct video URL paste also supported.
3. Automatically extract the tracklist (from description timestamps, setlist sections, or title patterns).
4. Review and select tracks, pick the played date and time, and scrobble them directly into `listening_events` (with the option to also export them to a Spotify playlist).

---

## 2. User Experience & Workflow

### 2.1 Placement in App
- **Settings > Scrobble Tab:** Located alongside the BBC Sounds Scope Creep section in a clean segmented tab (`BBC Sounds` | `YouTube Video`) or distinct card block.
- **Connect Hub (`/connect`):** The Radio/Tools card on `/connect` highlights both BBC Sounds and YouTube Scrobbler shortcuts.

### 2.2 Followed Channels
- A list of followed music channels with channel avatar/icon, channel title, and unfollow button.
- Default quick-add chips for new users: **NPR Music** (`@nprmusic`), **KEXP** (`@kexp`), **BBC Music** (`@BBCMusic`).
- An "+ Add Channel" button allowing users to follow any YouTube channel by handle (`@nprmusic`), channel ID (`UC4eYXhJI4-7wSWc8UNUu4HA`), or channel URL.

### 2.3 Video / Session Discovery
- **Recent Channel Uploads:** Selecting a followed channel automatically loads its 15 most recent uploads in a quick-select dropdown/picker (matching BBC Scope Creep's recent broadcast episodes flow).
- **Channel Search:** When a channel is selected, a search input allows searching that channel's concert archive (e.g., typing "Dua Lipa", "Fontaines D.C.", or "Ezra Collective").
- **Direct Video URL Input:** A fast fallback field allows pasting any YouTube video link directly (`https://www.youtube.com/watch?v=...`, `https://youtu.be/...`).

### 2.4 Tracklist Extraction & Review
- Once a video is loaded, the app displays:
  - Video title, thumbnail, channel name, and duration.
  - Extracted setlist table with:
    - Checkbox per track (selected by default).
    - Track title and artist name (with inline editable inputs so users can tweak misparsed or idiosyncratic titles).
    - Track offset / start timestamp and estimated duration.
    - Artwork thumbnail (resolved via iTunes/Deezer search or video thumbnail).
  - If a video is a single live performance without a multi-track setlist (e.g. a BBC Live Lounge single song like "Bruno Mars - All I Ask"), the system parses the single song and artist from the title.

### 2.5 Scrobbling & Spotify Playlist Export
- **Listened At:** Date-time picker defaulting to current time. Offsets are added to this base time so tracks are scrobbled in sequence.
- **Scrobble Button:** "Scrobble N Tracks" ingests records into `listening_events` with `source="youtube"`.
  - Repeat listens are fully supported: `play_id` embeds the listening timestamp (`f"yt_{video_id}_{index}_{int(played_at.timestamp())}"`) so repeat concert viewings over time do not collide with earlier listens.
- **Export to Spotify:** Reuses the existing playlist creation/appending service. For tracks without a cached Spotify URI, Spotify search is performed on-demand during the export action, strictly preserving the repo rule against inline Spotify API calls during regular fetch/scrobble requests.

---

## 3. Architecture & Technical Design

### 3.1 Data Model & Database Migration
- **Table:** `followed_youtube_channels`
  - `id`: Integer primary key, autoincrement.
  - `user_id`: Integer, foreign key / index to `users.id`.
  - `channel_id`: String(64), index, unique with `user_id`.
  - `channel_handle`: String(128), nullable (e.g. `@nprmusic`).
  - `title`: String(255), not null.
  - `image_url`: Text, nullable.
  - `created_at`: DateTime, default UTC now.
  - `UniqueConstraint("user_id", "channel_id", name="uq_followed_youtube_channel_user")`
- **Alembic Migration:** `0019_add_followed_youtube_channels.py`.

### 3.2 Backend Service (`backend/app/services/youtube_service.py`)
- **Channel Info & Resolution:**
  - `resolve_channel_info(url_or_handle: str) -> dict`: Resolves handle or channel URL to `channel_id`, `title`, and `image_url`. Uses standard HTTP headers with EU consent cookie (`SOCS`) to guarantee reliable responses without API key requirements.
- **Recent Channel Videos:**
  - `get_channel_recent_videos(channel_id: str) -> list[dict]`: Parses YouTube's public channel RSS feed (`https://www.youtube.com/feeds/videos.xml?channel_id=...`) to return recent uploads with video ID, title, thumbnail, and published date.
- **Channel / Video Search:**
  - `search_youtube_videos(query: str, channel_title: str | None = None) -> list[dict]`: Searches YouTube results, parsing `videoId`, `title`, `channel`, `duration`, and thumbnail.
- **Tracklist Extraction Engine:**
  - `extract_youtube_tracklist(video_id: str) -> dict`:
    - Retrieves video details via watch page player response / InnerTube player endpoints.
    - Extracts `title`, `author`, `length_seconds`, `thumbnail_url`, and full `description`.
    - **Parsing Rules:**
      1. **Timestamped lines:** Regex for timestamps (`(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:]?\s*(.+)` or `(.+?)\s*[-–—:]?\s*(\d{1,2}:\d{2}(?::\d{2})?)`). Computes offsets and durations.
      2. **Setlist blocks:** Identifies headers like `SET LIST`, `Setlist:`, `Songs:`, `Tracklist:`, `Tracks:`. Strips quote characters (`"`, `“`, `”`) and bullet points.
      3. **Single performance fallback:** If no multi-song list is found, parses `Artist - Song` from the video title.
    - **Artwork Enrichment:** Looks up each extracted track in `ArtworkCache` / iTunes / Deezer (no Spotify API calls on fetch path).

### 3.3 Backend API Endpoints (`backend/app/api/tools.py`)
- `GET /tools/youtube/followed-channels` — list followed channels for current user.
- `POST /tools/youtube/followed-channels` — follow a channel (`{"url_or_handle": "@nprmusic"}`).
- `DELETE /tools/youtube/followed-channels/{channel_id}` — unfollow a channel.
- `GET /tools/youtube/followed-channels/{channel_id}/videos` — list recent uploads for channel.
- `GET /tools/youtube/search?q=...&channel=...` — search videos for a channel or query.
- `POST /tools/youtube/fetch` — fetch metadata and extracted tracklist for a video (`{"url_or_id": "..."}`).
- `POST /tools/youtube/scrobble` — scrobble selected tracks to `listening_events`.
- `POST /tools/youtube/playlist` — export tracks to Spotify playlist (searches Spotify tracks on-demand).

### 3.4 Ingestion & Deduplication
- Scrobble entries are saved to `listening_events` with:
  - `source = "youtube"`
  - `play_id = f"yt_{video_id}_{index}_{int(played_at.timestamp())}"`
  - `track_id = f"youtube:{clean_artist}:{clean_title}"` (or Spotify URI if known)
  - `duration_ms = track.duration_seconds * 1000` (or derived from video length)
  - `played_at = base_time + timedelta(seconds=track.offset_seconds)`

### 3.5 Frontend Components
- `frontend/src/components/YouTubeScrobblerTools.jsx`: Complete component providing channel pills, recent video selector, search bar, video card, editable tracklist table, played-at selector, scrobble button, and Spotify playlist export modal.
- `frontend/src/pages/SettingsPage.jsx`: Renders segmented tab or toggle between BBC Sounds and YouTube Video Scrobbler in Settings > Scrobble.

---

## 4. Constraints & Non-Goals

- **Non-Goals:**
  - Automated continuous background scraping of personal YouTube accounts (Google Takeout file import already handles historical archives).
  - Video streaming or playing video files within the app.
- **Constraints:**
  - Zero external paid API dependencies: Must work reliably out of the box on self-hosted instances without requiring a Google Cloud API Key.
  - Strict adherence to `DESIGN.md`: Flat utilitarian design, 0.5px hairline borders, `#0066FF` accent, Inter font, no shadows, no gradients.
  - Strict adherence to Spotify rate limiting: No Spotify API calls inline during fetch; on-demand only for playlist export.
  - Full test coverage on Python backend (Ruff, Pytest, Alembic) and React frontend (ESLint, Vitest).
