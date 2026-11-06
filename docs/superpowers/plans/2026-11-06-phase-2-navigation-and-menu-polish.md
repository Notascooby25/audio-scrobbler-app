# Phase 2 Implementation Plan: Navigation, Menus & Visual Polish (Track 2B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish application navigation, user onboarding, and visual hierarchy by introducing an Account dropdown menu in the Profile icon (NAV-1), redirecting signed-out visitors to Connect (NAV-10), adding modern `/play` and `/gigs` route aliases with backward-compatible redirects (NAV-4), standardizing page eyebrows and heading levels (NAV-12), and unifying secondary button styles (DES-1).

**Architecture:** Client-side React 18 and React Router v6 navigation refactoring within `frontend/src/components/HeaderNav.jsx`, `App.jsx`, and page components, accompanied by shared CSS token standardization in `frontend/src/styles.css` adhering strictly to `DESIGN.md` and the One Voice Rule.

**Tech Stack:** React 18, React Router v6, Vitest, Testing Library, Vanilla CSS tokens.

**Spec:** Review findings NAV-1, NAV-4, NAV-10, NAV-12, and DES-1 from Chris's Combined Review (Track 2B).

## Global Constraints
- Follow `agents/planner_agent.md`, `agents/page_specs.md`, `DESIGN.md`, and `references/engineering-checks.md`.
- Mobile Header Grid Layout Invariant: On mobile viewports (`@media (max-width: 720px)`), the header topbar uses CSS Grid (`grid-template-areas: "brand icons" ". toggle" "links links"`). The brand title sits on the left with the 3 outline action icons (Profile, Connect, Notifications) on the top right. The `Menu` toggle button sits directly below the icons on row 2. When open, navigation links expand on row 3 horizontally beneath the toggle (`flex-direction: row; justify-content: flex-end; flex-wrap: wrap;`), never floating left or displacing the top-row icons.
- All buttons rendering semantic mixed-case prose or modal actions must explicitly declare `text-transform: none;` to avoid being forced to uppercase by the global `button` selector.
- Zero gradients, zero box-shadows, flat-by-default styling using approved CSS variables.
- All changes must be made on a working branch (`fix/navigation-and-menu-polish-phase-2`), verified with automated linters and tests, and never pushed directly to `main`.

## Review Focus
1. Mobile dropdown menu interaction: Opening the Profile account dropdown on mobile viewports must not break the 3-row grid layout or cause overflow.
2. Route redirection loops: Navigating between `/`, `/overview`, and `/play`, or `/setlists` and `/gigs`, must never trigger an infinite redirect cycle.
3. Keyboard accessibility: Pressing Escape or clicking outside the Account dropdown must reliably close the menu and return focus.
4. Active link styling: The `Play` and `Gigs` nav links must stay highlighted when navigating to their respective sub-paths or aliases.
5. Secondary button appearance: Secondary action buttons across Settings and modals must render with subtle borders and clear contrast without falling back to bright primary accent backgrounds.

---

### Task 1: NAV-1 — Account Dropdown Menu in Profile Icon

**Files:**
- Modify: `frontend/src/components/HeaderNav.jsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/components/HeaderNav.test.jsx`

**Interfaces:**
- The Profile outline icon in `HeaderNav` becomes an accessible dropdown trigger when clicked.
- Menu items:
  - **Profile** (`/profile`)
  - **Friends** (`/following`)
  - **Settings** (`/settings`)
  - **Connect** (`/connect`)
  - **Sign out** (calls `clearSession()`, clears cache, and redirects to `/connect`)
- Closes on outside click, Escape key, or when a navigation link is clicked.

- [ ] **Step 1: Write unit tests in `HeaderNav.test.jsx` for the Account dropdown menu**
Test opening the menu by clicking the Profile icon, asserting all 5 menu items appear, closing on Escape, and triggering sign-out.

- [ ] **Step 2: Run test to verify failure**
Run: `cd frontend && npm test -- src/components/HeaderNav.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement Account dropdown in `HeaderNav.jsx` and `styles.css`**
Add state `isAccountMenuOpen`, render dropdown menu with proper ARIA attributes (`aria-haspopup="menu"`, `aria-expanded={isAccountMenuOpen}`), and style with flat-bordered utility styling adhering to mobile header invariants.

- [ ] **Step 4: Run test to verify pass**
Run: `cd frontend && npm test -- src/components/HeaderNav.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/HeaderNav.jsx frontend/src/styles.css frontend/src/components/HeaderNav.test.jsx
git commit -m "feat(nav): add account dropdown menu to profile icon (Planner Step 1)"
```

---

### Task 2: NAV-10 — First-Visit Welcome & Signed-Out Redirection

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/OverviewPage.jsx`
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/components/setlists/SetlistsPage.jsx`
- Test: `frontend/src/pages/OverviewPage.test.jsx`
- Test: `frontend/src/App.test.jsx`

**Interfaces:**
- Visiting `/` when `!session?.accessToken` redirects automatically to `/connect`.
- `ProfilePage` and `SetlistsPage` present clean, clear connection guidance when viewed signed out.

- [ ] **Step 1: Write test for signed-out root redirection in `App.test.jsx`**
Assert that rendering `/` with no active session renders the Connect (`HomePage`) view.

- [ ] **Step 2: Run test to verify failure**
Run: `cd frontend && npm test -- src/App.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement signed-out redirection in `App.jsx` and update signed-out notices**
In `App.jsx`, render `<Navigate to="/connect" replace />` on root when no session exists. Update `ProfilePage.jsx` copy to refer to the Connect page.

- [ ] **Step 4: Run tests to verify pass**
Run: `cd frontend && npm test -- src/App.test.jsx src/pages/ProfilePage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/App.jsx frontend/src/pages/OverviewPage.jsx frontend/src/pages/ProfilePage.jsx frontend/src/components/setlists/SetlistsPage.jsx frontend/src/App.test.jsx
git commit -m "feat(nav): redirect signed-out visitors to connect welcome page (Planner Step 2)"
```

---

### Task 3: NAV-4 — Modern Route Aliases (`/play` and `/gigs`)

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/HeaderNav.jsx`
- Modify: `frontend/nginx.conf`
- Test: `frontend/src/App.test.jsx`
- Test: `frontend/src/components/HeaderNav.test.jsx`

**Interfaces:**
- `/play` is the canonical route for `OverviewPage`. `/overview` redirects to `/play`.
- `/gigs` is the canonical route for `SetlistsPage`. `/setlists` redirects to `/gigs`.
- `HeaderNav.jsx` links use `/play` and `/gigs`.

- [ ] **Step 1: Write test for route redirects in `App.test.jsx`**
Assert navigating to `/overview` redirects to `/play`, and `/setlists` redirects to `/gigs`.

- [ ] **Step 2: Run test to verify failure**
Run: `cd frontend && npm test -- src/App.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Update routes in `App.jsx` and nav links in `HeaderNav.jsx`**
Configure `<Route path="/play" element={<OverviewPage />} />` and `<Route path="/overview" element={<Navigate to="/play" replace />} />`. Configure `<Route path="/gigs" element={<SetlistsPage />} />` and `<Route path="/setlists" element={<Navigate to="/gigs" replace />} />`.

- [ ] **Step 4: Run test to verify pass**
Run: `cd frontend && npm test -- src/App.test.jsx src/components/HeaderNav.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/App.jsx frontend/src/components/HeaderNav.jsx frontend/nginx.conf frontend/src/App.test.jsx frontend/src/components/HeaderNav.test.jsx
git commit -m "feat(routes): establish /play and /gigs canonical routes with redirects (Planner Step 3)"
```

---

### Task 4: NAV-12 — Standardize Page Eyebrows and Headings

**Files:**
- Modify: `frontend/src/pages/OverviewPage.jsx`
- Modify: `frontend/src/pages/LibraryPage.jsx`
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/pages/FollowingPage.jsx`
- Modify: `frontend/src/pages/SettingsPage.jsx`
- Modify: `frontend/src/components/setlists/SetlistsPage.jsx`
- Test: `frontend/src/pages/ProfilePage.test.jsx`
- Test: `frontend/src/pages/SettingsPage.test.jsx`

**Interfaces:**
- Play: eyebrow "Jukebox", title "Play".
- Library: eyebrow "Collection", title "Library".
- Profile: eyebrow "Profile", title `<h1 className="profile-name">` (fixed from h2).
- Friends: eyebrow "Community", title "Friends".
- Settings: eyebrow "Preferences", title "Settings".
- Gigs: eyebrow "Live Music", title "Gigs".

- [ ] **Step 1: Write test asserting Profile heading level 1 in `ProfilePage.test.jsx`**
Assert `getByRole('heading', { level: 1 })` matches profile display name.

- [ ] **Step 2: Run test to verify failure**
Run: `cd frontend && npm test -- src/pages/ProfilePage.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Update page eyebrows and Profile heading level**
Update `AnalyticsPage` eyebrow props and change Profile heading from `h2` to `h1`.

- [ ] **Step 4: Run tests to verify pass**
Run: `cd frontend && npm test -- src/pages/ProfilePage.test.jsx src/pages/SettingsPage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/OverviewPage.jsx frontend/src/pages/LibraryPage.jsx frontend/src/pages/ProfilePage.jsx frontend/src/pages/FollowingPage.jsx frontend/src/pages/SettingsPage.jsx frontend/src/components/setlists/SetlistsPage.jsx frontend/src/pages/ProfilePage.test.jsx
git commit -m "style(headings): standardize page eyebrows and promote profile title to h1 (Planner Step 4)"
```

---

### Task 5: DES-1 — Button Styles Unification & Missing Class Cleanup

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/pages/SettingsPage.jsx`
- Test: `frontend/src/cardConsistency.test.js`

**Interfaces:**
- Define `.secondary-button`, `.button-secondary`, `.btn-secondary` in `styles.css` as subtle, outlined buttons with border and hover state.
- Define `.button-primary`, `.settings-button`, `.retry-btn`, `.badge`, `.badge-success`, `.badge-secondary`.
- Ensure Settings data tab secondary actions use proper secondary button styling.

- [ ] **Step 1: Write CSS class consistency test in `cardConsistency.test.js`**
Assert that button classes used in components have matching CSS selectors defined.

- [ ] **Step 2: Implement unified button styles in `styles.css`**
Add comprehensive rules for secondary buttons, retry buttons, and status badges.

- [ ] **Step 3: Run test suite**
Run: `cd frontend && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/styles.css frontend/src/pages/SettingsPage.jsx frontend/src/cardConsistency.test.js
git commit -m "style(buttons): unify secondary button styling and add missing utility classes (Planner Step 5)"
```

---

### Task 6: Documentation, Page Specs & Release Bump (v0.35.0)

**Files:**
- Modify: `agents/page_specs.md`
- Modify: `frontend/package.json`
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`
- Modify: `frontend/src/components/settings/FaqSection.jsx`
- Modify: `HANDOVER.md`

- [ ] **Step 1: Run full verification suite**
```bash
ruff check backend/app worker scripts
.venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh backend/scripts/*.sh backend/scripts/tests/*.sh
cd frontend && npm run lint && npm test && npm run build
PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
```

- [ ] **Step 2: Update documentation & page specs**
Document `/play`, `/gigs`, and the Account dropdown menu in `page_specs.md`, `UserGuideSection.jsx`, and `FaqSection.jsx`.

- [ ] **Step 3: Bump version to `v0.35.0` in package.json and update changelog and handover**
Add `v0.35.0` entry to `changelogData.js` and `HANDOVER.md`.

- [ ] **Step 4: Commit**
```bash
git add agents/page_specs.md frontend/package.json frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx frontend/src/components/settings/FaqSection.jsx HANDOVER.md
git commit -m "docs(release): bump version to v0.35.0 and document navigation polish (Planner Step 6)"
```

---

Confirm to proceed.
