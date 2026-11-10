# Enhanced Music & Gig Reports Design Document

**Date:** 2026-11-10  
**Status:** In Review  
**Target Release:** Audio Scrobbler App v0.34.0+  

---

## 1. Executive Summary & Intent

The Audio Scrobbler App currently provides listening analytics (artists, tracks, albums, genres, heatmaps) alongside a dedicated **Gigs** tab within the Reports view. While existing gig reporting provides solid foundations (Gigs per month, Gigs per year, Live Gap, Furthest Gigs, and average Gig Bump), music fans and concert-goers crave deeper, geekier statistics, spatial visualization of their travels, gamified attendance milestones, and a clear visual connection between the concerts they attend in person and their daily Spotify listening habits.

This project enhances the Gigs Reports experience with:
1. **Travel & Spatial Intelligence:** Total cumulative distance travelled (mileage odometer with real-world flight analogies), interactive Gig Odyssey Map with clustered venue markers and travel arcs, and a Venue Royalty leaderboard.
2. **Music & Gig Crossover Analytics:** Identification of "Live First" discoveries (artists seen live before ever played/scrobbled in the app) and granular artist-specific post-gig listening surges.
3. **Gamification & Badges:** Milestone badges (such as *Solo Explorer*, *Live First*, *Road Warrior*, *Mud Survivor*, *Century Club*, *Double Header*) with active monthly streaks.
4. **Cohesive Information Architecture & Multi-Device Reflow:** A two-tier layout featuring an always-visible core hero metrics bar, focus sub-tabs (*All Intelligence*, *Travel & Map*, *Badges & Streaks*, *Discoveries & Bump*), and a collapsible widget customization drawer to toggle modules on/off. Responsive reflow ensures an optimized presentation across Mobile, Tablet, and Desktop.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Geeky, Insightful Metrics:** Surface surprising, delightful statistics about concert attendance and travel without requiring manual data entry beyond existing Setlist.fm imports and concert logging.
- **Visual Spatial Exploration:** Provide an interactive map of visited venues based on existing geocoding data (`GeoCache` and `UserPreferences.home_lat/home_lng`).
- **Seamless Skin & Theme Harmony:** Use standard semantic design system CSS tokens (`--color-surface`, `--color-ink`, `--color-primary`, `--tl-tile`, etc.) so that reports look first-class in Light Mode, Dark Mode, and across all skins (`timeline`, `sleeve`, `default`).
- **Performance & Scalability:** Calculate aggregate gig reports on the backend using efficient SQL aggregation and caching where appropriate, avoiding blocking heavy client-side computation.
- **Modular Customization:** Empower users to tailor their dashboard by enabling/disabling widgets and filtering views via sub-tabs, keeping the interface clean and un-overwhelming.

### Non-Goals
- **External Social Networks:** No public social feed or competitive leaderboards against global strangers. All comparisons are personal or scoped to established follower relationships (`follows` table).
- **Manual GPS Check-Ins:** No requirement for users to perform real-time geolocation check-ins at venues; distances are calculated from stored venue cities/coordinates.
- **Tampering with Jukebox / Audio Playback:** This project touches only reporting and analytics surfaces; protected components like `RetroJukebox` are untouched.

### Anti-Goals
- **Cluttered Wall of Widgets:** Avoid dropping a dozen heavy charts onto the page at once. The UI must remain structured, scannable, and cleanly navigable.
- **Negative Cache Poisoning:** Never cache empty responses or failed geocodes indefinitely.
- **Inconsistent Unit Displays:** Always support user preference for distance units (kilometers vs. miles) consistently across maps and stat cards.

---

## 3. Detailed Feature Specifications

### 3.1 Hero Metrics Bar (Core Overview)
Always rendered at the top of the Gigs Report tab in a responsive 4-card grid (reflows to 2x2 on mobile):
1. **Gigs Logged:** Total attended concerts count + subtext indicating current active monthly streak (e.g. *"🔥 6-mo active streak"*).
2. **Total Travel Odometer:** Cumulative distance in miles/km across all located gigs + fun comparison (e.g. *"✈️ London → Chicago"* or *"0.2x around the Earth"*).
3. **Festivals Attended:** Total multi-day music festivals count + badge status (e.g. *"🎪 Mud Survivor"*).
4. **Badges & Milestones:** Summary of unlocked badges (e.g. *"8 / 14 Badges Unlocked"*).

### 3.2 Gig Odyssey Map
- **Component:** `GigOdysseyMap.jsx` (integrating lightweight Leaflet or SVG vector map).
- **Tile Styling:** Themed dynamically using CartoDB Positron for light backgrounds and CartoDB Dark Matter for dark mode.
- **Features:**
  - Home City beacon pin with a soft accent pulse.
  - Venue markers clustered by geographical proximity, sizing dynamically based on gig count.
  - Optional dashed travel arc lines connecting Home City to destination venues.
  - Clicking a marker opens a popover detailing venue name, city, and list of concerts attended there.

### 3.3 Gamification & Badges Catalog
Milestone badges are derived automatically from the user's `attended_concerts`, `listening_events`, and `gig_companions` tables:
- **🧭 Solo Explorer:** Attended a headline concert without any confirmed companions (`gig_companions`).
- **⚡ Live First:** Experienced an artist live on or before the date of their very first scrobble in `listening_events`.
- **👑 Diehard Fan:** Attended 3 or more headline shows for the same artist.
- **🎪 Mud Survivor:** Attended 3 or more music festivals (`is_festival == True`).
- **🛣️ Road Warrior:** Attended a headline gig located >200 miles (>322 km) from Home City.
- **⚡ Double Header:** Attended concerts on 2 consecutive calendar days.
- **🔥 Half-Year Run:** Logged at least 1 gig in 6 consecutive calendar months.
- **🌟 Golden Year:** Logged at least 1 gig in each of the 12 calendar months of a single year.
- **🤝 Crew Love:** Logged gigs with 3 or more distinct accepted companion friends.
- **🔍 Support Supporter:** Logged attendance for 10 or more support acts (`is_support_act == True`).
- **✈️ Globe Trotter:** Attended concerts across 3 or more distinct countries.
- **💯 Century Club:** Reached 100 total logged concerts (displays progress bar when locked, e.g. `52 / 100`).
- **💎 Decade of Live:** Gig history spanning 10 or more distinct calendar years.

### 3.4 Live vs. Listening Crossover Intelligence
- **"Live First" Discoveries Table:**
  Highlights artists discovered on stage prior to streaming. Displays artist name, date seen live, venue, first scrobble date, and total post-discovery lifetime scrobbles.
- **Granular Gig Bump Surge Leaderboard:**
  Extends the existing average gig bump by listing individual artists with the highest percentage play surge in the 14 days following a concert compared to the 14 days prior.

### 3.5 Spatial & Attendance Cadence Intelligence
- **Venue Royalty (Stomping Grounds):** Leaderboard of top venues visited, detailing total gigs, festivals, distinct artists seen, and average travel distance.
- **Day of Week Rhythm:** Visual distribution bar chart showing breakdown of shows by weekday (Monday–Sunday) highlighting percentage of weekend vs. weekday attendance.

### 3.6 Cohesive Information Architecture & User Customization
- **Focus Sub-Tabs:**
  - `All Intelligence`: Full dashboard.
  - `📍 Travel & Map`: Focuses on Map, Furthest Gigs, and Venue Royalty.
  - `🏆 Badges & Streaks`: Focuses on Achievements, Active Streaks, and Milestone progress.
  - `⚡ Discoveries & Bump`: Focuses on "Live First" table and Post-Gig Listening surges.
- **Widget Customizer Drawer:**
  A lightweight dropdown panel allowing users to toggle individual modules on or off. Customizer preferences are persisted locally in `localStorage` (`audio_scrobbler_gig_report_widgets`) so preferences remain intact across sessions.

---

## 4. Architectural & Backend Design

### 4.1 Backend Endpoints & Services
Updates and extensions to `backend/app/services/gig_reports_service.py` and `backend/app/api/setlists.py`:
- `GET /api/setlists/reports/summary`:
  Returns total gigs, festivals, years active, total distance travelled (miles/km), active streak (months), and unlocked badge count.
- `GET /api/setlists/reports/map-pins`:
  Returns geocoded locations for all attended concerts with coordinates (`lat`, `lng`), venue name, city, country, gig count, and list of gig IDs.
- `GET /api/setlists/reports/badges`:
  Evaluates all badge rules against user data and returns badge catalog with status (`unlocked`, `locked`), unlock timestamp, and progress metrics.
- `GET /api/setlists/reports/live-first`:
  Cross-queries `attended_concerts` with `listening_events` to find artists whose earliest `event_date` is earlier than their earliest `played_at`, returning top discoveries ordered by subsequent play count.
- `GET /api/setlists/reports/venue-royalty`:
  Returns top venues grouped by venue name, city, country, total concerts, and distinct artists.
- `GET /api/setlists/reports/day-of-week`:
  Returns aggregate concert counts grouped by day of week (0=Monday to 6=Sunday).

### 4.2 Security, Privacy & Permissions
- Follower access rules: When viewing another user's reports (`?userId=`), enforce follower permission check (`403 Forbidden` if not following).
- Geocoding security: Venue queries strictly sanitized; geocache protected with SSRF safeguards.
- Rate-limiting protection: Map pins rely on cached geocoordinates in `GeoCache` without inline geocoding during page load.

---

## 5. Responsive UI & CSS Invariants

### 5.1 Multi-Breakpoint Grid Layouts
- **Desktop (`> 1024px`):** 12-column grid. Bento-style cards with full-width or 8-col map, 4-col companion cards, 6-col side-by-side rankings.
- **Tablet (`720px - 1024px`):** 6-column grid. Balanced 2-column cards, full-width map.
- **Mobile (`<= 720px`):** Single column vertical stream. Stat cards displayed in 2x2 grid; horizontal scroll pills for sub-tabs; touch-friendly map container.

### 5.2 CSS Token Usage & Skin Safety
- Strict adherence to `DESIGN.md`: Flat-by-default, no non-semantic drop-shadows or unapproved color tokens.
- All styles scoped under `[data-skin="timeline"]` and standard theme classes.
- Zero modifications to protected components (`RetroJukebox`).

---

## 6. Implementation Phasing, Technical Rules & Edge Cases

### 6.1 Technical Rules & Edge Cases

1. **Cumulative Distance ("Travel Odometer") Calculation:**
   - **Trip Model:** Hub-and-spoke one-way or round trip? To remain honest and transparent, cumulative distance is calculated as **total round-trip journey distance from Home City** (`2 * distance_km(home, venue)`).
   - **Festival & Multi-Band Deduplication:** Distance is calculated strictly per **distinct event visit** (`distinct(event_date, venue_name, city)`). If a user logs 6 bands on the same day at the same festival or venue, the travel distance is counted **once**, not 6 times.
   - **Unit Formatting:** Backend returns distances in kilometers; frontend formats in either miles or km depending on user preference (`1 km = 0.621371 miles`).

2. **Map Geolocation & Cache Lifecycle:**
   - `AttendedConcert` rows are resolved against `GeoCache` via the existing `_place(db, venue_query, city_query)` pattern in `gig_distance_service.py`.
   - The background worker's `geocode_pending_venues` routine continues to resolve unmapped venues in the background without blocking HTTP requests.
   - For `GET /api/setlists/reports/map-pins`, all venues that have known coordinates in `GeoCache` are returned as clustered map pins; any pending venues are omitted from the map until cached.

3. **Festival Deduplication & Grouping:**
   - In `AttendedConcert`, multiple bands from a festival share `is_festival: True` and usually a common `festival_name` or `(venue_name, event_date)`.
   - When calculating **Festivals Attended** and the **Mud Survivor** badge, festivals are deduplicated by `(coalesce(festival_name, venue_name), event_date.year)` so that seeing 12 bands across one weekend counts as **1 festival attended**, not 12.

4. **"Headline" vs. Festival vs. Support Acts:**
   - **Headline Show:** Defined as `is_support_act is False`. (Festival headliners or festival performances with `is_support_act is False` are counted towards distance and festival badges).
   - **Support Act:** Defined as `is_support_act is True`. Used specifically for the *Support Supporter* badge.

5. **"Solo Explorer" Semantics:**
   - Evaluated as any headline concert where the user attended alone: specifically, where no confirmed companions exist in `gig_companions` (`status == 'added'`).
   - If a concert was logged or imported without companions, it qualifies towards *Solo Explorer*.

6. **Granular Gig Bump Thresholds:**
   - Candidates evaluated: Artists for whom the user has logged at least one past concert whose 14-day post-window has elapsed.
   - Baseline threshold: To eliminate statistical noise (e.g. 0 plays before to 1 play after), an artist must have **at least 5 total plays** in the 28-day combined window (before + after).
   - Ranking: Ordered by absolute surge (`plays_after - plays_before`) and percentage change. Limits to top 5 surge artists.

