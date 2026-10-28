# Design Document: Set List Tracking & Gig Scrobbling

**Date:** 2026-10-28  
**Topic:** Set List Tracking & Gig Attendance Logging (Setlist.fm Integration)  
**Status:** Approved by Reviewer / Ready for Human Sign-Off  
**Author:** Pair programmed with Antigravity  

---

## 1. Intent & The "Why"

Music lovers and concertgoers who use the Audio Scrobbler App attend live music events, festivals, and gigs. While regular music streaming platforms (Spotify, YouTube Music, Apple Music) track daily digital listening, they do not track in-person concert attendance, live performances, or festival bills. 

Concertgoers currently use [Setlist.fm](https://www.setlist.fm) to log attended gigs, view setlists, and track statistics like their most-seen artists and live song counts. This feature integrates Setlist.fm tracking natively into Audio Scrobbler:
1. Enabling users to easily find, log, and browse concerts they attended.
2. Prompting users to also log support acts on the same bill.
3. Automatically converting concert setlists into backdated scrobbles in their primary listening history.
4. Providing dedicated live music stats (Artists Seen, Songs Heard Live, Venues Visited) with full Setlist.fm import and export capabilities.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Main Navigation Hub:** A dedicated **Set Lists** section in the main app header.
- **Search & Filter:** Search Setlist.fm by headliner/artist with filters for Country (standard country selector), Venue, and Date/Year.
- **"I Was There" Logging:** One-click attendance logging displaying the date badge, venue, and full tracklist.
- **Support Acts Detection:** Automatically detect and prompt users to log support bands who performed at the same venue and date (with smart festival detection).
- **Automatic Scrobbling:** Automatically insert setlist tracks into `listening_events` (source: `setlistfm`), backdated to the evening of the concert and chronologically spaced without overlapping support acts.
- **Setlist.fm Historical Import:** Allow users to enter their Setlist.fm username in Settings/Set Lists and import their full historical attended concerts and setlists directly into their concert database and scrobble history.
- **Data Export:** Export all attended gigs, venues, and setlists to JSON and CSV for backup and portability.
- **Concert Statistics & Drilldowns:**
  - **My Gigs:** Chronological timeline of all attended concerts with individual tracklists and a "Refresh Setlist" action.
  - **Artists Seen:** Ranked leaderboard of artists seen live, expanding to show every gig and venue where they were seen.
  - **Songs Heard Live:** Ranked leaderboard of songs witnessed live across all concerts.
  - **Venues:** Ranked leaderboard of visited venues and festivals.
- **Accurate Deletion:** Deleting an erroneously logged gig requires a double confirmation modal and safely purges the associated concert scrobbles (and optionally linked support acts) from the listening library.
- **Strict Rate-Limit Compliance:** Never exceed Setlist.fm's limits: maximum 2 requests/second and 1,440 requests/day, coordinated across containers via PostgreSQL.

### Non-Goals (Deferred to Phase 2)
- **"Who You Went With" / Companion Tagging:** Tagging friends or scrobbler followers as attendees for a specific gig. (User noted: "eventually once basic concept working").
- **Manual Custom Setlist Creation:** Building an interactive setlist editor from scratch for unlisted basement gigs without Setlist.fm entries.
- **Ticket Stub / Photo Attachments:** Uploading photo attachments or ticket stubs.

### Anti-Goals
- **No Inline API Rate-Limit Bans:** Never query the Setlist.fm API synchronously during bulk operations or without local database caching.
- **No Duplicate Scrobbles:** Re-running an import or re-syncing an attended gig must never create duplicate scrobble entries in `listening_events`.
- **No UI Clutter or Breaking Design Tokens:** Follow `DESIGN.md` strictly (Flat-by-Default, zero drop-shadows, zero gradients, 0.5px hairline borders, compact data density).

---

## 3. User Experience & Workflows

### 3.1 Search & Log Attendance ("I Was There")
1. User navigates to the **Set Lists** tab in the main navigation.
2. In the Search bar, the user types an artist name (e.g., `Foo Fighters`).
3. Optional filters narrow down results:
   - **Country:** Standard dropdown of countries (defaulting to UK/All).
   - **Venue:** Text filter (e.g., `Anfield`).
   - **Date / Year:** Year or date filter (e.g., `2026` or `27/06/2026`).
4. Results display as structured cards with:
   - Date badge (Month, Day, Year).
   - Event title (Artist at Venue, City, Country).
   - Tour name or notes (if available).
   - Preview of setlist songs.
5. User clicks the green **"I WAS THERE"** button.
6. A support band prompt appears:
   - The backend queries Setlist.fm for other setlists at the same `venueId` and `date`.
   - *Club/Arena gig (1–5 other acts):* Checkbox list (e.g. `Die Spitz` and `Royel Otis`).
   - *Festival (>5 other acts):* Compact searchable multi-select list.
7. Upon confirmation:
   - Gig attendances are recorded for the headliner and checked support acts.
   - All tracks performed are converted into scrobbles in `listening_events` (support acts scheduled earlier in the evening, headliner following).
   - Success toast appears with quick links to view the concert in "My Gigs" or view new stats.

### 3.2 Setlist.fm Historical Account Import
1. In the **Set Lists** tab (or Settings), user enters their Setlist.fm username (e.g., `crispylettuce`).
2. User clicks **"Import Past Gigs"**.
3. The background worker asynchronously calls `GET /1.0/user/{userId}/attended`, strictly throttled at ≤2 requests/sec.
4. Each attended setlist is ingested as an independent attendance record (skipping secondary bill lookups to conserve daily quota).
5. The songs from all imported gigs are sequentially backdated into `listening_events` with `source='setlistfm'`.
6. Progress is tracked via an import progress indicator (e.g., `Imported 45 / 142 gigs...`).

### 3.3 Concert Statistics & Views
Within **Set Lists**, sub-navigation tabs allow switching between views:
- **My Gigs (Timeline):** Chronological list of attended gigs, with expandable tracklists, venue info, and support bands. Each gig card has a **"Refresh Setlist"** button to update setlists if songs were added on Setlist.fm post-show.
- **Artists Seen (Leaderboard):** Ranked by attendance count (e.g., `1. Public Service Broadcasting (5 gigs)`). Clicking an artist expands an accordion displaying every date and venue where they were seen.
- **Songs Heard (Leaderboard):** Ranked by live performance count (e.g., `1. Gagarin (5 times)`, `2. Go! (5 times)`).
- **Venues (Leaderboard):** Ranked by total visits (e.g., `1. Alexandra Palace (4 visits)`).
- **Export Data:** Download button generating `attended_gigs.json` and `attended_gigs.csv`.

### 3.4 Deleting / Un-logging a Gig
- Each logged gig has a delete action (`Delete Gig`).
- Triggering delete opens a double-confirmation modal:
  > *"Are you sure you want to remove Foo Fighters at Anfield (27 Jun 2026)? This will remove the 29 concert tracks from your scrobble listening history."*
- If support acts were logged with this concert, an option is presented:
  `[x] Also delete support acts logged with this show (Die Spitz, Royel Otis)` (checked by default).
- Upon confirmation, the selected `attended_concerts` records and their matching `listening_events` are purged.

---

## 4. Technical Architecture & Data Model

### 4.1 Database Models (SQLAlchemy 2.0 in `backend/app/models.py`)

#### `AttendedConcert`
```python
class AttendedConcert(Base):
    __tablename__ = "attended_concerts"
    __table_args__ = (
        UniqueConstraint("user_id", "setlist_id", name="uq_user_attended_setlist"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    setlist_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    artist_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    artist_mbid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    venue_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    country: Mapped[str] = mapped_column(String(128), nullable=False)
    event_date: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    tour_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    setlist_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_support_act: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    parent_setlist_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    raw_data: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    song_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

#### `SetlistCache`
```python
class SetlistCache(Base):
    __tablename__ = "setlist_cache"

    cache_key: Mapped[str] = mapped_column(String(255), primary_key=True)
    response_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

#### `SetlistApiUsage` (Cross-Container Rate Limiter)
```python
class SetlistApiUsage(Base):
    __tablename__ = "setlist_api_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_call_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    daily_date: Mapped[str] = mapped_column(String(10), nullable=False)  # 'YYYY-MM-DD'
    daily_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
```

### 4.2 Listening Event Integration (`ListeningEvent`)
Concert tracks are stored as standard scrobbles in `listening_events`:
- `user_id`: Current user ID.
- `track_id`: Synthetic URI `setlistfm:{setlist_id}:{song_index}`.
- `track_name`: Cleaned song name.
- `artist_name`: Performing artist name.
- `album_name`: Live at {venue_name} or None.
- `played_at`: Sequenced timestamp:
  - If headliner and support acts exist: support acts are sequenced starting at 6:45 PM / 7:30 PM; headliner starts at 8:45 PM.
  - Songs within a set are sequenced ~3.5 minutes apart.
- `duration_ms`: Estimated duration (210,000 ms / 3.5 minutes).
- `source`: `"setlistfm"`.
- `play_id`: Unique identifier `"setlistfm_{setlist_id}_{song_index}"`.
- `raw_metadata`: `{"setlist_id": setlist_id, "venue": venue_name, "is_live": True, "tour": tour_name}`.

When a gig is re-synced or refreshed:
- Existing scrobbles with `source='setlistfm'` and matching `setlist_id` are cleanly replaced to accommodate any track additions or re-orderings from Setlist.fm.

---

## 5. Setlist.fm API & Rate Limit Handling

### Limits & Configuration
- **Rate Limit:** Strict max 2 requests per second; max 1,440 requests per 24 hours.
- **Config:** `SETLIST_FM_API_KEY` stored in `.env` / environment variable. Never exposed to the frontend or committed.
- **Headers:** `Accept: application/json`, `x-api-key: {SETLIST_FM_API_KEY}`.

### Rate Limiter Implementation
A central PostgreSQL-backed rate-limiting client (`backend/app/services/setlist_service.py`):
1. Uses `SetlistApiUsage` in PostgreSQL so both `backend` and `worker` Docker containers share the exact same rate limit window (guaranteeing minimum 550ms delay between calls).
2. Pauses historical imports if daily call quota (1,400 safety cap) is reached, resuming the following day.
3. Automatically caches search and setlist responses in `setlist_cache` (TTL: 7 days for historical setlists, 1 day for recent).
4. Handles HTTP 429 backoff gracefully.

---

## 6. Frontend Architecture & Design

### Navigation & Views
- **Header:** Add `Set Lists` item in primary navigation.
- **Sub-Tabs:** Segmented tabs for `[My Gigs] [Artists Seen] [Songs Heard] [Venues] [+ Log a Gig]`.
- **Search Bar:** Flat search bar with clean dropdown pills for Country, Venue, and Year.
- **Cards & Accordions:** 12px rounded cards with 0.5px hairline border (`#333` in dark mode, `#E5E5E5` in light mode).
- **Leaderboards:** Compact data rows showing ranking, artist/song name, and pill badge with gig count.
- **Double Confirmation Modal:** Reusable danger modal for un-logging a concert and wiping related scrobbles, with option to include support acts.

---

## 7. Security & Privacy Review

- **API Secret Storage:** `SETLIST_FM_API_KEY` is server-side only.
- **User Isolation:** All queries filter by authenticated `user_id`. Users cannot view or delete another user's gigs unless following permission allows view-only.
- **Input Validation:** Pydantic v2 schemas for all search and log endpoints (`SetlistSearchQuery`, `LogAttendanceRequest`, `SetlistImportRequest`).
- **Sanitization:** All external strings from Setlist.fm (song titles, artist names, tour names, venue notes) are trimmed and sanitized against XSS before database insertion and UI rendering.

---

## 8. Builder Calls & Decisions Settled

The reviewer highlighted several edge cases which have been settled as follows:
1. **Support Act Timing:** Support acts are sequenced chronologically earlier in the evening (e.g. 6:45 PM and 7:30 PM), with the headliner at 8:45 PM, ensuring scrobbles never overlap or collide in the user's listening history.
2. **Historical Import Quota Protection:** During bulk Setlist.fm account import, each attended gig returned by the user's profile is imported directly without triggering secondary support-act searches, preserving daily API quota and processing 140+ gigs in a single batch.
3. **Cross-Container Rate Limiting:** A PostgreSQL table `setlist_api_usage` acts as the shared rate-limiter, ensuring the `backend` and `worker` containers never collide or exceed the 2 req/sec or 1,440/day Setlist.fm limits.
4. **Delete Cascade with Support Acts:** The double-confirmation delete modal includes a pre-checked box to delete linked support acts and their scrobbles along with the headliner, keeping data completely clean.
5. **Re-sync / Refresh Action:** Each gig card in "My Gigs" has a "Refresh Setlist" action that invalidates the local cache and re-scrobbles the show if community members added missing songs on Setlist.fm after the event.
