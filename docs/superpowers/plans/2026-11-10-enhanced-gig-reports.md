# Enhanced Music & Gig Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive geeky gig intelligence, spatial mapping, and milestone badges into the Reports section of the Audio Scrobbler App across Mobile, Tablet, and Desktop viewports.

**Architecture:** Backend FastAPI services calculate cumulative travel distance (round-trip with festival day deduplication), active monthly streaks, badges, venue royalty, and crossover scrobble statistics. The React frontend presents a two-tier dashboard: an always-visible hero metric bar and an interactive grid with sub-filter focus pills and a modular widget customizer, fully styled with semantic design tokens across all themes.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Pytest, React 18, Vite, Vitest, Leaflet / React-Leaflet, CSS Modules / Semantic Tokens.

**Spec:** [docs/superpowers/specs/2026-11-10-enhanced-gig-reports-design.md](file:///home/andyl/Audio%20Scrobbler%20App/docs/superpowers/specs/2026-11-10-enhanced-gig-reports-design.md)

## Global Constraints

- **Python Standards:** Follow PEP 8 and PEP 484 type hints (`from __future__ import annotations`), SQLAlchemy 2.0 typed queries, imports at top of modules.
- **Frontend Standards:** Strict adherence to `DESIGN.md` ("Flat-by-default", zero non-semantic box-shadows/gradients, approved color tokens). Protected components (`RetroJukebox`) must never be modified.
- **Test Invariants:** Vitest requires `afterEach(() => cleanup())` from `@testing-library/react`.
- **Database Safety:** Never run destructive migrations or delete cache tables. Read distances from existing `GeoCache` and `UserPreferences.home_lat/lng`.
- **Authorization & Privacy:** Enforce user ownership and follower checks (`403 Forbidden` for private user data if not following).

## Review Focus

1. **Festival Multi-Act Distance Inflation:** A user logging 8 bands on the same day at the same festival venue must only add travel distance once for that day, not 8 times.
2. **Missing Home City / Uncached Coordinates:** Users without a home city or with un-geocoded venues must see friendly fallback guidance without HTTP 500 errors or map rendering crashes.
3. **Low-Play Noise in Gig Bump:** An artist with 0 plays before and 1 play after a gig must not dominate the surge leaderboard (enforce >= 5 play minimum threshold).
4. **"Live First" Chronology Edge Cases:** Listening scrobbles with `source == 'setlistfm'` must not trigger false "Live First" scrobbles on the day of the concert itself.
5. **Mobile Viewport Invariant:** Multi-column dashboard must collapse cleanly to a single-column flow without horizontal overflow on screens <= 720px wide.

---

### Task 1: Backend Aggregation Services for Travel Odometer, Streaks & Venue Royalty

**Files:**
- Modify: `backend/app/services/gig_reports_service.py`
- Modify: `backend/app/schemas/setlists.py`
- Test: `backend/app/tests/test_gig_reports_service.py`

**Interfaces:**
- Consumes: `AttendedConcert`, `UserPreferences`, `gig_distance_service.haversine_km`, `_place`
- Produces: `GigReportsService.get_gig_travel_and_venues(user_id: int) -> dict[str, Any]`

- [ ] **Step 1: Write the failing tests**

```python
def test_travel_distance_deduplicates_same_day_festival_venues(db_session, test_user):
    # Setup home city and 3 bands on same date at same festival
    # Assert distance is counted once (round trip = 2 * dist), not 3 times.
```

- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_reports_service.py -k test_travel_distance -v`
Expected: FAIL

- [ ] **Step 3: Implement travel calculation, monthly streak counter, and venue royalty aggregation**
Add `get_gig_travel_and_venues(user_id: int)` in `backend/app/services/gig_reports_service.py` implementing:
- Distinct venue visit deduplication `(event_date.date(), venue_name, city)`
- Round-trip distance calculation `2 * haversine_km(home, point)`
- Active monthly gig streak calculation (counting backwards consecutive months from current date)
- Venue Royalty grouping (top 10 venues by visit count, distinct artists seen, and total gigs)

- [ ] **Step 4: Run test to verify it passes**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_reports_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/services/gig_reports_service.py backend/app/schemas/setlists.py backend/app/tests/test_gig_reports_service.py
git commit -m "feat(backend): add travel odometer, streaks, and venue royalty service"
```

---

### Task 2: Backend Badges Engine & "Live First" Stage Discoveries

**Files:**
- Create: `backend/app/services/gig_badges_service.py`
- Modify: `backend/app/api/setlists.py`
- Test: `backend/app/tests/test_gig_badges_service.py`

**Interfaces:**
- Consumes: `AttendedConcert`, `ListeningEvent`, `GigCompanion`, `UserPreferences`
- Produces: `GigBadgesService.evaluate_badges(user_id: int) -> list[dict[str, Any]]`, `GigReportsService.get_live_first_discoveries(user_id: int) -> list[dict[str, Any]]`

- [ ] **Step 1: Write failing tests for badge rules and Live First discovery**

```python
def test_solo_explorer_unlocked_when_no_companions(db_session, test_user):
    # Concert with no companions -> Solo Explorer unlocked
def test_live_first_detected_when_gig_precedes_first_scrobble(db_session, test_user):
    # Concert in 2024, first scrobble in 2025 -> Live First unlocked
```

- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_badges_service.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `GigBadgesService` and `get_live_first_discoveries`**
- In `backend/app/services/gig_badges_service.py`, implement badge evaluators:
  - `solo_explorer`: headline gig with 0 accepted companions
  - `live_first`: gig date <= first non-setlistfm scrobble date
  - `diehard_fan`: same artist seen >= 3 times
  - `mud_survivor`: >= 3 distinct festivals (deduplicated by festival name/year)
  - `road_warrior`: headline gig > 322 km (200 mi) from home
  - `double_header`: concerts on 2 consecutive days
  - `half_year_run`: >= 6 continuous calendar months with a gig
  - `golden_year`: 12 distinct months in one calendar year
  - `century_club`: progress bar up to 100 concerts
- In `backend/app/services/gig_reports_service.py`, implement `get_live_first_discoveries(user_id, limit=10)`.

- [ ] **Step 4: Run test to verify it passes**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_badges_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/services/gig_badges_service.py backend/app/services/gig_reports_service.py backend/app/api/setlists.py backend/app/tests/test_gig_badges_service.py
git commit -m "feat(backend): implement gig milestone badges and live first discoveries"
```

---

### Task 3: Granular Post-Gig Surge Leaderboard & Map Pins API

**Files:**
- Modify: `backend/app/services/gig_reports_service.py`
- Modify: `backend/app/api/setlists.py`
- Test: `backend/app/tests/test_gig_reports_service.py`

**Interfaces:**
- Consumes: `AttendedConcert`, `ListeningEvent`, `GeoCache`
- Produces: `GET /api/setlists/reports/map-pins`, `GET /api/setlists/reports/surge-leaderboard`, `GET /api/setlists/reports/day-of-week`

- [ ] **Step 1: Write failing tests for candidate surge and map pins**

```python
def test_gig_surge_leaderboard_requires_minimum_plays(db_session, test_user):
    # Artist with 0 plays before and 1 play after is filtered out (< 5 total plays threshold)
```

- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_reports_service.py -k test_gig_surge -v`
Expected: FAIL

- [ ] **Step 3: Implement granular surge calculation, day-of-week cadence, and map-pins endpoint**
- Implement `get_gig_surge_leaderboard(user_id: int, limit: int = 5)`: compares 14-day pre/post play window for each artist seen live, enforcing minimum 5 plays.
- Implement `get_gigs_day_of_week(user_id: int)`: groups concert dates by day of week (0..6).
- Implement `GET /api/setlists/reports/map-pins` endpoint returning clustered venue coordinates from `GeoCache`.

- [ ] **Step 4: Run test to verify it passes**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_reports_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/services/gig_reports_service.py backend/app/api/setlists.py backend/app/tests/test_gig_reports_service.py
git commit -m "feat(backend): add post-gig surge leaderboard and map pins endpoint"
```

---

### Task 4: Frontend Hero Metrics Bar & Badge Catalog Component

**Files:**
- Create: `frontend/src/components/reports/GigHeroStatsBar.jsx`
- Create: `frontend/src/components/reports/GigBadgesCatalog.jsx`
- Create: `frontend/src/components/reports/GigHeroStatsBar.test.jsx`
- Create: `frontend/src/components/reports/GigBadgesCatalog.test.jsx`
- Modify: `frontend/src/api/setlists.js`

**Interfaces:**
- Consumes: `fetchGigSummaryStats`, `fetchGigBadges`
- Produces: Renderable React components for hero stats (mileage, streaks) and badge grid.

- [ ] **Step 1: Write failing frontend unit tests**

```jsx
import { render, screen, cleanup } from "@testing-library/react";
import afterEach from "vitest";
import GigHeroStatsBar from "./GigHeroStatsBar";

afterEach(() => cleanup());

test("renders travel distance odometer and active streak", () => {
  render(<GigHeroStatsBar stats={{ gigs: 14, totalDistanceMi: 4820, activeStreakMonths: 6, festivalCount: 3 }} />);
  expect(screen.getByText(/4,820/)).toBeInTheDocument();
  expect(screen.getByText(/6-mo active streak/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- GigHeroStatsBar.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `GigHeroStatsBar` and `GigBadgesCatalog`**
- Create `GigHeroStatsBar.jsx` with semantic tokens (`--color-surface`, `--color-ink`, `--color-primary`), displaying travel distance with flight comparison.
- Create `GigBadgesCatalog.jsx` with unlocked and locked badge tiles, progress bars, and modal details.
- Add corresponding API fetch calls in `frontend/src/api/setlists.js`.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test -- GigHeroStatsBar.test.jsx GigBadgesCatalog.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/reports/GigHeroStatsBar.jsx frontend/src/components/reports/GigBadgesCatalog.jsx frontend/src/components/reports/GigHeroStatsBar.test.jsx frontend/src/components/reports/GigBadgesCatalog.test.jsx frontend/src/api/setlists.js
git commit -m "feat(frontend): create gig hero stats bar and badges catalog components"
```

---

### Task 5: Frontend Interactive Gig Odyssey Map & Spatial Views

**Files:**
- Create: `frontend/src/components/reports/GigOdysseyMap.jsx`
- Create: `frontend/src/components/reports/GigOdysseyMap.test.jsx`
- Modify: `frontend/src/api/setlists.js`

**Interfaces:**
- Consumes: `fetchGigMapPins`
- Produces: `GigOdysseyMap` component with home beacon, clustered venue markers, and popup concert lists.

- [ ] **Step 1: Write failing tests for map component**

```jsx
test("renders map container and home city marker when coordinates present", () => {
  render(<GigOdysseyMap homeCity="Leeds" homeCoords={[53.8, -1.5]} pins={[]} />);
  expect(screen.getByText(/Home: Leeds/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- GigOdysseyMap.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `GigOdysseyMap.jsx`**
- Implement vector/Leaflet map container with CartoDB Positron / Dark Matter tiles depending on active theme.
- Add cluster pins with gig count badges and interactive popover displaying concert dates and bands seen.
- Provide graceful empty state when home city has not yet been configured in Settings.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test -- GigOdysseyMap.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/reports/GigOdysseyMap.jsx frontend/src/components/reports/GigOdysseyMap.test.jsx frontend/src/api/setlists.js
git commit -m "feat(frontend): add interactive gig odyssey map component"
```

---

### Task 6: Frontend Discoveries, Venue Royalty, and Day-of-Week Rhythm

**Files:**
- Create: `frontend/src/components/reports/LiveFirstDiscoveries.jsx`
- Create: `frontend/src/components/reports/VenueRoyaltyList.jsx`
- Create: `frontend/src/components/reports/GigDayOfWeekChart.jsx`
- Test: `frontend/src/components/reports/LiveFirstDiscoveries.test.jsx`

**Interfaces:**
- Consumes: `fetchLiveFirstDiscoveries`, `fetchVenueRoyalty`, `fetchDayOfWeekCadence`
- Produces: Ranked list and distribution bar chart components.

- [ ] **Step 1: Write failing tests for Live First and Venue Royalty**

```jsx
test("renders live first discovery list with play count and date comparison", () => {
  render(<LiveFirstDiscoveries discoveries={[{ artist_name: "Fontaines D.C.", gig_date: "2019-06-01", first_scrobble_date: "2019-10-01", lifetime_plays: 380 }]} />);
  expect(screen.getByText("Fontaines D.C.")).toBeInTheDocument();
  expect(screen.getByText(/380 plays/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- LiveFirstDiscoveries.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement components**
- Implement `LiveFirstDiscoveries.jsx` with date comparisons.
- Implement `VenueRoyaltyList.jsx` showing top rooms, gigs count, and artists seen.
- Implement `GigDayOfWeekChart.jsx` showing 7-day distribution with weekend highlight.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test -- LiveFirstDiscoveries.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/reports/LiveFirstDiscoveries.jsx frontend/src/components/reports/VenueRoyaltyList.jsx frontend/src/components/reports/GigDayOfWeekChart.jsx frontend/src/components/reports/LiveFirstDiscoveries.test.jsx
git commit -m "feat(frontend): add live first discoveries, venue royalty, and gig rhythm components"
```

---

### Task 7: Layout Assembly, Focus Tabs, Widget Customizer Drawer & Responsive Styling

**Files:**
- Modify: `frontend/src/components/reports/GigReportsSection.jsx`
- Modify: `frontend/src/components/reports/GigReportsSection.test.jsx`
- Modify: `frontend/src/skins/timeline/timeline.css`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: All sub-components created in Tasks 4–6
- Produces: Integrated `GigReportsSection` with focus sub-tabs (`All`, `Travel`, `Badges`, `Discoveries`), widget customizer dropdown, and responsive reflow across Mobile, Tablet, and Desktop.

- [ ] **Step 1: Write integration tests in `GigReportsSection.test.jsx`**
Assert that focus tabs correctly hide/show corresponding sections, that customizer toggles persist, and all existing gig stats (Furthest Gigs, Live Gap, Gigs per year) remain rendered.

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- GigReportsSection.test.jsx`
Expected: FAIL

- [ ] **Step 3: Assemble `GigReportsSection.jsx` and add responsive styles**
- Integrate hero metrics bar, sub-filter tabs, and customizer drawer.
- Preserve all existing features (Live Gap, Furthest Gigs with SetlistDateBadge, Gigs per year, Gigs per month).
- Add CSS rules in `timeline.css` and `styles.css` for 12-col desktop, 6-col tablet, and 1-col mobile reflow.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test -- GigReportsSection.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/reports/GigReportsSection.jsx frontend/src/components/reports/GigReportsSection.test.jsx frontend/src/skins/timeline/timeline.css frontend/src/styles.css
git commit -m "feat(frontend): assemble enhanced gig reports dashboard with focus tabs and widget customizer"
```

---

### Task 8: End-to-End Verification & Changelog Entry

**Files:**
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`

- [ ] **Step 1: Run full automated test suites and linters**
- Run: `ruff check backend/app worker scripts`
- Run: `ruff format --check backend/app worker scripts`
- Run: `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
- Run: `cd frontend && npm run lint && npm test && npm run build`
- Run: `cd frontend && npm run test:e2e` (mandatory on route/report updates)

- [ ] **Step 2: Update changelog and user documentation**
- Bump version in `frontend/package.json`.
- Add release entry in `frontend/src/changelogData.js` detailing the new Gig Intelligence, Map, Travel Odometer, and Badges.
- Update `UserGuideSection.jsx` explaining how to unlock gig badges and customize report widgets.

- [ ] **Step 3: Commit**
```bash
git add frontend/package.json frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx
git commit -m "chore(release): bump version and document enhanced gig intelligence and badges"
```
