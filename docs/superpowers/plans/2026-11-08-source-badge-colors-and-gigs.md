# Source Badge Keys, Brand Colors & Gig Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize source indicators across the app by:
1. Updating Apple Music's color to Apple blue (`#0071e3`).
2. Adding a dedicated **Setlist.fm / Gig** source badge in purple (`#8b5cf6`) with a live gig microphone/ticket icon.
3. Adding a fallback geometric shape in an unused color (teal `#0d9488`) for any unknown source lacking a dedicated badge.
4. Replacing the plain geometric characters (●, ◆, ■, ▲) in the Timeline chart legend and Timeline vertical rail with the actual official colored `<SourceBadge />` SVGs.
5. Displaying source badges in Sleeve skin's today hero metadata for consistency across skins.

---

### File Structure Map

- `frontend/src/styles.css`
  - Update `--color-apple` to `#0071e3`, `--color-apple-bg: rgba(0, 113, 227, 0.1)`.
  - Add `--color-gig: #8b5cf6`, `--color-gig-bg: rgba(139, 92, 246, 0.1)`.
  - Add `--color-source-fallback: #0d9488`, `--color-source-fallback-bg: rgba(13, 148, 136, 0.1)`.
- `frontend/src/components/SourceBadge.jsx`
  - In `resolveSourceType`: add checks for `setlistfm`, `setlist`, `gig`.
  - Add `GigIcon` (purple background with microphone/ticket icon).
  - Add `FallbackGeometricIcon` (teal diamond/hexagon) when source doesn't match standard sources or import.
  - Update `AppleIcon` if needed to ensure crisp SVG rendering on blue background.
- `frontend/src/components/SourceBadge.test.jsx`
  - Add test assertions for `setlistfm` / `gig` source resolution, Apple badge, and fallback geometric shape.
- `frontend/src/skins/timeline/slots/TimelineHourlyChart.jsx`
  - Update legend to render `<SourceBadge source={...} size="sm" />` instead of plain text characters (●, ◆, ■, ▲) alongside label text.
  - Add Gig marker to legend.
- `frontend/src/skins/timeline/slots/TimelineRail.jsx`
  - Replace `SourceMarker` text characters with `<SourceBadge source={track.source} size="sm" />`.
- `frontend/src/skins/timeline/timeline.css`
  - Adjust `.timeline-rail-marker` sizing/padding so `<SourceBadge />` fits seamlessly into the vertical rail.
  - Style `.timeline-source-legend` items for clean alignment with SVGs.
- `frontend/src/skins/sleeve/slots/SleeveTodayPage.jsx`
  - Display `<SourceBadge source={heroTrack.source} size="sm" />` next to `from {sourceName}` in the hero meta.
- `frontend/src/skins/timeline/timeline.test.jsx` & `frontend/src/skins/sleeve/sleeve.test.jsx`
  - Update tests reflecting the presence of `<SourceBadge />` in Timeline and Sleeve components.

---

### Task 1: Update Brand Color Tokens & Add Gig / Fallback Colors

**Files:**
- `frontend/src/styles.css`

- [ ] **Step 1:** In `frontend/src/styles.css`, update `--color-apple` to `#0071e3` (Apple blue) and `--color-apple-bg` to `rgba(0, 113, 227, 0.1)`.
- [ ] **Step 2:** Add `--color-gig: #8b5cf6` and `--color-gig-bg: rgba(139, 92, 246, 0.1)`.
- [ ] **Step 3:** Add `--color-source-fallback: #0d9488` and `--color-source-fallback-bg: rgba(13, 148, 136, 0.1)`.

---

### Task 2: Extend SourceBadge Component with Gig Icon, Apple Blue, and Geometric Fallback

**Files:**
- `frontend/src/components/SourceBadge.jsx`
- `frontend/src/components/SourceBadge.test.jsx`

- [ ] **Step 1:** In `SourceBadge.test.jsx`, add failing tests:
  - `resolveSourceType('setlistfm')` returns `'gig'`.
  - `resolveSourceType('gig')` returns `'gig'`.
  - `getSourceLabel('gig')` returns `'Scrobbled from live gig'`.
  - Render with `source="setlistfm"` renders `.source-badge-gig` with label `Scrobbled from live gig`.
  - Render with unknown source (e.g. `source="custom_tracker"`) renders geometric fallback badge with title and accessible label.
- [ ] **Step 2:** Run `npm test -- src/components/SourceBadge.test.jsx` and confirm tests fail as expected.
- [ ] **Step 3:** In `SourceBadge.jsx`:
  - In `resolveSourceType`, check for `setlistfm`, `setlist`, `gig` -> return `'gig'`.
  - Add `GigIcon` SVG component (vibrant purple `#8b5cf6` circle with live microphone/music icon).
  - Add `FallbackGeometricIcon` SVG component (teal `#0d9488` circle with crisp geometric rhombus/diamond).
  - Update `getSourceLabel` with `'gig'` -> `'Scrobbled from live gig'`.
  - In render, support `sourceType === 'gig'` and fallback geometric icon.
- [ ] **Step 4:** Re-run `npm test -- src/components/SourceBadge.test.jsx` and confirm 100% pass rate.

---

### Task 3: Integrate SourceBadges in Timeline Chart Legend & Vertical Rail

**Files:**
- `frontend/src/skins/timeline/slots/TimelineHourlyChart.jsx`
- `frontend/src/skins/timeline/slots/TimelineRail.jsx`
- `frontend/src/skins/timeline/timeline.css`
- `frontend/src/skins/timeline/timeline.test.jsx`

- [ ] **Step 1:** Update `TimelineHourlyChart.jsx`:
  - Import `SourceBadge` from `../../components/SourceBadge`.
  - Replace the text characters (●, ◆, ■, ▲) in the legend with `<SourceBadge source={...} size="sm" />`.
  - Include Spotify, YouTube, Apple, BBC, and Gig (`source="setlistfm"`).
- [ ] **Step 2:** Update `TimelineRail.jsx`:
  - Replace the text symbol `SourceMarker` with `<SourceBadge source={track.source} size="sm" />`.
- [ ] **Step 3:** Update `timeline.css`:
  - Adjust `.timeline-rail-marker` so `<SourceBadge />` aligns cleanly with the vertical rail connector line.
  - Style `.timeline-source-legend` and `.timeline-legend-item` for flex alignment with badges.
- [ ] **Step 4:** Update `timeline.test.jsx`:
  - Verify that `TimelineHourlyChart` renders source badges for Spotify, YouTube, Apple, BBC, and Gigs.
  - Verify that `TimelineRail` renders source badges for tracks.
- [ ] **Step 5:** Run `npm test -- src/skins/timeline/timeline.test.jsx` and verify tests pass.

---

### Task 5: Integrate Source Badge in Sleeve Today Page

**Files:**
- `frontend/src/skins/sleeve/slots/SleeveTodayPage.jsx`
- `frontend/src/skins/sleeve/sleeve.test.jsx`

- [ ] **Step 1:** In `SleeveTodayPage.jsx`:
  - Import `SourceBadge` from `../../components/SourceBadge`.
  - In `sleeve-hero-meta`, render `<SourceBadge source={heroTrack.source} size="sm" />` alongside `from {sourceName}`.
  - Handle `heroTrack.source === "setlistfm"` or `"gig"` so `sourceName` displays as `"Live Gig"` or `"Setlist.fm"`.
- [ ] **Step 2:** In `sleeve.test.jsx`:
  - Add test assertion verifying that the hero card renders the source badge.
- [ ] **Step 3:** Run `npm test -- src/skins/sleeve/sleeve.test.jsx` and verify tests pass.

---

### Task 6: Version Bump, Changelog, Verification & Preview

**Files:**
- `frontend/package.json`
- `frontend/src/changelogData.js`

- [ ] **Step 1:** Bump `version` to `0.38.5` in `frontend/package.json`.
- [ ] **Step 2:** Add entry at top of `frontend/src/changelogData.js` describing the updated source keys, Apple blue color, new Gig badge, and geometric fallback badge.
- [ ] **Step 3:** Format touched files with `npx prettier --write <files>`.
- [ ] **Step 4:** Run all verification suites:
  - `ruff check backend/app worker scripts`
  - `.venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh`
  - `cd frontend && npm run lint && npm test && npm run build`
  - `cd frontend && npm run test:e2e`
- [ ] **Step 5:** Run `scripts/preview.sh up` and capture screenshots of `/` and `/play` in Timeline and Sleeve themes.
- [ ] **Step 6:** Run `scripts/preview.sh down`.
- [ ] **Step 7:** Write differential security review and prepare hand-over.
