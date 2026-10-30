# Song Title Accent Color Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to choose their signature accent color from 8 curated music/song-title presets in Settings, dynamically styling the entire site across Light and Dark themes while preserving the app's flat, utilitarian design identity.

**Architecture:** Add an `accent_color` field to `user_preferences` (stored via Alembic migration, exposed in Pydantic schemas, and validated against the 8 allowed song presets). On the frontend, map `data-accent="<preset>"` on `<html>`, updating CSS variables (`--color-primary`, `--color-accent`, `--color-focus`, `--color-accent-soft`) and replacing hardcoded blue references in `styles.css`. In `SettingsPage.jsx`, render an accessible circular swatch picker with song titles, persisting to API and caching in `localStorage` for zero-flash startup in `index.html` and `App.jsx`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, React 18, CSS variables (`color-mix`), Vitest, Pytest.

**Spec:** Brainstorming discussion on 2026-10-30 adopting Option B (8 curated song-title presets):
1. `blue_monday` (`#0066FF`, New Order - Default)
2. `spotify_green` (`#1DB954`, Spotify)
3. `red_red_wine` (`#E11D48`, UB40)
4. `purple_rain` (`#7C3AED`, Prince)
5. `fools_gold` (`#B45309`, The Stone Roses - Rich Gold)
6. `paint_it_black` (`#475569`, The Rolling Stones - Slate)
7. `pretty_in_pink` (`#EC4899`, The Psychedelic Furs)
8. `orange_crush` (`#F97316`, R.E.M.)

## Global Constraints
- Python PEP 8 and PEP 484 type hints (`from __future__ import annotations`), imports strictly at the top of modules.
- Adhere to `DESIGN.md` "The Focused Utility" and "The One Voice Rule" (accent color used sparingly on active states, badges, buttons, and focus rings).
- Never allow unvalidated accent color values in the backend database.
- Zero layout shift, zero box-shadows, zero gradients.
- Zero flash on page reload (must hydrate from `localStorage` in `index.html` before React mounts).

## Review Focus
1. Invalid accent color string sent to `/users/me/settings` returns 422 Unprocessable Entity or 400 Bad Request.
2. Default accent color for new and existing users defaults cleanly to `blue_monday`.
3. Heatmap cells and calendar day range backgrounds dynamically reflect the active accent color without hardcoded blue hexes.
4. Setting a new accent color updates immediately in the UI without requiring a full page refresh.
5. Contrast on white buttons and badges remains accessible across all 8 presets in both Light and Dark themes.

---

### Task 1: Database Migration and Backend Model/Schema Support

**Files:**
- Create: `backend/migrations/versions/0027_add_accent_color.py`
- Modify: `backend/app/models.py:35-50`
- Modify: `backend/app/schemas/preferences.py:6-55`
- Modify: `backend/app/services/preferences_service.py:8-45`
- Test: `backend/app/tests/test_preferences.py`

**Interfaces:**
- Consumes: `UserPreferences` model and `db.session`
- Produces: `accent_color` field on `UserPreferencesResponse` and `UserPreferencesUpdate` restricted to the 8 valid preset identifiers (`blue_monday`, `spotify_green`, `red_red_wine`, `purple_rain`, `fools_gold`, `paint_it_black`, `pretty_in_pink`, `orange_crush`).

- [ ] **Step 1: Write failing backend tests for accent color**

In `backend/app/tests/test_preferences.py`:
- Test that default preferences return `accent_color == "blue_monday"`.
- Test that updating `accent_color` to `"purple_rain"` succeeds and persists.
- Test that updating `accent_color` to an invalid string like `"neon_yellow"` raises validation error or returns 422/400.

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_preferences.py -k accent_color -v`
Expected: FAIL with `AttributeError` or missing key in response.

- [ ] **Step 3: Implement database column, migration, model, schema, and service**

1. Create migration `backend/migrations/versions/0027_add_accent_color.py` revising `0026_add_festival_name`.
   - Add column `accent_color`, String(24), `nullable=False`, `server_default='blue_monday'`.
   - Add check constraint `ck_user_preferences_accent_color`: `accent_color IN ('blue_monday', 'spotify_green', 'red_red_wine', 'purple_rain', 'fools_gold', 'paint_it_black', 'pretty_in_pink', 'orange_crush')`.
2. Update `backend/app/models.py`:
   - Add `accent_color: Mapped[str] = mapped_column(String(24), nullable=False, default="blue_monday")`.
   - Add check constraint to `__table_args__`.
3. Update `backend/app/schemas/preferences.py`:
   - Define `ACCENT_COLORS = {"blue_monday", "spotify_green", "red_red_wine", "purple_rain", "fools_gold", "paint_it_black", "pretty_in_pink", "orange_crush"}`.
   - Add `accent_color: str = "blue_monday"` to `UserPreferencesResponse`.
   - Add `accent_color: str | None = None` to `UserPreferencesUpdate`.
4. Update `backend/app/services/preferences_service.py`:
   - Add `"accent_color": "blue_monday"` to `DEFAULTS`.
   - Validate `accent_color in ACCENT_COLORS` in `update()`.

- [ ] **Step 4: Run backend tests and verify they pass**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_preferences.py -v`
Run: `ruff check backend/app worker scripts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/versions/0027_add_accent_color.py backend/app/models.py backend/app/schemas/preferences.py backend/app/services/preferences_service.py backend/app/tests/test_preferences.py
git commit -m "feat(api): add accent_color user preference and migration (Planner Step 1)"
```

---

### Task 2: CSS Token Definition and Dynamic Stylesheets

**Files:**
- Modify: `frontend/src/styles.css:1-100, 700-715, 3960-3980`
- Test: `frontend/src/textContrast.test.js`

**Interfaces:**
- Consumes: `data-accent="<preset>"` attribute on `:root` / `<html>`
- Produces: CSS variables `--color-primary`, `--color-accent`, `--color-focus`, `--color-accent-hover`, `--color-accent-soft` that respond to the selected preset.

- [ ] **Step 1: Write CSS contrast and variable tests**

In `frontend/src/textContrast.test.js`:
- Add test verifying each of the 8 accent colors against white (`#ffffff`) button text meets WCAG AA for UI components ($\ge 3:1$).
- Verify `styles.css` has rules for all 8 `data-accent` presets.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/textContrast.test.js`
Expected: FAIL on missing presets in `styles.css`.

- [ ] **Step 3: Implement CSS accent variables and clean up hardcoded blue**

1. In `frontend/src/styles.css`:
   - Add `:root[data-accent="blue_monday"]`, `:root[data-accent="spotify_green"]`, `:root[data-accent="red_red_wine"]`, `:root[data-accent="purple_rain"]`, `:root[data-accent="fools_gold"]`, `:root[data-accent="paint_it_black"]`, `:root[data-accent="pretty_in_pink"]`, `:root[data-accent="orange_crush"]`.
   - Each defines `--color-primary`, `--color-accent`, `--color-focus`, `--color-accent-hover`, and `--color-accent-soft`.
   - Add dark theme overrides for `:root[data-theme="dark"][data-accent="..."]` and `@media (prefers-color-scheme: dark)`.
   - Replace hardcoded `rgba(0, 102, 255, ...)` in `.calendar-day-range` and `.heatmap-cell[data-level="..."]` with `color-mix(in srgb, var(--color-primary) <pct>%, transparent)`.
2. Format `styles.css`: `npx prettier --write src/styles.css`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/textContrast.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles.css frontend/src/textContrast.test.js
git commit -m "feat(css): define 8 song-title accent color themes with dynamic mixing (Planner Step 2)"
```

---

### Task 3: Zero-Flash Hydration in HTML and App.jsx

**Files:**
- Modify: `frontend/index.html:13-18`
- Modify: `frontend/src/App.jsx:17-30`
- Test: `frontend/src/App.test.jsx`

**Interfaces:**
- Consumes: `localStorage.getItem("audio-scrobbler-accent")` and `settings.accent_color`
- Produces: `document.documentElement.setAttribute("data-accent", accent)` before paint and after API fetch.

- [ ] **Step 1: Write test for initial accent attribute assignment in App.jsx**

In `frontend/src/App.test.jsx`:
- Mock `fetchUserSettings` returning `{ accent_color: "purple_rain", theme: "dark" }`.
- Verify `document.documentElement.getAttribute("data-accent")` is set to `"purple_rain"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/App.test.jsx`
Expected: FAIL (attribute not set).

- [ ] **Step 3: Implement early hydration and App.jsx sync**

1. In `frontend/index.html`:
   - In the inline `<script>` in `<head>`, read `localStorage.getItem('audio-scrobbler-accent')` and set attribute `data-accent`.
2. In `frontend/src/App.jsx`:
   - In the `fetchUserSettings` effect, read `settings.accent_color`, store in `localStorage`, and set `data-accent` attribute.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/App.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/src/App.jsx frontend/src/App.test.jsx
git commit -m "feat(frontend): add zero-flash accent color hydration and session sync (Planner Step 3)"
```

---

### Task 4: Settings UI Swatch Picker and Persistence

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx:150-180, 365-385`
- Test: `frontend/src/pages/SettingsPage.test.jsx`

**Interfaces:**
- Consumes: `settings.accent_color`, `changeSetting`
- Produces: Interactive swatch selector with all 8 song-title presets and tooltips/labels in Settings General tab.

- [ ] **Step 1: Write unit tests for SettingsPage accent color picker**

In `frontend/src/pages/SettingsPage.test.jsx`:
- Verify all 8 swatches are rendered with their song names ("Blue Monday", "Spotify Green", "Red Red Wine", "Purple Rain", "Fool's Gold", "Paint It Black", "Pretty in Pink", "Orange Crush").
- Clicking a swatch calls `changeSetting("accent_color", "<preset>")` and updates `document.documentElement.getAttribute("data-accent")`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/pages/SettingsPage.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement Swatch Picker in SettingsPage**

1. In `frontend/src/pages/SettingsPage.jsx`:
   - Define the `ACCENT_PRESETS` list with id, name, hex, and artist.
   - In `changeSetting`, handle `key === "accent_color"`: set `localStorage.setItem("audio-scrobbler-accent", value)` and `document.documentElement.setAttribute("data-accent", value)`.
   - In the General tab, right beneath Theme, render the **Accent Color** section with accessible buttons showing the colored circles, active ring, and song title.
2. Format: `npx prettier --write src/pages/SettingsPage.jsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/pages/SettingsPage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.jsx frontend/src/pages/SettingsPage.test.jsx
git commit -m "feat(settings): add song-title accent color swatch picker (Planner Step 4)"
```

---

### Task 5: Changelog, User Guide, Documentation & Version Bump

**Files:**
- Modify: `frontend/package.json:4`
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`
- Modify: `frontend/src/components/settings/FaqSection.jsx`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: Finalized feature details
- Produces: v0.28.9 changelog, updated FAQ and User Guide explaining how to personalize the site theme color.

- [ ] **Step 1: Update documentation and version**

1. Bump `version` in `frontend/package.json` to `"0.28.9"`.
2. Add v0.28.9 entry to top of `frontend/src/changelogData.js`:
   - Feature: "Song-Title Accent Themes: Personalize Audio Scrobbler with 8 curated music presets (Blue Monday, Spotify Green, Red Red Wine, Purple Rain, Fool's Gold, Paint It Black, Pretty in Pink, Orange Crush)."
3. In `UserGuideSection.jsx` & `FaqSection.jsx`:
   - Document how to change your theme accent color under Settings → General.
4. Update `DESIGN.md` to reference the dynamic song-title accent palette.
5. Format: `npx prettier --write frontend/package.json frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx frontend/src/components/settings/FaqSection.jsx`.

- [ ] **Step 2: Run all linters and tests to verify whole system passes**

Run:
```bash
ruff check backend/app worker scripts
ruff format --check backend/app worker scripts
PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
cd frontend && npm run lint && npm test && npm run build
```
Expected: All pass with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx frontend/src/components/settings/FaqSection.jsx DESIGN.md
git commit -m "docs(theme): bump v0.28.9, document song-title accent colors in User Guide and Changelog (Planner Step 5)"
```

---

## Post-Deploy Verification Plan
1. Agent Verification:
   - Run backend migration check (`alembic upgrade head`).
   - Run full frontend build (`npm run build`).
2. User Verification (in browser):
   - Navigate to `http://localhost:5173/settings` (or production host).
   - Click **General** tab.
   - Click each color swatch (Spotify Green, Purple Rain, Red Red Wine, Fool's Gold, etc.).
   - Verify active nav pills, heatmaps, badges, and buttons instantly adopt the selected accent.
   - Reload page and verify no white/blue flash occurs.
