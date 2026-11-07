# Timeline Skin Phase 1: Tokens, Typography, and Contrast Matrix Implementation Plan

**Goal:** Implement Phase 1 of the Timeline Skin (`docs/design/timeline-skin.md`) by adding the self-hosted Schibsted Grotesk font, defining the light and dark CSS tokens in `frontend/src/skins/timeline/timeline.css`, calculating and testing the contrast matrix across both themes and all 8 accent presets, and verifying that Classic and Sleeve remain 100% untouched.

**Branch:** `feat/timeline-skin-phase-1`

---

## 1. Impact Analysis
- **Frontend Dependencies:**
  - Add `@fontsource/schibsted-grotesk` (`^5.3.0`) to `frontend/package.json` for self-hosted, offline-ready grotesque typography.
- **Frontend Styles:**
  - `frontend/src/skins/timeline/timeline.css`: Populate scoped CSS variables under `[data-skin="timeline"]` for light, dark, and system themes, along with `--tl-*` tokens and `--tl-mark` accent contrast adjustments.
- **Frontend Entry:**
  - `frontend/src/main.jsx`: Import `@fontsource/schibsted-grotesk/400.css`, `500.css`, `600.css`, and `700.css`.
- **Automated Tests:**
  - `frontend/src/skins/skins.test.jsx`: Update token contract assertions to verify `timeline.css` defines all required tokens.
  - `frontend/src/skins/timeline/timeline.test.jsx`: New test file testing contrast ratios across light and dark modes and all 8 accent colors.
  - Regression assertions ensuring Classic and Sleeve styles and tests remain green.

---

## 2. Regression Checklist & Blast Radius Protection
- **Classic Skin Protection:** All new rules must strictly reside inside `[data-skin="timeline"]` selectors in `frontend/src/skins/timeline/timeline.css`. Zero unscoped rules.
- **Sleeve Skin Protection:** Sleeve selectors and CSS variables (`--sl-*`, `--sleeve`) are completely untouched.
- **Flat-By-Default Invariant:** Zero gradients, zero box-shadows (except focus outlines) per `DESIGN.md`.
- **Theme & Accent Compatibility:** Timeline supports Light, Dark, and System modes, and all 8 accent colors. Contrast matrix automated test verifies all combinations meet WCAG AA standards.
- **Rollback:** `git checkout main && git branch -D feat/timeline-skin-phase-1`.

---

## 3. Step-by-Step Implementation

### Step 1: Install `@fontsource/schibsted-grotesk` & Import Typography
- **Description:** Install self-hosted `@fontsource/schibsted-grotesk` dependency and import weights 400, 500, 600, and 700 in `main.jsx`.
- **Files:** `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/main.jsx`
- **Tests:** `cd frontend && npm run build`
- **Regression Risk:** Low - font files are bundled by Vite and loaded only when referenced by font-family.
- **Commit Message:** `feat(timeline): add schibsted grotesk font dependency and imports (Planner Step 1)`

### Step 2: Define Design Tokens & Contrast Overrides in `timeline.css`
- **Description:** Populate `frontend/src/skins/timeline/timeline.css` with:
  - Base `[data-skin="timeline"]` light tokens: `--color-canvas: #F2F4F5`, `--color-surface: #FFFFFF`, `--color-ink: #0E1A24`, `--color-muted: #55626D`, `--color-border: #DDE3E7`, `--color-border-subtle: #EDF0F2`, `--tl-rail: #CBD3D9`, `--tl-tile: #DDE3E7`, `--color-danger: #B3261E`, `--font-display: 'Schibsted Grotesk', sans-serif`, `--font-body: 'Schibsted Grotesk', sans-serif`, `--radius-sm: 6px`, `--radius-md: 12px`, `--radius-pill: 9999px`, `--space-gutter: 16px`, `--nav-height: 72px`.
  - Dark theme tokens `[data-skin="timeline"][data-theme="dark"]` and `@media (prefers-color-scheme: dark)` when `data-theme="system"`: `--color-canvas: #0E1A24`, `--color-surface: #16242F`, `--color-ink: #E8EDF0`, `--color-muted: #9AA9B5`, `--color-border: #2A3A47`, `--color-border-subtle: #1E2D39`, `--tl-rail: #3A4B58`, `--tl-tile: #22323E`, `--color-danger: #F2B8B5`.
  - Marker accent overrides: `--tl-mark: var(--color-primary)` with adjustments for Fool's Gold on light (`color-mix(in srgb, var(--color-primary) 80%, #000)`) and Paint It Black on dark (`color-mix(in srgb, var(--color-primary) 60%, #fff)`) to guarantee $\ge 3:1$ contrast against canvas.
- **Files:** `frontend/src/skins/timeline/timeline.css`
- **Tests:** `cd frontend && npm run lint`
- **Regression Risk:** Low - strictly scoped under `[data-skin="timeline"]`.
- **Commit Message:** `feat(timeline): implement light and dark design tokens and marker contrast (Planner Step 2)`

### Step 3: Automated Unit & Contrast Matrix Tests
- **Description:** Add `frontend/src/skins/timeline/timeline.test.jsx` verifying:
  - Token contract compliance (all required tokens defined).
  - Mathematical WCAG AA contrast verification across light and dark tokens.
  - Accent contrast matrix asserting `--tl-mark` achieves $\ge 3:1$ against canvas across all 8 accents in both themes.
  - Flat-by-default rules (zero gradients/shadows).
- **Files:** `frontend/src/skins/timeline/timeline.test.jsx`, `frontend/src/skins/skins.test.jsx`
- **Tests:** `cd frontend && npm test`
- **Regression Risk:** Low - test verification only.
- **Commit Message:** `test(timeline): add contrast matrix and token contract unit tests (Planner Step 3)`

### Step 4: Preview Verification & Screenshots
- **Description:** Run `scripts/preview.sh up`, capture 390px mobile and 1440px desktop screenshots of `/?skin=timeline` and `/settings?skin=timeline` in both Light and Dark modes. Document findings in `timeline_preview.md`. Stop preview with `scripts/preview.sh down`.
- **Files:** `timeline_preview.md`
- **Tests:** `bash scripts/preview_settings_check.sh`
- **Regression Risk:** None - isolated preview test.
- **Commit Message:** `docs(timeline): capture phase 1 tokens and contrast preview screenshots (Planner Step 4)`

---

## 4. Engineering Verification Checklist
1. `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`
2. `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
3. `cd frontend && npm run lint && npm test && npm run build`
4. `cd frontend && npm run test:e2e`
5. Differential review of the working branch.
