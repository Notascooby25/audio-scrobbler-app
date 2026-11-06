# Footer What's New Dialog and Mobile Header Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the application footer to display `v{version} • What's new` opening a "What's New" dialog showing the latest release changes with a "View all changes" shortcut (Issue #46), and reposition the mobile header navigation so the Profile, Connect, and Notifications icons sit on the top right next to the logo with the Menu button positioned directly below them on the right.

**Architecture:**
- Create an accessible `<WhatsNewModal>` component following modern web dialog guidance (`aria-labelledby`, `Escape` key and backdrop light-dismissal, flat design tokens without `box-shadow` or gradients).
- Update `<Footer>` to render the brand on the left and the interactive `v{version} • What's new` button on the right opening `<WhatsNewModal>`.
- Refactor `@media (max-width: 720px)` CSS in `styles.css` using CSS grid areas (`"brand icons" ". toggle" "links links"`) so the top row pairs the brand logo and icons, the second row places the Menu toggle directly below the icons, and the expanded menu links flow underneath.

**Tech Stack:** React 18, React Router v6, Vitest, React Testing Library, CSS Grid / Flexbox, Vite.

**Spec:** GitHub Issue #46 and Andy's mobile layout feedback (`media_1793947315679.png`).

## Global Constraints
- Strictly follow `DESIGN.md`: zero `box-shadow`, zero gradients, only approved CSS color tokens (`var(--color-surface)`, `var(--color-ink)`, `var(--color-border)`, etc.).
- Never touch `RetroJukebox.jsx` or `RetroJukebox.module.css`.
- Ensure mobile touch targets remain >= 44px (`min-height: 44px`, `min-width: 44px`).
- Never commit or push directly to `main`; work on branch `feat/changelog-modal-and-mobile-header`.

## Review Focus
- Modal accessibility: Ensure dialog has proper `role="dialog"` or `<dialog>`, `aria-labelledby`, accessible close button, and returns focus or closes on `Escape` without leaking event listeners.
- Light dismiss: Clicking the backdrop dismisses the modal, but clicking inside the modal content does not dismiss it.
- Navigation from modal: Clicking "View all changes" inside the modal navigates to `/changelog` and closes the modal.
- Mobile header spacing: On small screens (360px–390px), ensure the brand logo and the 3 icons fit comfortably without wrapping onto unintended rows.
- Desktop navigation parity: Desktop header navigation remains unchanged (logo left, links center, icons far right).

---

### Task 1: Mobile Header Layout Correction

**Files:**
- Modify: `frontend/src/components/HeaderNav.jsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/components/HeaderNav.test.jsx`

**Interfaces:**
- Produces: Header layout where at `@media (max-width: 720px)`, `.topbar-brand` and `.topbar-icons` sit on the top row, `.nav-menu-toggle` sits directly below the icons on the second row, and `.topbar-links` expand on row 3 when open.

- [ ] **Step 1: Write tests for the mobile header layout structure**

In `frontend/src/components/HeaderNav.test.jsx`, add tests asserting the presence and grouping of the outline icons and the menu toggle button.

- [ ] **Step 2: Update HeaderNav and styles.css for mobile grid layout**

In `frontend/src/components/HeaderNav.jsx`:
Ensure `.nav-menu-toggle` is placed alongside `.topbar-icons` and `.topbar-links` as direct nav children or styled grid elements.
In `frontend/src/styles.css`:
Update `@media (max-width: 720px)` to use grid areas:
```css
@media (max-width: 720px) {
  .topbar {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "brand icons"
      ". toggle"
      "links links";
    align-items: center;
    row-gap: 0.5rem;
  }
  .topbar-brand {
    grid-area: brand;
  }
  .topbar-icons {
    grid-area: icons;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    justify-content: flex-end;
  }
  .nav-menu-toggle {
    grid-area: toggle;
    justify-self: end;
  }
  .topbar-links {
    grid-area: links;
  }
}
```

- [ ] **Step 3: Run frontend tests**

Run: `cd frontend && npm test -- src/components/HeaderNav.test.jsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(nav): position mobile icons above menu toggle on top row (Planner Step 1)"
```

---

### Task 2: "What's New" Dialog Component (`WhatsNewModal`)

**Files:**
- Create: `frontend/src/components/WhatsNewModal.jsx`
- Create: `frontend/src/components/WhatsNewModal.test.jsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces: `<WhatsNewModal isOpen={boolean} onClose={function} />`
- Consumes: `CHANGELOG` from `../changelogData`

- [ ] **Step 1: Write failing test for WhatsNewModal**

Create `frontend/src/components/WhatsNewModal.test.jsx`:
- Test that modal does not render when `isOpen={false}`.
- Test that modal renders latest release version, release date, and change bullet points when `isOpen={true}`.
- Test that clicking "Close" or pressing `Escape` calls `onClose`.
- Test that clicking "View all changes" links to `/changelog` and calls `onClose`.

- [ ] **Step 2: Implement WhatsNewModal**

In `frontend/src/components/WhatsNewModal.jsx`:
- Import `CHANGELOG` from `../changelogData`.
- Use the latest entry `const latestRelease = CHANGELOG[0]`.
- Handle `Escape` key in a `useEffect`.
- Handle backdrop click (only when click target is the backdrop itself).
- Render `modal-dialog` with `h3` title "What's New in v{version}", the list of bullet points, a "View all changes" `<Link to="/changelog">` button, and a "Close" button.
- Ensure all styles follow `DESIGN.md` flat styling tokens.

- [ ] **Step 3: Run WhatsNewModal tests**

Run: `cd frontend && npm test -- src/components/WhatsNewModal.test.jsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(changelog): create WhatsNewModal component (Planner Step 2)"
```

---

### Task 3: Footer Integration with "What's New" Button

**Files:**
- Modify: `frontend/src/components/Footer.jsx`
- Modify: `frontend/src/components/Footer.test.jsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces: `<Footer>` displaying brand on left and `v{version} • What's new` button opening `<WhatsNewModal>` on right.

- [ ] **Step 1: Update Footer.test.jsx**

Assert:
- Footer renders "Audio Scrobbler App".
- Footer renders button `v{version} • What's new`.
- Clicking `v{version} • What's new` opens the "What's New" dialog.
- Clicking "View all changes" inside the dialog navigates to `/changelog`.

- [ ] **Step 2: Update Footer.jsx and styles.css**

In `frontend/src/components/Footer.jsx`:
- Add `const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false)`.
- Replace the standalone `Changelog` link with `<button type="button" className="app-footer-link app-footer-version-btn" onClick={() => setIsWhatsNewOpen(true)}>v{currentVersion} • What's new</button>`.
- Render `<WhatsNewModal isOpen={isWhatsNewOpen} onClose={() => setIsWhatsNewOpen(false)} />`.
In `frontend/src/styles.css`:
- Add `.app-footer-version-btn` styling (reset button styles: transparent background, border none, font matching footer, pointer cursor, underline with primary color hover).

- [ ] **Step 3: Run Footer tests**

Run: `cd frontend && npm test -- src/components/Footer.test.jsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(footer): add What's new button and modal trigger (Planner Step 3)"
```

---

### Task 4: Documentation, Release Bump (v0.33.0) & Verification

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`
- Modify: `frontend/src/components/settings/FaqSection.jsx`
- Modify: `HANDOVER.md`

- [ ] **Step 1: Bump version and add changelog entry**

Bump `frontend/package.json` to `0.33.0` and add `0.33.0` entry to `frontend/src/changelogData.js` summarizing the What's New dialog and mobile header icon placement.

- [ ] **Step 2: Update docs, user guide, and FAQ**

Update `UserGuideSection.jsx`, `FaqSection.jsx`, and `HANDOVER.md`.

- [ ] **Step 3: Run full verification suite**

Run:
- `ruff check backend/app worker scripts`
- `ruff format --check backend/app worker scripts`
- `.venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh`
- `bash scripts/tests/test_restore_drill.sh`
- `PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests worker/tests -q`
- `cd frontend && npm run lint && npm test && npm run build`
- `cd frontend && npm run test:e2e`
- Differential security review (`differential-review`)

- [ ] **Step 4: Launch preview and capture screenshots**

- Start `scripts/preview.sh up --phone`.
- Capture desktop and mobile screenshots of:
  - Mobile header with closed menu.
  - Mobile header with open menu.
  - Footer on desktop and mobile.
  - "What's New" dialog open on desktop and mobile.
- Show simulated screenshots in the hand-over block to Andy.

- [ ] **Step 5: Commit & open PR**

```bash
git commit -m "docs(release): bump version to v0.33.0 and update docs for What's New dialog (Planner Step 4)"
```
