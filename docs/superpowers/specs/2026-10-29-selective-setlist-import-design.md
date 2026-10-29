# Selective Setlist.fm Profile Import & Environment Configuration Specification

- **Date:** 2026-10-29
- **Status:** Approved
- **Scope:** Selective Gig Import (checkboxes) and Compose/Env Wiring for `SETLIST_FM_API_KEY`

---

## 1. Context & Motivation
Users often share or reference another family member's Setlist.fm profile (e.g. brother's profile `crispylettuce` with 14+ pages of past gigs), but they only attended a portion of those shows.
Previously, importing a username imported all shows without distinction.

The goal is:
1. Allow the user to configure `SETLIST_FM_API_KEY` directly in `.env` and `.env.production`, passing it to the `backend` and `worker` Docker services.
2. In the Setlist.fm Import modal, allow entering a username, fetching/previewing their attended shows, and selecting which concerts to import using checkboxes.
3. Show which concerts are already logged in the user's database (`already_logged: true`).
4. Import only the selected concerts into `AttendedConcert` and sequence their songs into `ListeningEvent`.

---

## 2. Architecture & Design

### A. Environment Configuration
- `docker-compose.yml`:
  - `backend.environment`: add `SETLIST_FM_API_KEY: ${SETLIST_FM_API_KEY:-}`
  - `worker.environment`: add `SETLIST_FM_API_KEY: ${SETLIST_FM_API_KEY:-}`
- `docker-compose.prod.yml`:
  - `backend.environment`: add `SETLIST_FM_API_KEY: ${SETLIST_FM_API_KEY:-}`
  - `worker.environment`: add `SETLIST_FM_API_KEY: ${SETLIST_FM_API_KEY:-}`
- `.env.example`:
  - Add `SETLIST_FM_API_KEY=` with setup instructions (free API key from https://www.setlist.fm/settings/api).

### B. Backend API Changes
1. **Preview Endpoint (`GET /api/setlists/import/preview`):**
   - Query Parameters: `username: str`, `page: int = 1`.
   - Fetches page from Setlist.fm (`svc.get_user_attended(username, p=page)`).
   - Maps each setlist into:
     - `setlist_id: str`
     - `artist_name: str`
     - `venue_name: str`
     - `city: str`
     - `country: str`
     - `event_date: str`
     - `tour_name: str | None`
     - `setlist_url: str`
     - `song_count: int`
     - `already_logged: bool` (true if `AttendedConcert` exists for `user_id` and `setlist_id`)
   - Returns metadata: `page`, `items_per_page`, `total`, `total_pages`.

2. **Selective Import Endpoint (`POST /api/setlists/import`):**
   - Updated request schema:
     ```python
     class SetlistImportRequest(BaseModel):
         username: str = Field(..., min_length=1, max_length=100)
         setlist_ids: list[str] | None = None
     ```
   - If `setlist_ids` is provided:
     - Loops over `setlist_ids` and invokes `SetlistAttendanceService.log_concert_attendance(...)`.
     - Skips any already imported gigs.
     - Respects rate limits and returns `{ status: "completed", imported_count: N, total_found: len(setlist_ids) }`.
   - If `setlist_ids` is omitted/null:
     - Retains existing full-sync behavior.

### C. Frontend UI (`ImportExportModal.jsx`)
1. **Step 1: Enter Username & Fetch Shows:**
   - Input for Setlist.fm username.
   - Button: "Fetch Gigs".
2. **Step 2: Interactive Checkbox List:**
   - Top action bar: "Select All", "Deselect All", and counter ("X of Y selected").
   - Scrollable card/table list of concerts:
     - Checkbox (disabled if already logged, with badge `Already in Library`).
     - Concert Date (`YYYY-MM-DD`).
     - Artist Name & Tour Name.
     - Venue, City, Country.
     - Song count badge.
   - Pagination: "Load Next Page" button if more shows exist on Setlist.fm.
3. **Step 3: Import Execution:**
   - Button: "Import Selected (X)".
   - Progress / Loading state while importing.
   - Success toast / completion message indicating how many gigs were added.
   - Automatically re-fetches user attendances on parent page.

---

## 3. Security, Testing & Compatibility
- **Rate Limit Compliance:** Preview and batch import respect DB-backed rate limiter (max 2/sec, max 1,400/day).
- **Authentication:** All endpoints require `get_current_user`.
- **Deduplication:** Scrobbles and concerts deduplicated via composite constraints.
