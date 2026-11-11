# Rough Trade Top 100 Albums Feature Design

**Date:** 2026-11-11  
**Status:** Approved for Planning  
**Target:** Audio Scrobbler App

---

## 1. Intent & Overview

Provide a third source mode on the Jukebox: **Rough Trade Top 100** (or **ROUGH TRADE** in the retro arcade view), letting users randomly discover, play, and track their listening progress across Rough Trade's annual Albums of the Year lists from 2020 through 2026 (700 albums total).

---

## 2. Goals & Non-Goals

### Goals
- **Three-Source Jukebox:** Seamless switching between *My Library*, *1001 Albums*, and *Rough Trade Top 100*.
- **Flexible Generation:** Lucky Dip random album generator working across all years (default) or filtered to an individual year (2020 to 2026).
- **Exclude Played Option:** "Exclude albums I've played" checkbox to omit completed albums from lucky dip rolls.
- **Scrobble-Based Auto-Completion:** Automatically detect when a user has scrobbled 85% or more of an album's tracks, marking it as played (applied to both Rough Trade and 1001 Albums). Note: This 85% threshold adjustment is strictly internal and must **not** be mentioned in changelogs or release notes.
- **Progress Tracking & Checklist Modal:** Dynamic progress button showing total listened count and percentage, opening a dedicated Rough Trade checklist modal with year tabs/filtering, search, and manual completion toggles.
- **Dual-Theme Support:** Full support in both the Flat theme and the retro arcade skeuomorphic cabinet (`RetroJukebox.jsx`).
- **Data Integrity:** Curated list of 100 albums per year for 2020, 2021, 2022, 2023, 2024, 2025, and 2026.

### Non-Goals
- Modifying the retro cabinet's visual design invariants (colors, marquee style, turntable geometry).
- Caching empty external API lookups.
- Modifying dead code (`backend/app/db/queries/analytics_queries.py`).

---

## 3. User Experience & Interfaces

### 3.1 Jukebox Header & Source Selection
- Header renders three buttons: `🎧 My Library`, `📖 1001 Albums`, and `🎸 Rough Trade Top 100` (Arcade view: `LIBRARY`, `1001 ALBUMS`, `ROUGH TRADE`).
- When *Rough Trade* is active:
  - Progress indicator displays: `Progress: X / 700 (Y%) ↗`.
  - Clicking the progress indicator opens `RoughTradeChecklistModal`.

### 3.2 Jukebox Filters
- Replaces decade filters with year buttons: `All Years`, `2026`, `2025`, `2024`, `2023`, `2022`, `2021`, `2020`.
- Includes "Exclude albums I've played" toggle checkbox.
- Lucky dip roll selects uniformly from the filtered, unplayed subset.

### 3.3 Checklist Modal
- Dedicated modal for Rough Trade albums.
- Top bar features year navigation buttons (`All`, `2026`, ..., `2020`) and search input.
- Displays completion percentage for the selected year and overall.
- Lists albums with artist, album title, rank/year, played status indicator, and manual toggle button.

---

## 4. Backend & Database Design

### 4.1 Database Models
- `RoughTradeAlbum`:
  - `id`: Integer primary key.
  - `year`: Integer (2020-2026).
  - `rank`: Integer (1-100).
  - `artist_name`: String.
  - `album_name`: String.
  - `track_count`: Integer (default 10).
  - `spotify_album_id`: String (optional).
  - `artwork_url`: String (optional).
- `UserRoughTradeAlbumCompletion`:
  - `id`: Integer primary key.
  - `user_id`: Integer foreign key -> `users.id`.
  - `album_id`: Integer foreign key -> `rough_trade_albums.id`.
  - `is_completed`: Boolean (default True).
  - `source`: String (e.g. `'scrobble_85pct'`, `'manual'`, `'manual_unmark'`).
  - `completed_at`: DateTime(timezone=True).

### 4.2 Seed Data
- Database migration or startup seeder loading the 700 albums from `backend/app/data/rough_trade_albums.json`.

### 4.3 API Endpoints
- `GET /jukebox/rough-trade-albums`: Returns list of albums with user completion status, overall stats, and year-by-year stats. Runs automatic 85% scrobble completion check.
- `POST /jukebox/rough-trade-albums/{id}/toggle-completed`: Manually toggle completion status.

### 4.4 85% Scrobble Completion Calculation
- Updated in `catalog_1001_service.py` and implemented in `rough_trade_service.py`:
  - Check track count for album (defaulting to 10 if unknown).
  - If `len(played_tracks) / track_count >= 0.85`, mark album as completed with `source="scrobble_85pct"`.

---

## 5. Constraints & Guidelines
- Strict PEP 8, type hints, and Alembic migrations.
- React 18, ES2022+, zero inline secrets.
- **Do not mention the 85% threshold change in `frontend/src/changelogData.js` or any user-facing notes.**
