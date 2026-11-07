# Implementation Plan: Mobile Track & Artist Name Density Fix

**Delivery:** Mobile Layout & Density Refinement for Timeline & Sleeve Skins  
**Branch:** `fix/mobile-track-artist-truncation`  
**Base:** `origin/main`  

---

## Goal Description
On mobile viewports ($\le 640\text{px}$), track titles, artist names, and album names in both **Timeline** and **Sleeve** skins are severely truncated (sometimes down to 1–2 letters, e.g. `C...`, `Last Goo...`) due to rigid right-aligned metadata elements competing on the same horizontal row:
1. In **Time Capsule & Rediscover** (`/play`), the `context_badge` (*e.g. `50 plays • Last played Jul 2026`*) sits inline with the title with `white-space: nowrap`, consuming ~200px and squeezing the title into ~60px.
2. In **Library Rank Lists** (`/library` Tracks, Artists, Albums), the horizontal volume bar (`.library-bar-track`, 90–120px) plus play count and heart button eat over 60% of the screen width.
3. In **Recent Scrobbles** (`/library` scrobbles feed and Today), the full datetime string (*e.g. `7 Nov 2026, 7:18 pm`*) plus heart button and source badge consume ~200px.

This plan addresses all three surfaces across both Timeline and Sleeve skins to give track and artist names the full horizontal width of mobile screens while preserving 100% of Classic skin invariants.

---

## User Review Required

> [!IMPORTANT]
> **Mobile Layout Adjustments**:
> 1. **Time Capsule (`/play`)**: The play count and last-played badge wraps onto a secondary line indented below the track title on screens $\le 640\text{px}$, allowing the title to take 100% of the card width.
> 2. **Library Rank Lists (`/library`)**: On screens $\le 640\text{px}$, the bulky horizontal bar column is replaced by a clean tabular play count (*e.g. `54`*), with the relative proportion shown as a subtle progress accent line along the bottom border of the row. Redundant source badges are suppressed on rank lists (tracks/artists/albums) where they repeat identically.
> 3. **Recent Scrobbles Feed**: On screens $\le 640\text{px}$, today's scrobbles show the time only (*e.g. `7:18 pm`* instead of `7 Nov 2026, 7:18 pm`) since the day header already states "TODAY", reclaiming ~80px for the title.

---

## Proposed Changes

Grouped by component and ordered logically:

---

### Component 1: Time Capsule & Rediscover (`RediscoverCard.jsx` & Styles)

#### [MODIFY] `frontend/src/styles.css`
- Under `@media (max-width: 640px)`:
  - Allow `.rediscover-item` to wrap (`flex-wrap: wrap`).
  - Indent `.rediscover-badge` beneath the title and artist: `margin-left: calc(2.5rem + 0.75rem); margin-top: -2px; font-size: 11px;`.
  - Let `.rediscover-item-copy` take full available width without horizontal truncation constraints.

#### [MODIFY] `frontend/src/skins/timeline/timeline.css`
- Under `@media (max-width: 640px)` for `[data-skin="timeline"]`:
  - Scoped `.rediscover-item` flex wrapping and badge positioning matching the mobile layout.

#### [MODIFY] `frontend/src/skins/sleeve/sleeve.css`
- Under `@media (max-width: 640px)` for `[data-skin="sleeve"]`:
  - Scoped `.rediscover-item` flex wrapping and badge styling.

---

### Component 2: Library Rank Lists (`LibraryRankList.jsx` & Styles)

#### [MODIFY] `frontend/src/components/LibraryRankList.jsx`
- Support a mobile-first progress baseline/underline for ranked rows by providing a CSS variable or attribute `--rank-pct: ${pct}%` on `.library-rank-row` or within `.library-bar-track`.
- On mobile viewports or ranked tabs, avoid rendering redundant source badges where the scrobble source doesn't vary.

#### [MODIFY] `frontend/src/styles.css`
- Under `@media (max-width: 640px)`:
  - In `.library-rank-row`: allow `.library-row-copy` to flex-grow with `min-width: 0`.
  - In `.library-rank-actions`: simplify `.library-bar-track` so the play count sits compactly as clean tabular text without a rigid 90px fixed container.
  - Position the relative percentage progress bar as a slim accent line along the bottom separator border (`height: 2px`).

#### [MODIFY] `frontend/src/skins/timeline/timeline.css`
- Scope mobile rank row styling under `[data-skin="timeline"]`:
  - Remove fixed bar width on mobile screens ($\le 640\text{px}$).
  - Display compact tabular scrobble counts with bottom progress accent line.
  - Ensure title and artist text ellipsis only triggers at genuine viewport boundary.

#### [MODIFY] `frontend/src/skins/sleeve/sleeve.css`
- Scope mobile rank row styling under `[data-skin="sleeve"]`:
  - Override `width: 120px !important` on `.library-bar-track` within `@media (max-width: 640px)`.
  - Display compact tabular scrobble counts with bottom progress accent line.

---

### Component 3: Recent Scrobbles Feed (`LibraryScrobbleList.jsx` & `timeFormatting.js`)

#### [MODIFY] `frontend/src/timeFormatting.js`
- Enhance `formatScrobbleTime` (or add a companion helper `formatCompactScrobbleTime(date, now)`) so that when rendered under a day heading (like "Today" or "7 Nov 2026"):
  - Same-day plays show time-of-day: `h:mm a` (e.g. `7:18 pm`).
  - Older dates show compact day/month: `d MMM, h:mm a` (e.g. `6 Nov, 10:14 pm`).

#### [MODIFY] `frontend/src/skins/sleeve/sleeve.css`
- In `[data-skin="sleeve"] .library-scrobble-row`:
  - On mobile (`@media (max-width: 640px)`), allow the layout to use responsive CSS Grid (`grid-template-areas: "art copy time" "art copy heart"`) or compact flex layout, preventing the timestamp and heart from claiming 200px on row 1.

#### [MODIFY] `frontend/src/skins/timeline/timeline.css`
- In `[data-skin="timeline"] .library-scrobble-row`:
  - On mobile (`@media (max-width: 640px)`), ensure time and heart do not constrain `.library-row-copy`.

---

## Verification Plan

### Automated Tests
1. **Frontend Unit Tests**:
   ```bash
   cd frontend && npm test -- src/components/LibraryRankList.test.jsx src/components/RediscoverCard.test.jsx src/skins/
   cd frontend && npm test
   ```
2. **Frontend Linter & Build**:
   ```bash
   cd frontend && npm run lint && npm run build
   ```
3. **Playwright E2E Tests**:
   ```bash
   cd frontend && npm run test:e2e
   ```
4. **Backend & Worker Tests**:
   ```bash
   PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
   ```
5. **Python Lint**:
   ```bash
   ruff check backend/app worker scripts
   ```

### Manual & Visual Verification
1. Start preview environment:
   ```bash
   scripts/preview.sh up
   ```
2. Capture screenshots at $390 \times 844\text{px}$ mobile viewport across:
   - `/library?tab=tracks&skin=timeline`
   - `/library?tab=artists&skin=timeline`
   - `/library?tab=tracks&skin=sleeve`
   - `/library?tab=artists&skin=sleeve`
   - `/play?skin=timeline`
   - `/play?skin=sleeve`
   - `/library?tab=scrobbles&skin=sleeve`
3. Verify:
   - Song titles like `Last Goodbye`, `Electric Blue`, `How Soon Is Now?`, `After the Gold Rush` display in full without premature truncation.
   - Artist names like `Fontaines D.C.` and `Bombay Bicycle Club` display in full.
   - Time Capsule track names on `/play` display in full without being crushed by the stats badge.
   - Classic skin remains 100% untouched and pixel-identical.
4. Stop preview:
   ```bash
   scripts/preview.sh down
   ```
