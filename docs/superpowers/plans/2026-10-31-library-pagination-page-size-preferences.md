# Library Pagination & Category Visible Amount Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change library visible amount pagination options to `5, 10, 20, 50, 100, 250` (replacing the previous `25, 50, 100, 250`), allow users to set both a global default page size and category-specific page sizes (`Scrobbles`, `Artists`, `Albums`, `Tracks`) in Settings under "Views", and have the Library page automatically apply the category's preferred visible amount on initial load and when switching tabs while keeping the pagination buttons at the bottom.

**Architecture:**
1. Database: Add a new Alembic migration `0030_add_category_page_sizes.py` to widen `ck_user_preferences_page_size` to include 5 and 20 (`IN (5, 10, 20, 25, 50, 100, 150, 200, 250)`), and add columns `scrobbles_page_size`, `artists_page_size`, `albums_page_size`, and `tracks_page_size` to `user_preferences`.
2. Backend Services & Schemas: Update `backend/app/models.py`, `backend/app/schemas/preferences.py`, and `backend/app/services/preferences_service.py` to validate and save the new category-level page sizes.
3. Frontend PageSizeSelect: Update `frontend/src/components/PageSizeSelect.jsx` options to `[5, 10, 20, 50, 100, 250]`.
4. Settings Page: In `frontend/src/pages/SettingsPage.jsx` under the "Views" tab, add controls for Default page size and each category's page size (`Scrobbles`, `Artists`, `Albums`, `Tracks`) with options to inherit Default or choose a specific size.
5. Library Page: In `frontend/src/pages/LibraryPage.jsx`, initialize page size from the active category's preference (or global default), switch page size automatically when clicking category tabs, and keep the bottom `PageSizeSelect` bar interactive for on-the-fly adjustments.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, React 18, Vitest, Pytest.

**Spec:** Inline in this plan (`docs/superpowers/plans/2026-10-31-library-pagination-page-size-preferences.md`).

## Global Constraints

- Preserve backwards compatibility with existing database rows where `default_page_size` might be `25`, `50`, or `100`.
- The new numbered migration must be `0030_add_category_page_sizes.py` and run cleanly against both SQLite and PostgreSQL.
- Never edit legacy/dead code (`backend/app/db/queries/analytics_queries.py`).
- Follow project coding standards: PEP 8, typed models, React 18 hooks, and Flat-By-Default design rules.

## Review Focus

- When switching tabs on Library (e.g. from Scrobbles with 100 per page to Artists with 20 per page), the active page must reset to 1 and query with `limit=20`.
- If a category page size is not explicitly set (`null`), it must cleanly inherit `default_page_size`.
- Selecting any of the 6 options (`5, 10, 20, 50, 100, 250`) on the bottom `PageSizeSelect` bar during a session must immediately update the visible items and pagination calculation (`totalPages = Math.ceil(totalCount / pageSize)`).
- The settings form in "Views" tab must save without errors when selecting page sizes, and reflect saved values on reload.
- The Alembic migration upgrade and downgrade scripts must work on both PostgreSQL and SQLite without locking or constraint violation errors.

---

### Task 1: Database Migration & Backend Preferences Schema

**Files:**
- Create: `backend/migrations/versions/0030_add_category_page_sizes.py`
- Modify: `backend/app/models.py:34-75`
- Modify: `backend/app/schemas/preferences.py:8-68`
- Modify: `backend/app/services/preferences_service.py:10-58`
- Test: `backend/app/tests/test_preferences.py`
- Test: `backend/app/tests/test_migrations.py`

**Interfaces:**
- `UserPreferences` model: adds `scrobbles_page_size`, `artists_page_size`, `albums_page_size`, `tracks_page_size` (all `Mapped[int | None]`).
- `PAGE_SIZES = {5, 10, 20, 25, 50, 100, 150, 200, 250}` in `schemas/preferences.py`.
- `UserPreferencesResponse` and `UserPreferencesUpdate` schemas include the 4 new category page size fields.

- [ ] **Step 1: Write the failing tests in `backend/app/tests/test_preferences.py`**
  Add tests asserting that 5 and 20 are accepted for `default_page_size`, and category page sizes (`artists_page_size`, `albums_page_size`, etc.) can be updated and retrieved. Update existing `test_settings_rejects_invalid_page_size` to test an actually invalid number (e.g. 33).

- [ ] **Step 2: Run test to verify it fails**
  Run: `PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests/test_preferences.py -q`
  Expected: FAIL.

- [ ] **Step 3: Implement model, schema, service, and Alembic migration `0030`**
  - Create `backend/migrations/versions/0030_add_category_page_sizes.py` revising `0029_add_jukebox_archive_limit`.
  - Update `backend/app/models.py` check constraint `ck_user_preferences_page_size` and add the 4 columns.
  - Update `backend/app/schemas/preferences.py` and `backend/app/services/preferences_service.py`.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests/test_preferences.py backend/app/tests/test_migrations.py -q`
  Expected: PASS.

---

### Task 2: Update `PageSizeSelect.jsx` Options to `5, 10, 20, 50, 100, 250`

**Files:**
- Modify: `frontend/src/components/PageSizeSelect.jsx:1-3`
- Create: `frontend/src/components/PageSizeSelect.test.jsx`

**Interfaces:**
- `PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 250]`

- [ ] **Step 1: Write failing test in `frontend/src/components/PageSizeSelect.test.jsx`**
  Verify all 6 options (`5, 10, 20, 50, 100, 250`) are rendered as segmented tabs and clicking them calls `onChange` with the numeric value.

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd frontend && npm test -- src/components/PageSizeSelect.test.jsx`
  Expected: FAIL.

- [ ] **Step 3: Update `PageSizeSelect.jsx`**
  Set `PAGE_SIZE_OPTIONS` and `ALL_OPTIONS` to `[5, 10, 20, 50, 100, 250]`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `cd frontend && npm test -- src/components/PageSizeSelect.test.jsx`
  Expected: PASS.

---

### Task 3: Settings Page "Views" Tab: Default & Category Page Sizes

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx:44-50, 460-470, 545-568`
- Modify: `frontend/src/pages/SettingsPage.test.jsx:33-47`

**Interfaces:**
- In "Views" tab (`activeTab === "views"`):
  - Add "Default visible amount per page" (`default_page_size`).
  - Add category page size selects for Scrobbles, Artists, Albums, and Tracks (`scrobbles_page_size`, `artists_page_size`, `albums_page_size`, `tracks_page_size`). Each category option dropdown includes: "Default (inherited)" and explicit options `5, 10, 20, 50, 100, 250`.

- [ ] **Step 1: Write failing test in `frontend/src/pages/SettingsPage.test.jsx`**
  Verify that the Views tab renders the page size selectors and changing category visible amounts triggers `updateUserSettings` with the updated value.

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd frontend && npm test -- src/pages/SettingsPage.test.jsx`
  Expected: FAIL.

- [ ] **Step 3: Implement the Views page size settings in `SettingsPage.jsx`**

- [ ] **Step 4: Run test to verify it passes**
  Run: `cd frontend && npm test -- src/pages/SettingsPage.test.jsx`
  Expected: PASS.

---

### Task 4: Library Page Tab Switching & Dynamic Category Page Sizes

**Files:**
- Modify: `frontend/src/pages/LibraryPage.jsx:50-115, 550-565`
- Modify: `frontend/src/pages/AnalyticsPages.test.jsx`

**Interfaces:**
- Helper `getPageSizeForTab(tabName, userSettings)` returns `userSettings?.[${tabName}_page_size] || userSettings?.default_page_size || 50`.
- When switching tabs via `setTab(value)`:
  - If a category page size preference exists for the target tab, update `pageSize` to `getPageSizeForTab(value, settings)`.
  - Reset `page` to 1.
- Initial load applies `getPageSizeForTab(initialTab, userSettings)`.

- [ ] **Step 1: Write failing test in `frontend/src/pages/AnalyticsPages.test.jsx`**
  Verify that switching tabs in Library applies the tab's preferred page size and requests the backend with the corresponding limit.

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd frontend && npm test -- src/pages/AnalyticsPages.test.jsx`
  Expected: FAIL.

- [ ] **Step 3: Implement dynamic tab page sizes in `LibraryPage.jsx`**

- [ ] **Step 4: Run test to verify it passes**
  Run: `cd frontend && npm test -- src/pages/AnalyticsPages.test.jsx`
  Expected: PASS.

---

### Task 5: Documentation, Changelog & Version Bump

**Files:**
- Modify: `frontend/package.json` (bump to `0.30.5`)
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`
- Modify: `frontend/src/components/settings/FaqSection.jsx`

- [ ] **Step 1: Bump version and add changelog entry**
- [ ] **Step 2: Update User Guide and FAQ sections describing the new visible amount options (5, 10, 20, 50, 100, 250) and per-category settings**
- [ ] **Step 3: Run all linters, full test suite and build**
  Run:
  - `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`
  - `PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests worker/tests -q`
  - `cd frontend && npm run lint && npm test && npm run build`
