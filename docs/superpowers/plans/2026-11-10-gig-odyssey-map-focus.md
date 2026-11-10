# Gig Odyssey Map Focus & Regional Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a clear, un-squashed UK & Ireland default view for the Gig Odyssey map with a seamless toggle to zoom out to the global view when concerts abroad exist.

**Architecture:** Update `GigOdysseyMap.jsx` to support `"uk"` and `"world"` view modes. Automatically detect international pins outside the British Isles, default to `"uk"` framing, and display a floating pill action button (`✈️ N gigs abroad · Zoom out` / `🇬🇧 Focus UK`).

**Tech Stack:** React 18, SVG projection math, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-gig-odyssey-map-focus-spec.md`

## Global Constraints
- Strictly follow `DESIGN.md` flat-by-default rules and semantic color tokens (`--color-surface`, `--color-primary`, `--tl-tile`, `--color-border`).
- Do not modify or restyle protected components like `RetroJukebox`.
- Ensure tests verify both desktop and mobile layouts.

## Review Focus
- Detection of international pins based on latitude/longitude boundaries.
- Toggle button only visible when international pins exist.
- Selecting pins and viewing tooltips functions correctly in both zoom modes.

---

### Task 1: Update `GigOdysseyMap.test.jsx` with Zoom Toggle Tests

**Files:**
- Modify: `frontend/src/components/reports/GigOdysseyMap.test.jsx`

- [ ] **Step 1: Write tests for UK focus and World zoom toggle**
  - Add test asserting that when pins include distant international venues (e.g. Las Vegas), the map defaults to UK view and renders the "Zoom out" button.
  - Add test asserting that clicking the zoom button switches to the world view and changes the button text to "Focus UK".
  - Add test asserting that when all pins are UK-based, no zoom toggle button is rendered.

- [ ] **Step 2: Run tests to verify failure**
  Run: `cd frontend && npm test -- GigOdysseyMap.test.jsx`
  Expected: Fails because the zoom toggle button is not yet implemented.

---

### Task 2: Implement Regional Framing & Zoom Toggle in `GigOdysseyMap.jsx`

**Files:**
- Modify: `frontend/src/components/reports/GigOdysseyMap.jsx`

- [ ] **Step 1: Implement view mode state and bounding box calculation**
  - Define UK/Ireland bounding constants (Lat 49.5 to 59.5, Lng -9.0 to 2.5).
  - Detect pins outside the UK region (`isAbroad: lat < 49.5 || lat > 59.5 || lng < -9.0 || lng > 2.5`).
  - Calculate dynamic bounding box depending on whether `viewMode === "uk"` or `"world"`.
  - In `"uk"` mode, project only UK pins and home city within the UK bounding box.
  - In `"world"` mode, project all pins across the global bounding box with arcs.
  - Render the toggle button in the map header when `abroadPins.length > 0`.

- [ ] **Step 3: Run tests to verify pass**
  Run: `cd frontend && npm test -- GigOdysseyMap.test.jsx`
  Expected: All tests pass.

- [ ] **Step 4: Format and lint**
  Run: `npx prettier --write frontend/src/components/reports/GigOdysseyMap.jsx frontend/src/components/reports/GigOdysseyMap.test.jsx && cd frontend && npm run lint`
  Expected: Clean linting.

---

### Task 3: Visual Verification on Preview & Handover

**Files:**
- None (verification only)

- [ ] **Step 1: Start preview and take screenshots**
  Run: `scripts/preview.sh up`
  Capture desktop and phone screenshots of the Gigs tab in UK mode and World mode.
  Inspect and confirm clear spacing and pin legibility.
- [ ] **Step 2: Clean up preview**
  Run: `scripts/preview.sh down`
- [ ] **Step 3: Run full automated checks**
  Run: `cd frontend && npm test && npm run build && npm run test:e2e`
