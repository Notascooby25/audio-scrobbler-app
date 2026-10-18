# Impeccable Technical Audit Improvements Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the technical quality and accessibility improvements identified in the `/impeccable audit` review, including WCAG AA heading semantics, modal keyboard dismissal, badge contrast, token normalization, reduced-motion animation polish, and mobile touch target standards ($\ge 44\text{pt}$).

**Architecture:** Client-side React 18 + CSS variables enhancements. All visual changes strictly adhere to `DESIGN.md` ("Flat-by-default", hairline 0.5px borders, zero box-shadows, zero gradients, and the One Voice rule).

**Tech Stack:** React 18, Vite, Vitest, React Testing Library, ESLint, Prettier.

**Spec:** `.impeccable/audit` findings from 2026-10-18.

---

## Global Constraints
- Strictly follow `DESIGN.md` ("Flat-by-default", zero box-shadows, zero gradients, hairline 0.5px borders, and One Voice rule).
- Never reformat unrelated code; keep diffs focused and minimal.
- Pre-commit differential security review on every step before staging and committing.
- Commit messages must follow conventional format ending with `(Planner Step N)` and push to `origin main` after each step.
- Update `HANDOVER.md`, `agents/page_specs.md`, `changelogData.js`, `package.json` (`0.11.10`), and `service-worker.js` (`audio-scrobbler-shell-v10`) in Step 4.

---

## Impact Analysis
- **Components & Pages affected:**
  - `frontend/src/pages/HomePage.jsx`
  - `frontend/src/components/profile/CopyScrobblesModal.jsx`
  - `frontend/src/components/profile/CopyScrobblesModal.test.jsx`
  - `frontend/src/pages/ChangelogPage.jsx`
  - `frontend/src/components/ScopeCreepTools.jsx`
  - `frontend/src/styles.css`
  - `frontend/src/textContrast.test.js`
  - `frontend/src/libraryRows.test.js`
  - `frontend/package.json`
  - `frontend/src/changelogData.js`
  - `frontend/public/service-worker.js`
  - `agents/page_specs.md`
  - `HANDOVER.md`
- **Backend / Database / Worker affected:** None. Pure frontend presentation, styling, accessibility, and documentation.
- **Breaking changes:** None.

---

## Regression Checklist (§5)
- [x] Heading hierarchy change: Changing `<h2>` to `<h1>` on `/connect` must not break `App.test.jsx` or any layout styling.
- [x] Modal escape keydown: Escape listener in `CopyScrobblesModal` must only close when `status !== 'loading'` and must remove listener on unmount.
- [x] Reduced-motion spinner: Must not cause layout shift or CPU spikes, and must maintain polite live feedback for assistive technology.
- [x] Touch target expansion on mobile: Increasing min-height/min-width to 44px on mobile must not overflow list rows or wrap unexpectedly.

---

## Step 1 - `/impeccable harden`: Semantic Heading Hierarchy & Modal Keyboard Dismissal
- **Description:** 
  1. In `frontend/src/pages/HomePage.jsx`, update `<h2 id="summary-heading">Connect & Data Sources</h2>` to an `<h1>` so the Connect page has a proper top-level heading matching WCAG 1.3.1.
  2. In `frontend/src/components/profile/CopyScrobblesModal.jsx`, add an `Escape` keydown event listener to close the modal when `status !== 'loading'`.
  3. In `frontend/src/components/profile/CopyScrobblesModal.test.jsx`, add a test asserting that pressing `Escape` triggers `onClose`.
- **Files:**
  - `frontend/src/pages/HomePage.jsx`
  - `frontend/src/components/profile/CopyScrobblesModal.jsx`
  - `frontend/src/components/profile/CopyScrobblesModal.test.jsx`
- **Tests:**
  - `npm test -- src/components/profile/CopyScrobblesModal.test.jsx src/App.test.jsx`
  - `npm run lint`
- **Regression risk:** Low.
- **Deploy impact:** Frontend rebuild and redeploy on push to `main`.
- **Commit message:** `"feat(a11y): harden heading hierarchy on connect and escape key dismissal in copy modal (Planner Step 1)"`

---

## Step 2 - `/impeccable polish`: Badge Contrast, Token Normalization & Reduced-Motion Spinner
- **Description:**
  1. In `frontend/src/pages/ChangelogPage.jsx`, fix version badge text contrast by changing `color: '#000'` to `color: 'var(--color-surface, #ffffff)'` and fallback to `#0066FF`, achieving WCAG AA compliance (> 4.4:1).
  2. In `frontend/src/components/ScopeCreepTools.jsx`, align non-standard CSS variable names and inline fallbacks with design tokens (`--border-color` -> `--color-border`, `--color-error` -> `--color-danger`, hardcoded hex borders to `0.5px solid var(--color-spotify)`).
  3. In `frontend/src/styles.css`, under `@media (prefers-reduced-motion: reduce)`, refine `.spinner` to use a non-disorienting gentle pulse (`opacity` transition) or controlled rotation instead of abruptly freezing mid-load.
  4. In `frontend/src/textContrast.test.js`, add test asserting Changelog badge text contrast meets WCAG AA standards.
- **Files:**
  - `frontend/src/pages/ChangelogPage.jsx`
  - `frontend/src/components/ScopeCreepTools.jsx`
  - `frontend/src/styles.css`
  - `frontend/src/textContrast.test.js`
- **Tests:**
  - `npm test -- src/textContrast.test.js src/pages/ChangelogPage.test.jsx src/components/ScopeCreepTools.test.jsx`
  - `npm run lint`
- **Regression risk:** Low.
- **Deploy impact:** Frontend rebuild and redeploy on push to `main`.
- **Commit message:** `"fix(theme): polish changelog contrast, normalize scope creep tokens, and refine reduced motion spinner (Planner Step 2)"`

---

## Step 3 - `/impeccable adapt`: Mobile Touch Targets ($\ge 44\text{pt}$)
- **Description:**
  1. In `frontend/src/styles.css` under `@media (max-width: 760px)`:
     - `.entry-menu-toggle`: increase touch area to `min-width: 44px; min-height: 44px;`.
     - `.compare-toggle-btn`: increase touch target to `min-height: 44px;`.
     - `.calendar-preset-chip`, `.calendar-day-btn`, and segmented tabs buttons: set `min-height: 44px;`.
  2. In `frontend/src/libraryRows.test.js`, add unit test verifying mobile media queries enforce $\ge 44\text{px}$ touch target sizes on `.entry-menu-toggle` and related mobile controls.
- **Files:**
  - `frontend/src/styles.css`
  - `frontend/src/libraryRows.test.js`
- **Tests:**
  - `npm test -- src/libraryRows.test.js`
  - `npm run lint && npm run build`
- **Regression risk:** Low.
- **Deploy impact:** Frontend rebuild and redeploy on push to `main`.
- **Commit message:** `"feat(responsive): elevate mobile touch targets to 44pt standard (Planner Step 3)"`

---

## Step 4 - Release Version Bump (`0.11.10`) & Verification
- **Description:**
  1. Bump version to `0.11.10` in `frontend/package.json`.
  2. Add `0.11.10` entry to `frontend/src/changelogData.js`.
  3. Bump cache name to `audio-scrobbler-shell-v10` in `frontend/public/service-worker.js`.
  4. Update `agents/page_specs.md` and `HANDOVER.md`.
  5. Run all verification commands (frontend lint, full frontend vitest suite, backend/worker pytest suite, python ruff linter, and vite build).
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
- **Regression risk:** None (documentation, versioning and full test validation).
- **Deploy impact:** Deploys new release image to production GHCR and Watchtower.
- **Commit message:** `"docs: bump version to 0.11.10 and update changelog for technical audit fixes (Planner Step 4)"`

---

## Verification Plan
1. **Automated Unit Tests:**
   - `npm test -- src/components/profile/CopyScrobblesModal.test.jsx src/App.test.jsx`
   - `npm test -- src/textContrast.test.js src/pages/ChangelogPage.test.jsx`
   - `npm test -- src/libraryRows.test.js`
   - Full Vitest suite: `npm test` (35 test files, 100% passing)
   - Pytest suite: `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q` (202 passed)
2. **Linting & Code Quality:**
   - Frontend: `npm run lint` (0 errors)
   - Python: `ruff check backend/app worker scripts` (0 errors)
3. **Build:**
   - `npm run build` (Clean production asset bundle)
4. **Security Review:**
   - Mandatory differential security review on every step before commit.
