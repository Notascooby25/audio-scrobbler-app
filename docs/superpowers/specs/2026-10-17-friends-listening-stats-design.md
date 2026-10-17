# Design Document: Friends Listening Stats in Reports

**Date:** 2026-10-17  
**Status:** Draft  
**Target:** Audio Scrobbler App (Web Frontend & Backend API)

---

## 1. Intent and Why

Spotify provides a weekly social feature showing "Listening stats with friends": identifying top mutual artists, top shared tracks, and a minutes-listened leaderboard among friends.

Audio Scrobbler App currently has follower functionality (`GET /users/me/following`) and individual user reports (`/reports?userId=...`), but lacks a combined view that surfaces mutual listening and friendly competition. Users want to see how their taste overlaps with their circle and compare total listening time without manually navigating each friend's profile.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Compare with Friends Button:** A clear button in the Reports page toolbar/controls (`[ 👥 Compare with Friends ]`) that toggles the friends comparison panel.
- **Top Artists with Friends:** Displays up to 5 artists listened to by the current user and at least one followed friend in the selected date range. Shows the total combined scrobbles and a breakdown of each person's individual scrobbles (e.g. `You (42) · Sarah (38) · Dave (19) — 99 total`).
- **Top Songs with Friends:** Displays up to 5 tracks listened to by the current user and at least one followed friend in the selected date range, showing total plays and individual counts.
- **Minutes Listened Leaderboard:** A ranked leaderboard comparing total listening minutes (derived from track duration or scrobble count × duration) across the user and all followed users for the selected period.
- **Date Range Reactive:** Responds dynamically to the standard `DateRangeSelector` on Reports (`last.week`, `last.month`, `last.year`, `all.time`, or custom ranges).
- **Graceful Empty States:**
  - If following no one: Friendly card prompting the user to discover and follow friends on the Following page.
  - If friends have no listening data in the range: Leaderboard shows friends with 0 min, and shared lists indicate no mutual music yet.
  - If no shared artists/songs: Explicit indicator that no music overlap was found in this time window.

### Non-Goals
- Public leaderboards (comparisons are strictly private to followed accounts).
- Modifying or replacing existing personal report charts (this is an additive section).
- Real-time websocket pushes (standard HTTP fetch on toggle / range change is sufficient).

### Anti-Goals
- **No slow N+1 queries:** Do not query each followed friend's history sequentially. Use a single optimized SQL query scoped to `user_id IN (:user_id, :followed_ids...)`.
- **No privacy leaks:** Users must not be able to compare with arbitrary user IDs they do not follow. Respect existing follower permissions and blocked items (`not_blocked_clause`).
- **No design inconsistency:** Do not introduce gradients, heavy drop-shadows, or off-brand colors (strictly follow `DESIGN.md`: flat-by-default, hairline borders, #0066FF accent).

---

## 3. User Decisions (Settled in Brainstorming)
- **Placement:** Embedded directly in the `/reports` page, toggled via a dedicated `[ 👥 Compare with Friends ]` button.
- **Criteria for "With Friends":** Requires shared listening (the user and at least one friend listened to the same artist/track within the period).
- **Presentation:** 3 cards side-by-side (or stacked on mobile):
  1. Top Artists with Friends (up to 5, with individual scrobble breakdown).
  2. Top Songs with Friends (up to 5, with individual scrobble breakdown).
  3. Minutes Listened (leaderboard with rank, user avatar/name, and minutes).
- **State persistence:** The toggle state is kept in local component state (or optionally session preference). When closed, regular Reports view is unchanged.

---

## 4. Technical Architecture & Constraints

### Backend API
- **Endpoint:** `GET /reports/friends-comparison`
- **Query Parameters:**
  - `start_date: datetime | None`
  - `end_date: datetime | None`
  - `range: str | None` (preset support)
- **Authorization:** Standard JWT Bearer token (`current_user`).
- **Logic:**
  1. Retrieve active followed user IDs for `current_user.id` from `user_follows`.
  2. If followed list is empty, return `{ "has_friends": False, "top_artists": [], "top_tracks": [], "leaderboard": [] }`.
  3. Query `listening_events` filtered by:
     - `user_id IN ([current_user.id] + followed_ids)`
     - `listened_at >= start_date AND listened_at <= end_date`
     - Exclude blocked items via `not_blocked_clause`.
  4. Aggregate for **Top Artists**:
     - Group by `artist_name`, collecting distinct user IDs and sum of scrobbles per user.
     - Filter to artists where distinct users >= 2 (and includes `current_user.id`).
     - Order by combined scrobbles DESC, LIMIT 5.
  5. Aggregate for **Top Tracks**:
     - Group by `track_name`, `artist_name`, collecting distinct user IDs and per-user play counts.
     - Filter to tracks where distinct users >= 2 (and includes `current_user.id`).
     - Order by combined scrobbles DESC, LIMIT 5.
  6. Aggregate for **Leaderboard**:
     - Group by `user_id`.
     - Sum `COALESCE(duration_ms, 180000) / 60000.0` (minutes) and count of scrobbles.
     - Join with `users` table for `username` and profile details.
     - Order by minutes DESC.
- **Response Schema (`FriendsComparisonResponse`):**
  ```python
  class FriendContribution(BaseModel):
      user_id: int
      username: str
      scrobbles: int

  class SharedEntity(BaseModel):
      name: str
      artist_name: str | None = None
      total_scrobbles: int
      contributions: list[FriendContribution]

  class LeaderboardEntry(BaseModel):
      user_id: int
      username: str
      is_current_user: bool
      minutes_listened: int
      scrobbles: int
      rank: int

  class FriendsComparisonResponse(BaseModel):
      has_friends: bool
      top_artists: list[SharedEntity]
      top_tracks: list[SharedEntity]
      leaderboard: list[LeaderboardEntry]
  ```

### Frontend Implementation
- **Component:** `frontend/src/components/reports/FriendsComparisonSection.jsx`
- **Hook/State:**
  - In `ReportsPage.jsx`, maintain `showFriendsComparison: boolean` (default `false`).
  - Add button `Compare with Friends` in the top action area.
  - When `showFriendsComparison` is true, render `FriendsComparisonSection` above or below the Summary Facts.
  - Fetch data from `GET /reports/friends-comparison` whenever date range changes or toggle is opened.
- **Styling:** Follow `DESIGN.md`:
  - Cards with 12px border radius, 0.5px hairline border (`#E5E5E5`), white surface background (`#FFFFFF`).
  - Text styling using Inter, primary text `#111111`, secondary `#888888`, accent `#0066FF`.
  - Mobile responsive: stack 3 cards vertically on phone screens.

---

## 5. What is Left to the Builder
- Specific frontend loading skeleton and error boundary handling.
- Caching or query tuning if followed friend count is large.
- Exact placement of the toggle button next to existing DateRangeSelector and Share buttons in `ReportsPage.jsx`.
- Writing unit tests in `backend/app/tests/test_friends_comparison.py` and frontend test in `frontend/src/components/reports/FriendsComparisonSection.test.jsx`.
