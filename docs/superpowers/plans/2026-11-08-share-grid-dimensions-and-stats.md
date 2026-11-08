# Share Dialog Grid Dimensions & Stats Infusions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to share listening cards with custom grid dimensions (`2×2`, `2×3`, `3×2`, `3×3`, defaulting to `3×3`) and optional toggleable stat banners (listening time with +/- % diff, active sources breakdown, and discoveries count).

**Architecture:** Extend backend `ReportSummaryResponse` and analytics queries to include period source breakdown and new discoveries counts. Update frontend `ShareDialog` and `ShareCard` with grid dimension selectors, layout styles, and infusion checkboxes that conditionally render the stats banner on the generated PNG card.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, React 18, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-08-share-grid-dimensions-and-stats.md`

## Global Constraints
- PEP 8 and PEP 484 type hints in Python; imports at top of module.
- Standard ES Modules / React 18 functional components and Hooks.
- Follow `DESIGN.md` "Flat-By-Default" and One Voice Rule (no box-shadows on card components, use approved theme tokens).
- Maintain backward compatibility for `/reports/summary` response schema with defaults for existing clients.
- Clean up tests with `afterEach(() => cleanup())` in component tests.

## Review Focus
- Empty/Zero periods: Periods with 0 scrobbles must display cleanly without division by zero errors or NaN percentages.
- Single source listening: When only one source is used (e.g. 100% Spotify), show only that single source without empty placeholders.
- Date ranges without comparison: When `compare_to_previous` is unavailable or `all.time` is selected, omit or gracefully neutralize the +/- percentage indicator.
- Dimension changes in list view: Switching between grid and list keeps the effective item count aligned with the selected dimension (4, 6, 9).
- Visual card export: html-to-image must capture the stats banner and grid layout properly at 2x resolution.

---

### Task 1: Backend Analytics Query & Schema Extensions for Source Breakdown and Discoveries

**Files:**
- Modify: `backend/app/schemas/analytics.py`
- Modify: `backend/app/queries/analytics_queries.py`
- Modify: `backend/app/services/analytics_service.py`
- Test: `backend/app/tests/test_reports_date_range.py`

**Interfaces:**
- Consumes: `ListeningEvent`, `not_blocked_clause`, `resolve_date_range`
- Produces: `ReportSummaryResponse.source_breakdown` (list of `SourceBreakdownEntry(source: str, count: int, percent: float)`) and `ReportSummaryResponse.new_discoveries` (`DiscoveriesEntry(artists: int, albums: int, tracks: int)`)

- [ ] **Step 1: Write the failing tests**
  Add unit tests in `backend/app/tests/test_reports_date_range.py` asserting that `/reports/summary` returns `source_breakdown` with counts/percentages for active sources and `new_discoveries` counts.
- [ ] **Step 2: Run test to verify it fails**
  Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_reports_date_range.py -k "test_reports_summary_sources_and_discoveries" -q`
  Expected: FAIL with missing fields or attribute error.
- [ ] **Step 3: Implement schemas and queries**
  - In `backend/app/schemas/analytics.py`, define `SourceBreakdownEntry` and `DiscoveriesEntry`, and add `source_breakdown: list[SourceBreakdownEntry] = []` and `new_discoveries: DiscoveriesEntry | None = None` to `ReportSummaryResponse`.
  - In `backend/app/queries/analytics_queries.py`, add `build_report_period_sources_query(user_id, start, end)` grouping by `ListeningEvent.source`.
  - In `backend/app/services/analytics_service.py`, compute the active sources breakdown and count of newly discovered artists/tracks within `[period_start, period_end)`.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_reports_date_range.py -q`
  Expected: PASS
- [ ] **Step 5: Commit**
  Run: `git add backend/app/schemas/analytics.py backend/app/queries/analytics_queries.py backend/app/services/analytics_service.py backend/app/tests/test_reports_date_range.py && git commit -m "feat(analytics): add source breakdown and discoveries to report summary"`

---

### Task 2: Frontend ShareCard Stats Banner and Grid Dimension Styles

**Files:**
- Modify: `frontend/src/components/ShareCard.jsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/components/ShareCard.test.jsx`

**Interfaces:**
- Consumes: `entries`, `kind`, `layout`, `dateRangeLabel`, `dimension` (`"2x2" | "2x3" | "3x2" | "3x3"`), `stats` (`{ listeningMinutes, minutesDiff, sources, discoveries }`), `enabledStats` (`{ listeningTime, sources, discoveries }`)
- Produces: Rendered share card with configurable CSS grid columns and optional `.share-card-stats-banner`.

- [ ] **Step 1: Write the failing tests**
  Create or update `frontend/src/components/ShareCard.test.jsx` verifying:
  - 3x3 dimension renders a 3-column grid container.
  - 2x3 dimension renders a 2-column grid container.
  - Enabling stats displays formatted listening time, active source pills (excluding 0% sources), and discoveries.
- [ ] **Step 2: Run test to verify it fails**
  Run: `cd frontend && npm test src/components/ShareCard.test.jsx`
  Expected: FAIL
- [ ] **Step 3: Implement ShareCard updates and CSS**
  - Update `ShareCard.jsx` to accept `dimension`, `stats`, and `enabledStats`.
  - Add `.share-card-stats-banner`, `.share-card-grid-2x2`, `.share-card-grid-2x3`, `.share-card-grid-3x2`, and `.share-card-grid-3x3` rules in `frontend/src/styles.css`.
  - Format duration (e.g. `18h 42m`) and comparison percent (`+14%` / `-8%`) with color-coded classes (`.diff-up` / `.diff-down`).
- [ ] **Step 4: Run test to verify it passes**
  Run: `cd frontend && npm test src/components/ShareCard.test.jsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  Run: `git add frontend/src/components/ShareCard.jsx frontend/src/styles.css frontend/src/components/ShareCard.test.jsx && git commit -m "feat(ui): add grid dimension support and stats banner to ShareCard"`

---

### Task 3: ShareDialog Dimension Selector & Infusion Checkboxes Controls

**Files:**
- Modify: `frontend/src/components/ShareDialog.jsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/components/ShareDialog.test.jsx`

**Interfaces:**
- Consumes: `open`, `onClose`, `kind`, `entries`, `dateRange`, `token`, `userId`, `totalCount`
- Produces: Interactive dialog with dimension selector (`3×3` default), layout toggle (Grid/List), infusion checkboxes, and preview generation.

- [ ] **Step 1: Write the failing tests**
  Update `frontend/src/components/ShareDialog.test.jsx` to test:
  - Dialog defaults to `3×3` dimension (9 items).
  - Dimension selection buttons switch between `2×2` (4), `2×3` (6), `3×2` (6), and `3×3` (9).
  - Toggling infusion checkboxes fetches reports summary and passes data into `ShareCard`.
- [ ] **Step 2: Run test to verify it fails**
  Run: `cd frontend && npm test src/components/ShareDialog.test.jsx`
  Expected: FAIL
- [ ] **Step 3: Implement ShareDialog enhancements**
  - Replace/augment slider with Dimension buttons (`2×2`, `2×3`, `3×2`, `3×3`) defaulting to `3×3`.
  - Add state for checkboxes: `includeListeningTime`, `includeSources`, `includeDiscoveries`.
  - When open or when an infusion is enabled, call `fetchReportsSummary` to load listening duration, percent diff, sources breakdown, and discoveries.
  - Pass the dimension and stats into `ShareCard`.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `cd frontend && npm test src/components/ShareDialog.test.jsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  Run: `git add frontend/src/components/ShareDialog.jsx frontend/src/styles.css frontend/src/components/ShareDialog.test.jsx && git commit -m "feat(ui): add 3x3 default dimension selector and infusion checkboxes to ShareDialog"`

---

### Task 4: Full Suite Lint, Verification, and Changelog

**Files:**
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`

- [ ] **Step 1: Run project linters and tests**
  - `ruff check backend/app worker scripts`
  - `ruff format --check backend/app worker scripts`
  - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
  - `cd frontend && npm run lint && npm test && npm run build`
- [ ] **Step 2: Update changelog & bump version**
  - Add release entry in `frontend/src/changelogData.js` describing the new `3×3` default grid dimensions, dimension options (`2×2`, `2×3`, `3×2`, `3×3`), and stats infusions (listening time, active sources, discoveries).
  - Bump minor/patch version in `frontend/package.json`.
  - Update `UserGuideSection.jsx` explaining the new Share capabilities.
- [ ] **Step 3: Run end-to-end and preview verification**
  - Run Playwright E2E tests: `cd frontend && npm run test:e2e`
- [ ] **Step 4: Commit**
  Run: `git add frontend/package.json frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx && git commit -m "docs: document share card grid dimensions and stats infusions in changelog and user guide"`
