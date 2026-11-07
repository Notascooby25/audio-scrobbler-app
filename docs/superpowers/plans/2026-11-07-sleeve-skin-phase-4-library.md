# Sleeve Skin Phase 4: Library Implementation Plan

> **For agentic workers:** Execute via native directly upon plan approval. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 4 ("Library") of the Sleeve visual skin according to `docs/design/sleeve-skin.md` and `docs/design/skins-framework.md`. Provide the album-led, high-density Library experience featuring Young Serif page headings, 44px search pill, 40px section pill tabs (Scrobbles / Artists / Albums / Tracks), serif day headings, 48px artwork tiles, and list rows with 1px `--sl-edge` dividers and 44px tap targets. Classic remains 100% pixel-identical.

**Architecture:**
- **Markup & Layout Reuse:**
  - `LibraryPage.jsx` data hooks and state machine are 100% preserved.
  - `LibraryScrobbleList.jsx` already groups entries by day (`.scrobble-day h3`) and renders `.library-scrobble-row`.
  - `LibraryRankList.jsx`, `LikedHeart.jsx`, `Pagination.jsx`, `PageSizeSelect.jsx`, and `DateRangeSelector.jsx` are styled under `[data-skin="sleeve"]`.
- **Scoped Sleeve CSS (`frontend/src/skins/sleeve/sleeve.css`):**
  - **Header & Title:** `.analytics-page-title` in Young Serif 34px, line-height 1.05.
  - **Search Input:** 44px pill on `--sl-card` with 22px border radius, `--sl-edge` border, white text, and `--sl-muted` placeholder.
  - **Section Tabs:** Scrobbles / Artists / Albums / Tracks 40px pills: selected is solid `#ffffff` with ground-colored text, unselected has 1px `--sl-edge` outline.
  - **Serif Day Headings:** `.scrobble-day h3` in Young Serif 19–20px, white text.
  - **List Rows:** Min-height 64px, 48px square tile, title (16px / 600 Hanken Grotesk), artist/secondary line (14px / 400 `--sl-muted`), relative timestamp on the right, 44px heart tap target, 1px `--sl-edge` divider between rows.
  - **Rank List & Grid:** Ranked items (Artists, Albums, Tracks) with numbered badges or tiles, 1px `--sl-edge` borders.
  - **Pagination:** 40px pill buttons, active white with ground text, inactive outline with muted text.
  - **Bulk Selection Bar:** Deep ground background, 1px `--sl-edge` border, 44px white pill action buttons.

**Tech Stack:** React 18, Vite, Vitest, CSS tokens, Playwright.

---

## Impact Analysis

- **Affected Components / Files:**
  - `frontend/src/skins/sleeve/sleeve.css`
  - `frontend/src/skins/sleeve/sleeve.test.jsx`
  - `frontend/src/pages/LibraryPage.jsx` (only if styling hooks or class names are needed; zero logic changes)
- **Protected Code:**
  - `RetroJukebox.jsx` and `RetroJukebox.module.css` are NOT touched.
  - Classic rules in `styles.css` are NOT touched.
- **Deploy Impact:** None on database or backend; pure frontend CSS/component polish.

---

## Regression Check & Checklist

- **Classic Invariant:** Classic `/library` must remain 100% pixel-identical in both light and dark themes.
- **Touch Targets:** All interactive elements (heart buttons, search clear, pagination, view toggles) $\ge 44\text{px}$.
- **Contrast:** Primary text $\ge 12:1$ AAA; muted text $\ge 7:1$ AAA; active pills $\ge 10:1$ AAA.
- **Flat Rules:** Zero CSS gradients, zero non-none `box-shadow` declarations.
- **Blast Radius:** `LibraryRankList` and `LikedHeart` are also used on Overview and Reports; verify that Sleeve library styling does not break other pages by scoping with `.library-layout` or page containers.

---

## Step-by-Step Implementation Tasks

### Step 1: Scoped Sleeve CSS for Library Page Shell, Search & Tabs
- **Description:** Add scoped CSS rules in `frontend/src/skins/sleeve/sleeve.css` for:
  - Library page heading in 34px Young Serif.
  - 44px pill search bar on `--sl-card` with `--sl-edge` border and high-contrast placeholder.
  - 40px section pill tabs (`.library-tabs .segmented-tab`): active white pill with ground text, inactive transparent with 1px border.
  - DateRangeSelector and toolbar layout alignment.
- **Files:**
  - `frontend/src/skins/sleeve/sleeve.css`
- **Tests:** `cd frontend && npx vitest run src/skins/skins.test.jsx`
- **Commit Message:** `feat(skins): add sleeve styles for library shell search and tabs (Planner Step 1)`

### Step 2: Scoped Sleeve CSS for Scrobble Day Groups & List Rows
- **Description:** Style the scrobble rows and day headings under `[data-skin="sleeve"]`:
  - Day headings (`.scrobble-day h3`) in 20px Young Serif.
  - Row container (`.library-scrobble-row`): 64px min-height, 1px `--sl-edge` bottom divider, 48px square artwork tile with 4px border-radius.
  - Title in 16px / 600 Hanken Grotesk (`#ffffff`), secondary line in 14px / 400 `--sl-muted`.
  - Right-aligned timestamp in 13px `--sl-muted`.
  - Heart button and per-entry menu button $\ge 44\text{px}$ touch targets.
- **Files:**
  - `frontend/src/skins/sleeve/sleeve.css`
- **Tests:** `cd frontend && npx vitest run src/skins/skins.test.jsx`
- **Commit Message:** `feat(skins): add sleeve day headings and scrobble list rows (Planner Step 2)`

### Step 3: Scoped Sleeve CSS for Ranked Lists, Grid Views & Pagination
- **Description:** Style ranked artists/albums/tracks and pagination controls under `[data-skin="sleeve"]`:
  - `.library-rank-row`: 48px tile/avatar, rank number badge, 1px `--sl-edge` dividers.
  - Grid view (`.library-rank-grid`): tiles with 6px border-radius, 1px `--sl-edge` border, hover state.
  - Pagination buttons (`.pagination-button`, `.page-number`): 40px pills, active white with ground text, inactive outline.
  - Bulk action bar: `--sl-deep` background, 1px `--sl-edge` border, white action buttons.
- **Files:**
  - `frontend/src/skins/sleeve/sleeve.css`
- **Tests:** `cd frontend && npx vitest run src/skins/skins.test.jsx`
- **Commit Message:** `feat(skins): style sleeve library ranked lists grid view and pagination (Planner Step 3)`

### Step 4: Unit Tests & Scope/Flat Verification
- **Description:** Add unit tests to `frontend/src/skins/sleeve/sleeve.test.jsx` verifying:
  - Library layout renders under Sleeve skin with Young Serif headings.
  - Verify flat rules (zero gradients, zero shadows) and scope check pass.
- **Files:**
  - `frontend/src/skins/sleeve/sleeve.test.jsx`
- **Tests:** `cd frontend && npx vitest run src/skins/sleeve/sleeve.test.jsx src/skins/skins.test.jsx`
- **Commit Message:** `test(skins): verify sleeve library views and test suite (Planner Step 4)`

### Step 5: Automated Verification & Mobile Preview Screenshots
- **Description:**
  - Run all linters: `cd frontend && npm run lint` and `ruff check backend/app worker scripts`.
  - Run all unit test suites: `cd frontend && npm test` and `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`.
  - Run production build: `cd frontend && npm run build`.
  - Run Playwright E2E tests: `cd frontend && npm run test:e2e`.
  - Spin up preview: `scripts/preview.sh up`.
  - Capture $390\text{px}$ mobile screenshots of `/library` in both Classic and Sleeve skins.
  - Tear down preview: `scripts/preview.sh down`.
- **Files:**
  - `file:///home/andyl/.gemini/antigravity/brain/89996a16-4025-4a64-a4c0-0409b3ebb9af/mobile_preview.md`
- **Tests:** Automated verification commands.
- **Commit Message:** `test(skins): verify sleeve library with full test suite and preview (Planner Step 5)`

---

Confirm to proceed.
