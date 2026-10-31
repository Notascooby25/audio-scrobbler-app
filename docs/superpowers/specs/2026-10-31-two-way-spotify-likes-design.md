# Two-Way Spotify Likes (Tracks & Albums) Design Document

**Date:** 2026-10-31  
**Status:** Draft  
**Scope:** Interactive two-way like/unlike sync with Spotify for tracks and albums across the app.

---

## 1. Intent & The Why

Users want the ability to save songs and albums they discover or browse directly within the app, reflecting immediately into their Spotify "Liked Songs" and "Saved Albums" libraries. Conversely, tapping a liked item should unlike/remove it from Spotify. Currently, the app only performs a one-way periodic background sync of liked tracks from Spotify into a read-only badge. This feature upgrades the heart badge into a responsive, two-way interactive control across the application.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Two-Way Track Likes:** Tapping an outline heart on any Spotify-linked track marks it liked in the app and saves it to Spotify (`PUT /v1/me/tracks`). Tapping a red heart unlikes it and removes it from Spotify (`DELETE /v1/me/tracks`).
- **Two-Way Album Likes:** Tapping an outline heart on any album in the Library Albums tab or on Album Jukebox cards saves the album to Spotify (`PUT /v1/me/albums`). Tapping a red heart removes it from Spotify (`DELETE /v1/me/albums`).
- **Instant UI Feedback:** Instant optimistic UI update with heart burst animation; automatic rollback with a helpful notice if the network or Spotify request fails.
- **Clear Feedback on Non-Spotify Tracks:** Scrobbles originating from non-Spotify sources (e.g. BBC Sounds, YouTube, or manual file imports) without a Spotify track/album ID display a simple notice: *"Only able to like tracks/albums played through Spotify"*.
- **OAuth Permissions Upgrade:** Add `user-library-modify` to the requested Spotify scopes. If an existing user's token lacks this scope, show a clear prompt to reconnect their Spotify account in Settings.
- **Omnipresent Track & Album Locations:**
  - Library Page: Tracks tab (list and grid views)
  - Library Page: Scrobbles tab (list and grid views)
  - Library Page: Albums tab (list and grid views)
  - Overview Page: Recent Scrobbles feed
  - Overview Page: Album Jukebox (flat view and card pick)

### Non-Goals
- Modifying or restyling the Retro Jukebox (`RetroJukebox.jsx` and `RetroJukebox.module.css` are protected components).
- Liking or following Artists (strictly tracks and albums).
- Complex heuristic fuzzy-searching for non-Spotify tracks during click (we guard with a friendly notice instead).

### Anti-Goals
- Calling Spotify API without rate-limit checks or handling HTTP 429 backoff.
- Desynchronizing the local database cache from Spotify (local DB must be kept in sync immediately on success).
- Blocking page loads or rendering while waiting for Spotify responses.

---

## 3. Constraints

- **Python (Backend):** Python 3.12, PEP 8, PEP 484 type hints, SQLAlchemy 2.0 mapped columns, Pydantic v2 schemas.
- **Frontend:** React 18, Vite, Standard ES Modules, strict adherence to `DESIGN.md` (Flat-By-Default, semantic color tokens, zero box-shadows, zero gradients).
- **Security:** Do not expose user tokens or secrets. OAuth state and refresh tokens encrypted with `REFRESH_TOKEN_KEY`. Ensure user ownership checks on all endpoints (`current_user.id`).

---

## 4. How It Works (Decisions Made)

### 4.1 OAuth Scope
- Update `SPOTIFY_SCOPES` in `backend/app/config.py` and `.env.example` to include `user-library-modify`:
  ```
  user-read-recently-played user-library-read user-library-modify user-read-currently-playing playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public
  ```

### 4.2 Backend Endpoints & Data Resolution
- **Album ID Resolution for Unliked Albums:**
  - For albums already in `SavedAlbum`, `spotify_album_id` is known directly.
  - For unliked albums in the Library Albums tab or Jukebox, the backend resolves the Spotify Album ID by checking `raw_metadata->'track'->'album'->>'id'` from the user's scrobbles for that album. If not found (e.g. external import), it uses a lightweight Spotify search query (`q=album:{name} artist:{artist}`). If no Spotify match is found, it cleanly returns HTTP 404 with a message explaining the album isn't available on Spotify.
- **Track & Album Like Payloads:**
  - `PUT /spotify/like-track/{track_id}`: Accepts optional JSON body `{"track_name": str, "artist_name": str, "album_name": str | None, "artwork_url": str | None}` to immediately populate non-nullable columns in `liked_tracks` without needing a second Spotify lookup.
  - `DELETE /spotify/like-track/{track_id}`: Removes the track from Spotify and removes it from `liked_tracks`.
  - `PUT /spotify/like-album/{album_id_or_name}`: Accepts optional JSON body `{"album_name": str, "artist_name": str, "artwork_url": str | None}`. Saves to Spotify and upserts into `saved_albums`.
  - `DELETE /spotify/like-album/{album_id}`: Removes the album from Spotify and removes it from `saved_albums`.
- **Error & Scope Handling:**
  - If Spotify returns HTTP 403 with insufficient scope, the endpoint returns HTTP 403 with `detail: "needs_spotify_reconnect"`.
  - If Spotify returns HTTP 429, respect `Retry-After` and return HTTP 429.

### 4.3 UI Locations & Interactions
- **Where Hearts Appear:**
  - **Library Page:**
    - Tracks tab (list and grid views)
    - Scrobbles tab (list and grid views)
    - Albums tab (list and grid views)
  - **Overview Page:**
    - Top Tracks list (`RankedList.jsx`)
    - Album Jukebox (`FlatJukebox.jsx` pick view)
  - **Connect / Home Page:**
    - Recent scrobbles activity feed (`ScrobbleList.jsx`)
- **Friend Profiles (Following):**
  - When viewing someone else's library (`isOwnLibrary = false`), hearts remain read-only badges indicating what *that user* has liked, with clicking disabled (matching how deletion and block tools are disabled on friend profiles). On your own library, they are interactive toggles for your own Spotify library.
- **`LikedHeart.jsx` Component:**
  - Upgraded to an accessible interactive button when `interactive={true}` and `onToggle` is passed.
  - Triggers a brief toast/notice when clicked on non-Spotify tracks: *"Only able to like tracks/albums played through Spotify"*.
  - When a 403 scope error occurs, notifies the user to reconnect Spotify in Settings.

---

## 5. What's Left to the Builder

- Exact toast notification styling for the non-Spotify notice (leveraging existing action notice toast patterns in `LibraryPage.jsx`).
- Unit test mock fixtures for Spotify Web API endpoints (happy path, 403 scope error, 429 rate limit backoff).
- Prettier formatting and version bump in `frontend/package.json` and `frontend/src/changelogData.js`.

