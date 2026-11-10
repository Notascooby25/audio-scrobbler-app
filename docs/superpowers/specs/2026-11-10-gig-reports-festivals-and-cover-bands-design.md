# Design Spec: Gig Reports Accuracy (Past Events & Festival Days) & Cover Band Support

**Date:** 2026-11-10  
**Status:** Approved in Brainstorming  

---

## 1. Intent & Problem Statement

Users viewing the **Gig Reports** section (`/reports` -> Gigs tab) encounter two key data inaccuracies:
1. **Multi-act festivals or same-day bills inflate gig and festival metrics:**
   - In *Venue Stomping Grounds*, logging 5 bands at Weston Park during a festival increments the festival count by 5 instead of 1 festival date. (e.g. Weston Park displays 66 festivals rather than 12).
   - In *Gigs by Period* (per year / per month) and *Gig Odyssey Map* pin counts, multi-band festival days and support acts increment the gig counts for each band row rather than counting each venue visit / festival day as 1 gig.
2. **Upcoming / future events leak into Gig Reports:**
   - Gigs scheduled in the future currently appear in *Live Artist Rankings*, *Gig Odyssey Map*, and prematurely mark artists as "seen live" in *Live Gap*.
   - Per requirements, any event whose calendar date has not yet passed (`event_date.date() >= today`) must be excluded from all Gig Reporting metrics and leaderboards.

Additionally, users want the ability to tag an attended concert as a **"Cover band"** when logging or editing a gig (e.g. tribute acts, cover bands) and display a badge/label for it.

---

## 2. Requirements & Goals

### 2.1 Festival & Same-Day Multi-Act Deduplication (1 Visit = 1 Gig)
- **Venue Stomping Grounds (`get_gig_travel_and_venues`):**
  - Group festival occurrences by distinct calendar date per venue. If multiple bands are logged at the same venue on the same date with `is_festival = True`, it counts as **1 festival visit**.
  - `distinct_dates` already deduplicates by date; festival counts must match this same-day deduplication logic.
- **Gigs / Festivals By Period (`get_gigs_by_period`):**
  - Count distinct `(event_date.date(), venue_name)` visits per month/year.
  - A day with multiple festival bands counts as 1 gig and 1 festival outing for that period.
- **Gig Odyssey Map (`get_gig_map_pins`):**
  - Calculate `gig_count` based on unique event dates at that pin location.
  - Calculate `festival_count` based on unique event dates marked as festival at that pin location.

### 2.2 Exclude Upcoming / Future Events
- In all reporting services (`gig_reports_service.py` and `setlist_stats_service.py` for `/stats/artists`), events are strictly filtered to those that have already occurred:
  - Definition: `event_date.date() < today` (strictly past, using current UTC date / local user boundary).
- Applied across all Gig Report metrics:
  - `Live Artist Rankings` (`get_artists_leaderboard`)
  - `Gig Odyssey Map` (`get_gig_map_pins`)
  - `Live Gap` (`get_live_gap`)
  - `Gigs by Period` (`get_gigs_by_period`)
  - `Venue Stomping Grounds & Travel` (`get_gig_travel_and_venues`)
  - `Day of Week` (`get_gigs_day_of_week`)
  - `Heatmap Cadence Matrix` (`get_gig_cadence_matrix`)
  - `Live First Discoveries` (`get_live_first_discoveries`)
  - `Milestone Badges` (`evaluate_badges`)

### 2.3 Cover Band Attribute & UI Badge
- Add `is_cover_band` boolean column to `attended_concerts` (default `False`, `server_default="false"`, nullable `False`).
- Provide Alembic migration `0034_add_cover_band_flag.py`.
- Update backend Pydantic models, query serializers, manual gig creation, file import/export (CSV/JSON), and gig editing endpoints.
- Update UI:
  - **Manual Concert Modal (`ManualConcertModal.jsx`):** Checkbox/toggle for "Cover band / Tribute act".
  - **Edit Gig Modal (`EditGigModal.jsx`):** Checkbox/toggle for "Cover band / Tribute act".
  - **Setlist Gig Page (`SetlistGigPage.jsx`):** Render `<span className="sfm-tag is-muted">Cover band</span>` badge in heading.
  - **My Gigs Timeline (`MyGigsTimeline.jsx`):** Show `Cover` tag in row metadata when appropriate.

---

## 3. Non-Goals
- Changing scrobble matching for cover bands or linking them to the covered artist (user specified: just a badge/label for now).
- Changing My Gigs list/timeline view to hide upcoming gigs (upcoming gigs remain in My Gigs with the "Upcoming" tag as expected).
