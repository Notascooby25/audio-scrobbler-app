# Impeccable Onboard, Adapt, and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the top 3 priority issues identified in the Impeccable Design Critique by transforming the Connect page into an onboarding hub (hiding internal dev tools in production), restoring mobile parity for Library bulk selection, adding loading states to Reports, and hardening design system tokens.

**Architecture:** Maintain "The Focused Utility" design system (`DESIGN.md`: Flat-by-default, zero box-shadows, zero gradients, 0.5px hairline borders). Frontend-only changes in React components (`HomePage.jsx`, `HeaderNav.jsx`, `ReportsPage.jsx`, `LibraryPage.jsx`) and CSS tokens in `styles.css`.

**Tech Stack:** React 18, Vite, React Router v6, Vitest, CSS3 custom properties.

**Spec:** Impeccable critique findings recorded in `.impeccable/critique/2026-10-18T14-02-33Z__frontend.md`.

## Global Constraints

- **Strict Flat Aesthetic:** No `box-shadow`, no CSS gradients, 0.5px hairline borders (`var(--color-border)`).
- **The One Voice Rule:** Primary blue accent (`#0066FF`) used only for primary CTAs and active states (≤5% of screen).
- **Accessible Design:** WCAG AA contrast compliance (≥ 4.5:1) in both light (`#ffffff`) and dark (`#1e1e1e`) themes; minimum 44px touch targets on mobile interactive controls.
- **Outline Icons Only:** No raw OS emoji (e.g. replace 🔔 with outline SVG).
- **Production Cleanliness:** Never leak developer debug scaffolding (`Development user ID [ 1 ]`) into production builds.

## Review Focus

1. **Dev Mode Isolation:** Ensure development sign-in bypass remains available in local development (`import.meta.env.DEV`) without leaking into production.
2. **Touch Sizing on Handhelds:** Mobile bulk checkboxes and buttons must be comfortably clickable (minimum 44×44px hitboxes) without overlapping song metadata.
3. **Dark Mode Text Contrast:** Ensure `.bulk-action-bar` and metadata spans maintain high contrast across both light and dark themes.
4. **Race Conditions & Loading Spinners:** Reports date switching must indicate loading immediately without stale numbers misleading the user.
5. **Screen Reader Announcements:** Notification bell link must have a descriptive text label with unread count.

---

### Task 1: `/impeccable onboard` — Clean Up Connect Page and HeaderNav Notification Bell

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx`
- Modify: `frontend/src/components/HeaderNav.jsx`
- Modify: `frontend/src/components/HeaderNav.test.jsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `import.meta.env.DEV` for environment checking; `unreadCount` from notifications context.
- Produces: Polished Data Sources Hub on `/connect`; accessible SVG bell icon with badge in `HeaderNav`.

- [ ] **Step 1: Write failing test in `HeaderNav.test.jsx` for outline SVG icon and accessible label**
  Assert that the notification link contains an SVG bell icon and carries an accessible `aria-label` stating unread count (e.g. "Notifications" or "X unread notifications").
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- src/components/HeaderNav.test.jsx`
  Expected: FAIL because 🔔 emoji is currently used without SVG or dynamic `aria-label`.
- [ ] **Step 3: Update `HeaderNav.jsx` with SVG icon and accessible styling**
  Replace raw `🔔` with an outline SVG icon matching `DESIGN.md`. Style the unread badge using `var(--color-danger)` and `var(--color-surface)`.
- [ ] **Step 4: Update `HomePage.jsx` (`/connect`) to present a clean Data Sources Hub**
  - Structure the view into clear source sections: Spotify Connection (Connected status vs Connect button), File Import (Spotify / YouTube JSON), and Other Sources (BBC Sounds Scope Creep, Apple Music).
  - Wrap the "Development user ID" input and manual "Sign in" bypass inside a dedicated collapsible "Developer tools" panel only visible when `import.meta.env.DEV` is true.
- [ ] **Step 5: Run tests and linter to verify pass**
  Run: `npm test -- src/components/HeaderNav.test.jsx && npm run lint`
  Expected: PASS with 0 lint errors.
- [ ] **Step 6: Commit and push**
  `git commit -m "feat(connect): polish data sources onboarding hub and replace emoji bell with accessible icon (Planner Step 1)" && git push`

---

### Task 2: `/impeccable adapt` — Restore Mobile Parity for Library Bulk Selection

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/pages/LibraryPage.jsx`
- Modify: `frontend/src/components/LibraryRankList.test.jsx`

**Interfaces:**
- Consumes: Selection mode state in `LibraryPage.jsx`.
- Produces: Mobile-friendly multi-select controls and sticky touch-friendly action bar.

- [ ] **Step 1: Write failing test for mobile bulk select availability**
  Verify that `LibraryRankList` and `LibraryPage` render bulk select controls without restrictive CSS hiding attributes.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- src/components/LibraryRankList.test.jsx`
  Expected: FAIL or verifies baseline.
- [ ] **Step 3: Remove mobile suppression rules in `frontend/src/styles.css`**
  - Remove `.library-select-toggle { display: none; }` and `.bulk-select-control { display: none; }` under `@media (max-width: 760px)`.
  - Style mobile `.bulk-action-bar` as a sticky bottom bar with safe-area padding, ensuring touch targets for "Select all", "Block", "Delete", and "Cancel" meet 44px minimum touch targets.
- [ ] **Step 4: Run tests and build**
  Run: `npm test && npm run build`
  Expected: PASS
- [ ] **Step 5: Commit and push**
  `git commit -m "feat(library): restore mobile touch bulk selection and actions bar (Planner Step 2)" && git push`

---

### Task 3: `/impeccable polish` — Visual Loading Feedback & Token Hardening

**Files:**
- Modify: `frontend/src/pages/ReportsPage.jsx`
- Modify: `frontend/src/pages/ReportsPage.test.jsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `loading` state in `ReportsPage.jsx`.
- Produces: Loading visual indicators on Reports page; consolidated CSS variables in `:root`.

- [ ] **Step 1: Write failing test in `ReportsPage.test.jsx` for loading state**
  Assert that when `fetchReportsSummary` is pending, a loading indicator or skeleton class is applied to the report cards.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- src/pages/ReportsPage.test.jsx`
  Expected: FAIL (no loading state currently exists).
- [ ] **Step 3: Implement loading state and visual indicator in `ReportsPage.jsx`**
  - Add `const [loading, setLoading] = useState(false)`.
  - Set `setLoading(true)` on date range change, and `setLoading(false)` upon `Promise.all` resolution/error.
  - Render an accessible, non-disruptive loading progress bar or skeleton class (`report-facts is-loading`).
- [ ] **Step 4: Harden CSS variables and fix dark mode contrast in `styles.css`**
  - Define missing tokens in `:root`: `--color-text-muted: var(--color-muted);`, `--color-surface-hover: #f0f0f0;` (and `#262626` in dark mode), `--color-bg: var(--color-canvas);`.
  - Update `.bulk-action-bar` to use `background: var(--color-surface-raised)` and `color: var(--color-ink)` with `border: 0.5px solid var(--color-border)` to fix the white-on-white text contrast defect in dark mode.
  - Update `ReportsPage.jsx` lines 173–198 to use canonical tokens `var(--color-ink)` and `var(--color-muted)`.
- [ ] **Step 5: Run tests and verify contrast**
  Run: `npm test && npm run lint && npm run build`
  Expected: PASS
- [ ] **Step 6: Commit and push**
  `git commit -m "feat(reports): add loading feedback on date range changes and harden design tokens (Planner Step 3)" && git push`

---

### Task 4: Documentation, Service Worker Cache & Version Bump

**Files:**
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`
- Modify: `frontend/public/service-worker.js`
- Modify: `agents/page_specs.md`

- [ ] **Step 1: Update documentation and version numbers**
  - Add version `0.11.9` in `frontend/src/changelogData.js`.
  - Bump version to `0.11.9` in `frontend/package.json`.
  - Increment cache name to `audio-scrobbler-shell-v9` in `frontend/public/service-worker.js`.
  - Update `agents/page_specs.md` with Connect page hub and mobile bulk select details.
- [ ] **Step 2: Run all linters and tests across frontend, backend, and worker**
  - Frontend: `npm run lint && npm test && npm run build`
  - Backend: `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
- [ ] **Step 3: Commit and push**
  `git commit -m "docs: bump version to 0.11.9 and update changelog for onboarding, mobile parity and polish (Planner Step 4)" && git push`
