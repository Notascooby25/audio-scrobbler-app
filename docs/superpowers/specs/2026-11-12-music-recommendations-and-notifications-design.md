# Design Specification: Music Recommendations & Notification Stream Overhaul

**Date:** 2026-11-12  
**Status:** Approved by Reviewer & Architect  
**Domain:** Full Stack Web Application (FastAPI backend + React Vite frontend)

---

## 1. Intent & The "Why"
- **Recommendations between friends:** The app is a personal listening tracker for the owner and their followers. Sharing music via Spotify is clunky and easily missed. A native, lightweight way for a user to recommend a song, album, or artist to people they follow creates a direct social loop. When the recipient logs into the app, the discovery experience begins immediately in the **Play** section (alongside Jukebox and Rediscover).
- **Decluttering notifications:** Currently, all notifications are permanently stored and never deleted, causing a clogged list in Settings. Notifications need individual dismissal, a "Clear read notifications" action, and an automated TTL (retention policy) to keep the inbox fresh and relevant.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **One-Tap Share UI:** A share icon adjacent to the heart icon on scrobble and library lists/grids.
2. **Follower Selection Modal:** Clean modal allowing the user to pick someone they follow (`getFollowing`), with an optional short text comment.
3. **Play Page Recommendations Hero:** A "Recommended by Friends" card at Position 1 (the very top of the Play page, above the Jukebox) across all 3 skins (`Classic`, `Sleeve`, `Timeline`).
4. **Queue & Lifecycle:**
   - Multiple pending recommendations display in a compact stack/queue (showing the top item, with simple `< 1 of 3 >` pagination arrows and badge count).
   - Clicking "Play on Spotify" launches Spotify and transitions the recommendation to "listened", popping it from the active queue.
   - A manual `×` dismiss button marks it dismissed without playing.
   - When no pending recommendations exist, the card hides completely.
5. **Notification System Overhaul:**
   - In-app notification creation with direct link `link="/play"`.
   - "Clear read" button in Settings notifications panel (`DELETE /api/notifications?read_only=true`).
   - Individual `×` delete icon per notification (`DELETE /api/notifications/{id}`).
   - Automatic cleanup of notifications older than 30 days during maintenance.

### Non-Goals
- Complex back-and-forth messaging or chat threads.
- Public recommendation walls or social feeds (strictly 1-to-1 between followed users).
- Web Push alerts for recommendations (avoids unwanted device push spam; notifications remain in-app).

### Anti-Goals
- Cluttering the Play page when there are no recommendations.
- Breaking contrast in Grid view over light or dark album artwork.
- Calling external Spotify APIs inline on web requests.

---

## 3. User Experience & Design Decided

### Share / Recommend Button
- Placed immediately to the left of the `LikedHeart` component in list view and grid view.
- **Grid View Styling:** Encased in a semi-transparent dark circle/pill overlay (`background: rgba(0,0,0,0.65)` with backdrop filter) matching the heart button's visual contrast on top of any artwork color.
- Clicking the share icon opens `RecommendModal`:
  - Shows list of followed users (from `GET /api/users/following`).
  - Optional textarea: "Add a note (optional)".
  - "Send Recommendation" action button with immediate toast feedback.

### Play Page (`/play`)
- Located at **Position 1** (very top of the page, above JukeboxCard).
- Integrated consistently into `OverviewPage.jsx`, `SleevePlayPage.jsx`, and `TimelinePlayPage.jsx`.
- Shows:
  - Friend's display name ("*User X recommended:*")
  - Item metadata (Track title / Album / Artist name)
  - Album artwork
  - Friend's optional note (in italics)
  - "Play on Spotify" primary CTA (opens Spotify URI/Web link)
  - Dismiss `×` button.
  - If multiple recommendations exist: `< 1 of N >` controls.
- Dismissal behavior:
  - Clicking "Play on Spotify" immediately calls the backend to set `status = "listened"` and opens the track/album on Spotify.
  - Clicking `×` sets `status = "dismissed"`.
  - In both cases, the item leaves the active queue.

### Notifications Stream
- Recommendation triggers an in-app notification for the recipient:
  - Title: *"Music Recommendation"*
  - Message: *"{Sender} recommended {item_title} by {artist_name}"*
  - Type: `"recommendation"`
  - Link: `"/play"`
- Notifications panel in Settings:
  - Add "Clear read" button to purge read notifications.
  - Add individual `×` delete icon per notification.
  - Automatic cleanup of notifications older than 30 days.

---

## 4. Technical Architecture & Constraints

### Database Schema Changes
1. **`music_recommendations` table:**
   - `id: int (PK)`
   - `sender_id: int (FK -> users.id, index)`
   - `receiver_id: int (FK -> users.id, index)`
   - `item_type: str(16)` ("track", "album", "artist")
   - `title: str(255)`
   - `artist_name: str(255)`
   - `album_name: str(255) | None`
   - `image_url: str | None`
   - `spotify_uri: str | None`
   - `spotify_url: str | None`
   - `note: str(280) | None`
   - `status: str(16)` ("pending", "listened", "dismissed", default="pending", index)
   - `created_at: datetime (UTC)`
   - `updated_at: datetime (UTC)`

2. **`notifications` table updates:**
   - Add optional `link: str | None` field to redirect user on click (e.g., `/play`).

### API Endpoints
- `POST /api/recommendations`: Create recommendation (validates sender follows recipient, creates DB record + notification).
- `GET /api/recommendations/active`: List `status == "pending"` recommendations for current user.
- `PATCH /api/recommendations/{id}/status`: Update status to `"listened"` or `"dismissed"`.
- `DELETE /api/notifications/{id}`: Delete specific notification.
- `DELETE /api/notifications`: Delete notifications (`read_only: bool = True`).

---

## 5. Architectural Calls Made
- **Permissions:** You can recommend music to anyone you follow (`GET /api/users/following`).
- **Play Page Stack:** Compact card showing 1 item at a time with `< 1 of N >` pager arrows if multiple friends have recommended items.
- **Skins:** Fully integrated across Classic, Sleeve, and Timeline skins.
- **Notifications Scope:** In-app notification creation with a "Clear read" button and per-item delete, leaving unread alerts safe from accidental mass deletion.
