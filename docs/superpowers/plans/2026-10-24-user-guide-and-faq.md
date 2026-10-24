# User Guide and FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide newcomers and casual listeners with an approachable, comprehensive User Guide and an interactive FAQ directly inside the Settings section, highlighting key features such as background Spotify sync, copying friend scrobbles for shared road trips/parties, and extracting BBC Sounds radio tracklists.

**Architecture:** Build two focused, accessible React components (`UserGuideSection` and `FaqSection`) in `frontend/src/components/settings/`, integrate them as dedicated tabs (`User Guide` and `FAQ`) into `SettingsPage.jsx`, add flat-by-default styling in `styles.css`, and update route/tab testing in `SettingsPage.test.jsx`.

**Tech Stack:** React 18, React Router v6, Vitest, React Testing Library, Vanilla CSS design tokens.

**Spec:** [`docs/superpowers/specs/2026-10-24-user-guide-and-faq-design.md`](file:///home/andyl/Audio%20Scrobbler%20App/docs/superpowers/specs/2026-10-24-user-guide-and-faq-design.md)

## Global Constraints

- **Design System ("Flat-By-Default"):** Zero box shadows (`box-shadow`), zero gradients, only approved color tokens (`var(--color-ink)`, `var(--color-surface)`, `var(--color-border)`, `var(--color-primary)`, `var(--color-muted)`, etc.).
- **URL & Tab Navigation:** Deep-linkable via `/settings?tab=guide` and `/settings?tab=faq` with accessible ARIA tab patterns.
- **Tone & Copy:** Friendly, non-technical plain English tailored to users without builder knowledge.
- **Mobile Touch Targets:** Accordion summaries and chapter jump links must have minimum 44px touch targets.
- **No Backend/Database Changes:** Frontend-only; zero schema migrations or API modifications required.

## Review Focus

1. **Tab persistence & URL deep-linking:** Opening `/settings?tab=guide` or `/settings?tab=faq` loads the respective panel on first render without defaulting to General.
2. **Accordion accessibility & keyboard navigation:** FAQ accordion items expand/collapse cleanly via Enter/Space and preserve screen-reader semantics using native `<details>` and `<summary>`.
3. **Friend copy walkthrough clarity:** Explicitly instructs users how to find the "Copy Scrobbles" button on a friend's profile and explains how duplicate prevention works.
4. **BBC Sounds radio tool walkthrough accuracy:** Accurately points users to Settings → Scrobble (`Scope Creep Tools`) and explains both Scrobbling and Spotify playlist export workflows.
5. **Mobile layout & overflow:** Content and quick-jump navigation wraps cleanly on narrow phone screens (down to 320px) without horizontal scrolling.

---

### Task 1: User Guide Component (`UserGuideSection.jsx` + Tests)

**Files:**
- Create: `frontend/src/components/settings/UserGuideSection.jsx`
- Test: `frontend/src/components/settings/UserGuideSection.test.jsx`

**Interfaces:**
- Consumes: None (pure informational component)
- Produces: `export default function UserGuideSection()` rendering categorized guide chapters with quick-jump nav pills:
  1. *Welcome & How It Works* (hub concept, automatic background sync vs manual actions)
  2. *Connecting Accounts & History Imports* (Spotify connection, Spotify & YouTube JSON file imports, source badges)
  3. *Shared Listening & Copying Friend Scrobbles* (road trips/parties, profile button, date range picker, deduplication)
  4. *BBC Sounds & Radio Tracklists* (Settings → Scrobble, pasting URLs, followed shows, scrobbling plays vs Spotify playlist creation)
  5. *Exploring Your Music & Reports* (Overview, Library views, Reports heatmap/clock/trends, shareable charts)
  6. *Privacy, Housekeeping & Data Ownership* (blocking artists/tracks, deleting scrobbles, backfilling artwork, exporting CSV/JSON)

- [ ] **Step 1: Write the failing test for UserGuideSection**

```jsx
// frontend/src/components/settings/UserGuideSection.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import UserGuideSection from './UserGuideSection'

describe('UserGuideSection', () => {
  it('renders all guide chapters and quick jump navigation', () => {
    render(<UserGuideSection />)
    expect(screen.getByRole('heading', { name: /getting started & how it works/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /listening with friends & copying scrobbles/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /bbc sounds & radio tracklists/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /exploring your music & reports/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /privacy, cleanup & data ownership/i })).toBeInTheDocument()
  })

  it('highlights specific instructions for car journeys and radio extraction', () => {
    render(<UserGuideSection />)
    expect(screen.getByText(/car journey|road trip/i)).toBeInTheDocument()
    expect(screen.getByText(/scope creep/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- UserGuideSection.test.jsx`
Expected: FAIL ("Cannot find module './UserGuideSection'")

- [ ] **Step 3: Implement `UserGuideSection.jsx`**

Implement `frontend/src/components/settings/UserGuideSection.jsx` with clear, accessible markup, quick-jump anchor links, step-by-step ordered lists (`<ol>`), and informational tip callouts (`<div className="guide-callout">`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- UserGuideSection.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/settings/UserGuideSection.jsx frontend/src/components/settings/UserGuideSection.test.jsx
git commit -m "feat(frontend): add UserGuideSection component and tests (Planner Step 1)"
```

---

### Task 2: FAQ Component (`FaqSection.jsx` + Tests)

**Files:**
- Create: `frontend/src/components/settings/FaqSection.jsx`
- Test: `frontend/src/components/settings/FaqSection.test.jsx`

**Interfaces:**
- Consumes: None
- Produces: `export default function FaqSection()` rendering categorized accordion questions with a keyword filter search input:
  - *Sync & Scrobbles:* Delay expectations (5-min poll vs 10-s realtime), closing the browser, stripping remaster tags.
  - *Friends & Social:* Copying music from friends, duplicate protection, profile privacy.
  - *BBC Sounds & Radio:* Exporting to Spotify playlists, Followed Shows usage, timestamp handling.
  - *Library & Data Maintenance:* Blocking vs Deleting, backfilling artwork, exporting data files.
  - *Mobile & Notifications:* iOS Add-to-Home-Screen instructions, Android/Desktop notifications.

- [ ] **Step 1: Write the failing test for FaqSection**

```jsx
// frontend/src/components/settings/FaqSection.test.jsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FaqSection from './FaqSection'

describe('FaqSection', () => {
  it('renders FAQ questions and categories', () => {
    render(<FaqSection />)
    expect(screen.getByPlaceholderText(/search questions/i)).toBeInTheDocument()
    expect(screen.getByText(/why is there a delay before my song appears/i)).toBeInTheDocument()
    expect(screen.getByText(/how do i scrobble music a friend played in the car/i)).toBeInTheDocument()
  })

  it('filters questions by keyword search', () => {
    render(<FaqSection />)
    const searchInput = screen.getByPlaceholderText(/search questions/i)
    fireEvent.change(searchInput, { target: { value: 'car' } })
    expect(screen.getByText(/how do i scrobble music a friend played in the car/i)).toBeInTheDocument()
    expect(screen.queryByText(/how do i fix missing album artwork/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- FaqSection.test.jsx`
Expected: FAIL ("Cannot find module './FaqSection'")

- [ ] **Step 3: Implement `FaqSection.jsx`**

Implement `frontend/src/components/settings/FaqSection.jsx` with native `<details>` and `<summary>` elements, live text filtering, and clear categorization badges.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- FaqSection.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/settings/FaqSection.jsx frontend/src/components/settings/FaqSection.test.jsx
git commit -m "feat(frontend): add FaqSection component with search filter and tests (Planner Step 2)"
```

---

### Task 3: SettingsPage Integration & CSS Styling

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/pages/SettingsPage.test.jsx`

**Interfaces:**
- Consumes: `UserGuideSection` from `../components/settings/UserGuideSection`, `FaqSection` from `../components/settings/FaqSection`
- Produces: Updated `SettingsPage` with 8 tabs (`general`, `views`, `scrobble`, `data`, `notifications`, `guide`, `faq`, `danger`).

- [ ] **Step 1: Write the failing test for SettingsPage 8 tabs and tab navigation**

Update `frontend/src/pages/SettingsPage.test.jsx` to assert:
- `renders all 8 tabs with Danger Zone visually distinct and switches between them`
- `switches to the User Guide tab and displays guide sections`
- `switches to the FAQ tab and displays FAQ questions`
- Deep-linking with initial URL `?tab=guide` renders the guide tab immediately.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- SettingsPage.test.jsx`
Expected: FAIL (tab count mismatch or missing guide/faq tabs)

- [ ] **Step 3: Update `SettingsPage.jsx` and `styles.css`**

1. In `frontend/src/pages/SettingsPage.jsx`:
   - Import `UserGuideSection` and `FaqSection`.
   - Add `['guide', 'User Guide']` and `['faq', 'FAQ']` to `SETTINGS_TABS`.
   - Update `tabParam` validation to include `'guide'` and `'faq'`.
   - Render `UserGuideSection` under `activeTab === 'guide'` and `FaqSection` under `activeTab === 'faq'`.
2. In `frontend/src/styles.css`:
   - Add flat-by-default styles for `.user-guide-section`, `.guide-nav-pills`, `.guide-chapter`, `.guide-callout`, `.faq-section`, `.faq-search-input`, `.faq-category`, `.faq-item`, `.faq-question`, and `.faq-answer`.
   - Strictly follow `DESIGN.md` (no box-shadows, no gradients, clean borders, responsive typography).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- SettingsPage.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.jsx frontend/src/styles.css frontend/src/pages/SettingsPage.test.jsx
git commit -m "feat(frontend): integrate User Guide and FAQ tabs into SettingsPage (Planner Step 3)"
```

---

### Task 4: Changelog, Page Specs & Comprehensive Verification

**Files:**
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`
- Modify: `agents/page_specs.md`

- [ ] **Step 1: Update changelog, version and page specs**
  - Add new version entry to the top of `frontend/src/changelogData.js` explaining the new User Guide and FAQ tabs in Settings.
  - Bump `version` in `frontend/package.json` (e.g. from `0.6.1` to `0.7.0` or next patch).
  - Update Section 7 of `agents/page_specs.md` to document the new `guide` and `faq` tabs.

- [ ] **Step 2: Run full verification suite**

```bash
# Python & Shell Linters
ruff check backend/app worker scripts
ruff format --check backend/app worker scripts

# Frontend Linters & Tests
cd frontend && npm run lint
cd frontend && npm run format -- --check
cd frontend && npm test
cd frontend && npm run build
```

- [ ] **Step 3: Security & differential review**
  - Run differential-review check on modified files to verify no secret leaks, injection risks, or regressions.

- [ ] **Step 4: Commit and push**

```bash
git add frontend/src/changelogData.js frontend/package.json agents/page_specs.md
git commit -m "docs: document User Guide and FAQ in changelog and page specs (Planner Step 4)"
git push
```

---

## Verification Plan

### Automated Tests
```bash
# Run Settings and new component tests
cd frontend && npm test -- UserGuideSection.test.jsx FaqSection.test.jsx SettingsPage.test.jsx

# Run complete frontend test suite & production build
cd frontend && npm run lint && npm test && npm run build

# Run python linter check to ensure clean repo state
ruff check backend/app worker scripts
```

### Manual Verification
1. Navigate to `/settings` in the browser. Verify the tab bar displays **User Guide** and **FAQ** alongside the other tabs.
2. Click **User Guide**: verify all chapters render with clean headings, jump links navigate smoothly, and instructions for car journeys (friend copying) and BBC Sounds extraction are clear and accurate.
3. Click **FAQ**: verify accordion items toggle open and closed on click and via keyboard (Enter/Space). Test the search input by filtering for "car" or "delay".
4. Direct URL access: test loading `/settings?tab=guide` and `/settings?tab=faq` directly to verify deep-linking.
5. Mobile test: check phone viewports (375px) to ensure no horizontal scrolling and touch targets are comfortable.
