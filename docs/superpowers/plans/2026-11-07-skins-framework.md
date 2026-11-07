# Skins Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unified Skins Framework so Classic (default), Sleeve (Idea B), and Timeline (Idea A) switch identically, share data without drift, and are tested automatically against the token contract. This framework is implemented with **no new screens**, ensuring the Classic design remains 100% pixel-identical.

**Architecture:**
- **Registry & Hooks:** `frontend/src/skins/index.js` defines skin metadata (`supportsThemes`, `status: 'hidden' | 'preview' | 'live'`), `useSkin()` hook manages skin state, `localStorage` synchronization (`audio-scrobbler-skin`), and URL overrides (`?skin=<id>`).
- **Slot Pattern:** `frontend/src/skins/Slot.jsx` provides `<Slot name="..." />` enabling skins to override UI pieces while sharing data hooks and routes.
- **Token Contract:** `frontend/src/skins/tokens.contract.js` formalizes standard design tokens (`--color-canvas`, `--color-surface`, `--color-ink`, `--color-muted`, `--color-border`, `--color-on-accent`, etc.).
- **Backend Schema:** Add `skin` column (`String(16)`, server default `'classic'`, check constraint `ck_user_preferences_skin`) to `user_preferences` via Alembic migration `0032_add_skin_preference.py`. Update Pydantic schemas and `preferences_service.py`.
- **Gating & Zero-Regression:** Register Classic as `live`. Register Sleeve and Timeline as `hidden` with empty CSS files. Classic remains the unscoped base in `styles.css`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, React 18, Vite, Vitest.

---

## Impact Analysis

- **Affected Components / Files:**
  - `backend/app/models.py`
  - `backend/migrations/versions/0032_add_skin_preference.py`
  - `backend/app/schemas/preferences.py`
  - `backend/app/services/preferences_service.py`
  - `backend/app/tests/test_preferences.py`
  - `frontend/index.html`
  - `frontend/src/main.jsx`
  - `frontend/src/styles.css`
  - `frontend/src/skins/index.js` (new)
  - `frontend/src/skins/useSkin.js` (new)
  - `frontend/src/skins/Slot.jsx` (new)
  - `frontend/src/skins/tokens.contract.js` (new)
  - `frontend/src/skins/sleeve/sleeve.css` (new)
  - `frontend/src/skins/timeline/timeline.css` (new)
  - `frontend/src/skins/skins.test.js` (new)
  - `frontend/src/App.jsx`
  - `frontend/src/App.test.jsx`
  - `frontend/src/pages/SettingsPage.jsx`
  - `frontend/src/pages/SettingsPage.test.jsx`
  - `DESIGN.md`
- **Protected Code:** `RetroJukebox.jsx` and `RetroJukebox.module.css` are NOT touched. Classic selectors in `styles.css` are NOT changed.
- **Deploy Impact:** Merging to `main` applies Alembic migration and updates backend/frontend containers.

---

## Regression Check & Checklist

- **Classic Invariant:** Classic UI must not change. All new skin rules are scoped under `[data-skin="<id>"]`.
- **Database Migrations:** Uses `op.batch_alter_table` to guarantee cross-engine compatibility on PostgreSQL and SQLite.
- **Theme Coupling:** Sleeve forces `data-theme="dark"` while active and restores the saved theme when switching back.
- **Query Parameter Preservation:** `?skin=` parameter must be preserved across client navigation and redirects.
- **Rollback Strategy:** Revert commit on feature branch; downgrade Alembic migration via `alembic downgrade -1`.

---

## Step-by-Step Implementation Tasks

### Step 1: Backend Database Schema, Migration & Service Updates
- **Description:** Add `skin` column (`String(16)`, server default `'classic'`, check constraint `ck_user_preferences_skin: skin IN ('classic', 'sleeve', 'timeline')`) to `UserPreferences` model. Create Alembic migration `0032_add_skin_preference.py`. Update Pydantic schemas in `preferences.py` and service logic in `preferences_service.py`.
- **Files:**
  - `backend/app/models.py`
  - `backend/migrations/versions/0032_add_skin_preference.py`
  - `backend/app/schemas/preferences.py`
  - `backend/app/services/preferences_service.py`
  - `backend/app/tests/test_preferences.py`
- **Tests:** `PYTHONPATH=worker python -m pytest backend/app/tests -q`
- **Risks:** Migration must execute cleanly with zero downtime. Using batch alter ensures compatibility.
- **Commit Message:** `feat(db): add skin preference column and migration (Planner Step 1)`

### Step 2: Skin Registry, Token Contract & Slot Helper
- **Description:** Create the core skins infrastructure:
  1. `frontend/src/skins/index.js`: Registry containing `classic` (`live`, `supportsThemes: true`), `sleeve` (`hidden`, `supportsThemes: false`), and `timeline` (`hidden`, `supportsThemes: true`).
  2. `frontend/src/skins/tokens.contract.js`: Contract list of required semantic tokens (`--color-canvas`, `--color-surface`, `--color-ink`, `--color-muted`, `--color-border`, `--color-on-accent`, etc.).
  3. `frontend/src/skins/Slot.jsx`: Slot component that renders active skin's slot component or fallback child.
  4. Create placeholder CSS files: `frontend/src/skins/sleeve/sleeve.css` and `frontend/src/skins/timeline/timeline.css`.
- **Files:**
  - `frontend/src/skins/index.js`
  - `frontend/src/skins/tokens.contract.js`
  - `frontend/src/skins/Slot.jsx`
  - `frontend/src/skins/sleeve/sleeve.css`
  - `frontend/src/skins/timeline/timeline.css`
- **Tests:** Unit test creation in Step 3.
- **Risks:** None (pure additions).
- **Commit Message:** `feat(skins): create skin registry, token contract, and slot helper (Planner Step 2)`

### Step 3: Frontend Token Contract Mapping & Automated Test Suite
- **Description:**
  1. Map semantic contract tokens in `frontend/src/styles.css` `:root` (`--color-canvas`, `--color-ink`, `--color-muted`, `--color-border`, `--color-border-subtle`, `--color-on-accent`, `--radius-pill: 999px`, `--space-gutter: 16px`, `--nav-height: 0px`).
  2. Create `frontend/src/skins/skins.test.js` asserting:
     - Token contract completeness for all registered skins across supported themes.
     - Slot helper renders skin slot when present, and fallback when missing.
     - Flat design audit (zero gradients, zero box-shadows) across all skin CSS files.
     - Scope check (all selectors in `skins/<id>/*.css` start with `[data-skin="<id>"]`).
- **Files:**
  - `frontend/src/styles.css`
  - `frontend/src/skins/skins.test.js`
- **Tests:** `cd frontend && npx vitest run src/skins/skins.test.js`
- **Risks:** Classic visual styling must not shift.
- **Commit Message:** `test(skins): add token contract and skin test suite (Planner Step 3)`

### Step 4: No-Flash Script, useSkin Hook & App Integration
- **Description:**
  1. Update `frontend/index.html` inline `<head>` script to read `localStorage.getItem("audio-scrobbler-skin")` and set `document.documentElement.setAttribute("data-skin", skin || "classic")`.
  2. Create `frontend/src/skins/useSkin.js` implementing skin state, `?skin=<id>` URL override check (allowing preview of hidden skins), `localStorage` persistence, and `data-theme` preservation/restoration for dark-only skins.
  3. Update `frontend/src/App.jsx` to initialize and provide skin context, and import `sleeve.css` and `timeline.css` in `frontend/src/main.jsx`.
- **Files:**
  - `frontend/index.html`
  - `frontend/src/skins/useSkin.js`
  - `frontend/src/App.jsx`
  - `frontend/src/main.jsx`
  - `frontend/src/App.test.jsx`
- **Tests:** `cd frontend && npx vitest run src/App.test.jsx`
- **Risks:** Ensure `data-skin="classic"` is always present and active by default.
- **Commit Message:** `feat(skins): implement useSkin hook, no-flash script, and url override (Planner Step 4)`

### Step 5: Settings Appearance Skin Control
- **Description:** Update `frontend/src/pages/SettingsPage.jsx` Appearance section with a "Skin" labelled selector:
  - Lists available skins (`live`, plus `preview` if enabled).
  - Supports switching via `?skin=` URL override for testing hidden skins.
  - When skin with `supportsThemes: false` is active, theme selector is disabled/hidden.
  - Switching back to a theme-supporting skin restores the saved theme.
- **Files:**
  - `frontend/src/pages/SettingsPage.jsx`
  - `frontend/src/pages/SettingsPage.test.jsx`
- **Tests:** `cd frontend && npx vitest run src/pages/SettingsPage.test.jsx`
- **Risks:** Everyday users must see Classic active and no regressions in existing theme/accent controls.
- **Commit Message:** `feat(settings): add appearance skin picker (Planner Step 5)`

### Step 6: Codify Skins Section in DESIGN.md & Release Notes
- **Description:**
  1. Add a dedicated "Skins" section to `DESIGN.md` documenting the Skins Framework architecture, pointing to `docs/design/skins-framework.md`, `docs/design/sleeve-skin.md`, and `docs/design/timeline-skin.md`.
  2. Update `frontend/src/changelogData.js` and bump version to `v0.36.0` in `frontend/package.json`.
- **Files:**
  - `DESIGN.md`
  - `frontend/src/changelogData.js`
  - `frontend/package.json`
- **Tests:** `cd frontend && npm run lint && npm test && npm run build`
- **Risks:** None.
- **Commit Message:** `docs(design): codify skins framework in DESIGN.md and record changelog (Planner Step 6)`

---

## Verification & Go-Ahead Checks

1. **Automated CI Suite:**
   - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q` (100% pass)
   - `cd frontend && npm run lint && npm test && npm run build` (100% pass)
   - `cd frontend && npm run test:e2e` (Playwright E2E pass)
2. **Classic Pixel-Identical Verification:**
   - Start preview: `scripts/preview.sh up`
   - Visit app in Classic mode: verify all pages (`/`, `/library`, `/play`, `/reports`, `/gigs`, `/settings`, `/profile`) look 100% identical to `main`.
3. **URL Override & Preview Verification:**
   - Visit `http://localhost:5173/settings?skin=sleeve` $\rightarrow$ verifies `data-skin="sleeve"` is applied to `<html>`, theme forces to dark, and reloading page maintains skin without flash.
   - Visit `http://localhost:5173/settings?skin=classic` $\rightarrow$ verifies restores Classic and saved user theme/accent.
