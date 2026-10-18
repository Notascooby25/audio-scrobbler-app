# Impeccable Distillation: Connect Page & Monthly Listening Summary Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ruthlessly strip away legacy clutter, duplicate components, and bloated card grids from `/connect` (`HomePage.jsx`), distilling the Monthly Listening Summary into a compact, scannable archive ledger with year chips, while streamlining redundant charts and lists.

**Architecture:** Frontend React 18 + CSS variables. Replaces monolithic, low-density repeating `.month-card` grids (`2.8rem` font size) and clunky `<form>` month inputs with a high-density, instant-filter Monthly Archive Ledger. Replaces duplicate `<ChartsPanel>` and sprawling scrobble lists with a focused Recent Ingestion Verification feed and clear contextual links. Strictly adheres to `DESIGN.md` (Flat-by-default, 0.5px hairline borders, zero box-shadows, zero gradients, One Voice rule).

**Tech Stack:** React 18, Vite, Vitest, React Testing Library, ESLint, Prettier.

**Spec:** `/impeccable distill` audit guidelines from 2026-10-18.

---

## Global Constraints
- Strictly adhere to `DESIGN.md` ("Flat-by-default", zero box-shadows, zero gradients, hairline 0.5px borders, and One Voice rule).
- Never reformat unrelated code; keep diffs focused and minimal.
- Pre-commit differential security review on every step before staging and committing.
- Commit messages must follow conventional format ending with `(Planner Step N)` and push to `origin main` after each step.
- Ensure all existing `App.test.jsx` test assertions for the Connect page pass without breaking contracts.
- Update `HANDOVER.md`, `agents/page_specs.md`, `changelogData.js`, `package.json` (`0.11.11`), and `service-worker.js` (`audio-scrobbler-shell-v11`) in Step 4.

---

## Impact Analysis
- **Components & Pages affected:**
  - `frontend/src/pages/HomePage.jsx`
  - `frontend/src/styles.css`
  - `frontend/src/monthlyLedger.test.js` (new unit test suite)
  - `frontend/src/App.test.jsx`
  - `frontend/package.json`
  - `frontend/src/changelogData.js`
  - `frontend/public/service-worker.js`
  - `agents/page_specs.md`
  - `HANDOVER.md`
- **Backend / Database / Worker affected:** None. Pure frontend presentation, styling, and UX distillation.
- **Breaking changes:** None.

---

## Regression Checklist (§5)
- [x] **Monthly metrics test contract:** `App.test.jsx` expects to find the month label (`2026-01`), total plays (`12`), and listening minutes (`240 min`). The distilled ledger must render these exact text values.
- [x] **Empty state contract:** When summary is empty, `"It's quiet in here"` empty state must still render cleanly.
- [x] **Recent scrobbles verification:** `App.test.jsx` asserts recent scrobbles render track name (`Daylight`) and source badges (`spotify`, `youtube`). The streamlined feed must preserve this rendering.
- [x] **Zero horizontal scroll on mobile:** The monthly ledger table/stream must wrap or scroll smoothly within viewport boundaries under `@media (max-width: 760px)`.

---

## Step 1 - Distill Monthly Listening Summary into a Compact Archive Ledger
- **Description:**
  1. In `frontend/src/pages/HomePage.jsx`:
     - Calculate high-level archive totals when `summary` is loaded: Total Months, Total Scrobbles Recorded, Total Hours Listened.
     - Extract unique years from `summary.summary` (e.g. `['All', '2026', '2025', ...]`) and maintain a `selectedYear` state (defaulting to `'All'`).
     - Replace the giant repeating `.month-card` grid (`2.8rem` text) with a clean, high-density **Monthly Archive Ledger**:
       - Archive stat bar at top: Total Months, Total Plays, Total Time.
       - Year filter chips (`.monthly-year-chip`) for instant client-side filtering without manual form submission.
       - Tabular ledger rows (`.monthly-ledger-row`) showing: Month (`YYYY-MM`), Plays count, Unique Tracks count, Listening Time, and a subtle proportional volume bar (`.monthly-volume-bar`).
     - Remove the clunky From/To month input form and "Refresh summary" button from the main view (keep custom range filtering cleanly accessible if needed, or streamlined).
  2. In `frontend/src/styles.css`:
     - Add styles for `.monthly-archive-ledger`, `.monthly-archive-header`, `.monthly-year-chips`, `.monthly-year-chip`, `.monthly-ledger-row`, `.monthly-volume-bar`.
  3. Create `frontend/src/monthlyLedger.test.js`:
     - Test ledger calculations, year chip filtering, and high-density rendering.
- **Files:**
  - `frontend/src/pages/HomePage.jsx`
  - `frontend/src/styles.css`
  - `frontend/src/monthlyLedger.test.js`
- **Tests:**
  - `npm test -- src/monthlyLedger.test.js src/App.test.jsx`
  - `npm run lint`
- **Regression risk:** Low.
- **Deploy impact:** Frontend rebuild and redeploy on push to `main`.
- **Commit message:** `"feat(connect): distill monthly summary into high-density archive ledger (Planner Step 1)"`

---

## Step 2 - Prune Redundant Modules & Distill Ingestion Activity Feed
- **Description:**
  1. In `frontend/src/pages/HomePage.jsx`:
     - Remove the redundant `<ChartsPanel>` from `/connect`. In its place, provide a clean, distilled handoff callout: *"Listening charts & rankings are organized in [Overview →](/overview) and [Reports →](/reports)"*.
     - Distill `<ScrobbleList>` on `/connect` into a focused **Recent Ingestion Feed**:
       - Title: "Recent Ingestion Activity"
       - Displays the latest verified plays with their source badges (e.g. Spotify, YouTube, Apple) confirming background sync health.
       - Adds a direct footer link: *"View and search your complete listening history in [Library →](/library)"*.
     - Clean up the page header: Remove the lone "Sign out" button floating next to the `<h1>` title (session sign-out is available in Settings/Profile/Dev tools).
  2. In `frontend/src/styles.css`:
     - Style the distilled Ingestion Feed and navigation callouts to match `DESIGN.md`.
- **Files:**
  - `frontend/src/pages/HomePage.jsx`
  - `frontend/src/styles.css`
- **Tests:**
  - `npm test -- src/App.test.jsx`
  - `npm run lint`
- **Regression risk:** Low.
- **Deploy impact:** Frontend rebuild and redeploy on push to `main`.
- **Commit message:** `"refactor(connect): prune duplicate charts and streamline recent ingestion feed (Planner Step 2)"`

---

## Step 3 - Global Distillation & Visual Polish Across Pages
- **Description:**
  1. In `frontend/src/pages/OverviewPage.jsx`:
     - Remove raw un-styled notice paragraphs once loaded, ensuring clean breathing room between the stats bar, date selector, and top lists.
  2. In `frontend/src/pages/ReportsPage.jsx`:
     - Ensure the reports toolbar (DateRangeSelector, Compare Previous Period toggle, Compare with Friends button) maintains clean alignment and zero redundant wrappers.
  3. In `frontend/src/styles.css`:
     - Clean up any unused legacy styles from older versions of the month cards while preserving shared table/card utility classes.
- **Files:**
  - `frontend/src/pages/OverviewPage.jsx`
  - `frontend/src/pages/ReportsPage.jsx`
  - `frontend/src/styles.css`
- **Tests:**
  - `npm test -- src/pages/OverviewPage.test.jsx src/pages/ReportsPage.test.jsx src/App.test.jsx`
  - `npm run lint && npm run build`
- **Regression risk:** Low.
- **Deploy impact:** Frontend rebuild and redeploy on push to `main`.
- **Commit message:** `"style(ui): polish global spacing and visual hierarchy across overview and reports (Planner Step 3)"`

---

## Step 4 - Release Version Bump (`0.11.11`) & Verification
- **Description:**
  1. Bump version to `0.11.11` in `frontend/package.json`.
  2. Add `0.11.11` entry to `frontend/src/changelogData.js`.
  3. Bump cache name to `audio-scrobbler-shell-v11` in `frontend/public/service-worker.js`.
  4. Update `agents/page_specs.md` and `HANDOVER.md`.
  5. Run full verification commands:
     - `cd frontend && npm run lint && npm test && npm run build`
     - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
     - `ruff check backend/app worker scripts`
- **Files:**
  - `frontend/package.json`
  - `frontend/src/changelogData.js`
  - `frontend/public/service-worker.js`
  - `agents/page_specs.md`
  - `HANDOVER.md`
- **Tests:**
  - `cd frontend && npm run lint && npm test && npm run build`
  - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
  - `ruff check backend/app worker scripts`
- **Regression risk:** None.
- **Deploy impact:** Deploys new release image to production GHCR and Watchtower.
- **Commit message:** `"docs: bump version to 0.11.11 and update changelog for distillation improvements (Planner Step 4)"`

---

## Verification Plan
1. **Automated Unit Tests:**
   - `npm test -- src/monthlyLedger.test.js src/App.test.jsx`
   - Full Vitest suite: `npm test` (all tests passing)
   - Pytest suite: `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q` (all passed)
2. **Linting & Code Quality:**
   - Frontend: `npm run lint` (0 errors)
   - Python: `ruff check backend/app worker scripts` (0 errors)
3. **Build:**
   - `npm run build` (Clean production asset bundle)
4. **Security Review:**
   - Mandatory differential security review on every step before commit.
