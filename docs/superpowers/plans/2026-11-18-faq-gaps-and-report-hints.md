# FAQ gaps and Reports hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add about 8 missing FAQ entries (and fix two stale answers) and a small tap-to-open info button on Reports widget titles, with one shared source of wording.

**Architecture:** A new `InfoHint` component (a real button plus a small popover) reads its text from one data file keyed by widget id. Existing widget titles get an optional `hint` id. The new FAQ Reports entry reuses the same sentences. No backend changes.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, plain CSS in `frontend/src/styles.css`.

**Spec:** `docs/superpowers/specs/2026-11-18-faq-gaps-and-report-hints-design.md`

## Global Constraints
- Branch `feat/faq-gaps-and-report-hints` off `main`. Never commit to `main`. Release 0.50.5.
- Flat by default: zero gradients, zero `box-shadow`, approved colour tokens only (DESIGN.md). Hairline `0.5px` borders.
- Any button showing mixed-case text sets `text-transform: none;` in its scoped class.
- Component tests import `cleanup` and call `afterEach(() => cleanup())`.
- Namespace new CSS under `.info-hint` and, for widget-specific tweaks, under the page container (no generic selectors).
- Do not touch `RetroJukebox.jsx` / `RetroJukebox.module.css`.
- Touch target at least 44x44px; real `<button type="button">`; visible `:focus-visible` ring (the global rule at `styles.css:1027` already applies, do not set `outline: none`).
- User-facing change: update `changelogData.js` (new top entry 0.50.5), `package.json` and `package-lock.json` version (edit tool, not `sed -i`), `UserGuideSection.jsx` and `FaqSection.jsx`.
- Plain English, 1 to 2 sentences per hint. No jargon.

## Review Focus
- Popover opens near the right edge or on a 320px phone: must not cause sideways scroll (`mobileNoSidewaysScroll.test.js` must still pass).
- Two hints opened in a row: opening one closes the other.
- Hint button inside a `<summary>`, `<h2>` or clickable card: tapping it must not toggle/navigate the parent.
- Dark mode and all three skins (Classic, Sleeve, Timeline): the popover stays readable (contrast) and flat.
- Reduced-motion users: no animation needed to see the hint.

---

### Task 1: Branch, spec, and InfoHint component

**Files:**
- Create: `frontend/src/components/InfoHint.jsx`, `frontend/src/components/InfoHint.test.jsx`, `frontend/src/reportHints.js`
- Modify: `frontend/src/styles.css` (append an `.info-hint` block)

**Interfaces:**
- Produces: `export const REPORT_HINTS: Record<string, string>` in `reportHints.js`.
- Produces: `export default function InfoHint({ hintId, label }: { hintId: string; label?: string }): JSX.Element | null` in `InfoHint.jsx`. Returns `null` when `hintId` is not in `REPORT_HINTS`.

- [ ] **Step 1:** `git checkout -b feat/faq-gaps-and-report-hints main`; commit the spec and this plan (`docs: add FAQ gaps and Reports hints spec and plan`).
- [ ] **Step 2: Write failing tests** in `InfoHint.test.jsx`:
  - `renders nothing for an unknown hintId`
  - `button has aria-label "About <label>" and aria-expanded="false"` initially
  - `clicking opens a note with role="note"` containing the `REPORT_HINTS` text, `aria-expanded="true"`
  - `second click closes it`; `Escape closes it and returns focus to the button`; `clicking outside closes it`
  - `opening a second InfoHint closes the first` (render two)
  - `click does not bubble` (wrap in a `<details>`; `details.open` stays false)
- [ ] **Step 3:** Run `cd frontend && npx vitest run src/components/InfoHint.test.jsx`. Expected: FAIL (module missing).
- [ ] **Step 4:** Implement `InfoHint` with `useState`, `useId` for `aria-controls`, a document `pointerdown`/`keydown` listener while open, and `stopPropagation` plus `preventDefault` on the button click. Outline "i" drawn with inline SVG using `currentColor` (no gradients). A module-level event (`CustomEvent("info-hint-open")`) closes others.
- [ ] **Step 5:** Add `REPORT_HINTS` with an initial entry per widget id used in Task 2 (wording below in Task 2). Add CSS: `.info-hint` (inline-flex, margin-left 6px), `.info-hint-btn` (min 44x44 hit area via padding, `color: var(--color-muted)`, no background), `.info-hint-note` (position absolute, `max-width: min(18rem, calc(100vw - 2rem))`, `background: var(--color-surface)`, `border: 0.5px solid var(--color-border)`, `border-radius: var(--radius-sm)`, `text-transform: none`, `z-index` low). No shadow, no gradient.
- [ ] **Step 6:** Run the test file again. Expected: PASS. Run `npm run lint`.
- [ ] **Step 7:** Commit `feat(reports): add InfoHint component`.

### Task 2: Put hints on Reports widgets

**Files:**
- Modify: `frontend/src/components/charts/BarTrendChart.jsx`, `charts/ListeningClockChart.jsx`, `pages/ReportsPage.jsx` (routines, decade, genres), `components/reports/ReportRatios.jsx`, `ReportMilestones.jsx`, `Report1001Milestone.jsx`, `ReportLiveConnection.jsx`, `FriendsComparisonSection.jsx`, and the gig widget titles in `GigReportsSection.jsx`, `GigOdysseyMap.jsx`, `GigCadenceHeatmap.jsx`, `GigDayOfWeekChart.jsx`, `LiveArtistsSeenList.jsx`, `VenueRoyaltyList.jsx`, `SetlistReplayHighlights.jsx`, `GigBadgesCatalog.jsx`
- Modify: `frontend/src/reportHints.js`
- Test: `frontend/src/pages/ReportsPage.test.jsx`, `frontend/src/reportHints.test.js` (create)

**Interfaces:**
- Consumes: `InfoHint({ hintId, label })` from Task 1.
- Produces: optional `hint` prop on `BarTrendChart` and `ListeningClockChart` (a `REPORT_HINTS` id); other widgets render `<InfoHint>` inline after their title.

- [ ] **Step 1: Blast radius.** Run `git grep -n "BarTrendChart\|ListeningClockChart" frontend/src` and list every page that uses them. The `hint` prop is optional, so other consumers must render unchanged.
- [ ] **Step 2: Write failing tests:**
  - `reportHints.test.js`: `every REPORT_HINTS value is 1 to 2 sentences (under 220 characters) and non-empty`.
  - `ReportsPage.test.jsx`: with a populated report, `getByRole("button", { name: "About Explorer vs. Repeater", exact: true })` exists and opens a note containing the `REPORT_HINTS["ratios.explorer"]` text.
  - `BarTrendChart` rendered without `hint` shows no info button (other consumers unchanged).
- [ ] **Step 3:** Run these; expected FAIL.
- [ ] **Step 4:** Add hints. Wording (owner reviews on the preview; plain English):
  - `scrobbles.over-time`: "How many songs you played in each day or week of the range you picked."
  - `routines`: "Darker squares mean you listen more at that hour on that day of the week."
  - `clock`: "Your listening spread across the 24 hours of the day. Longer spokes mean more plays at that hour."
  - `decade`: "Which decade the music you played was originally released in."
  - `genres`: "Genres of the artists you played most. Taken from artist tags, so a few may be missing."
  - `ratios.explorer`: "Plays divided by distinct artists. Higher means you replay favourites; lower means you keep trying new artists."
  - `ratios.singles`: "Plays divided by distinct albums. Higher means you pick single songs; lower means you play full albums."
  - `ratios.new`: "The share of artists in this period that you had never played before."
  - `milestones.streak`: "Days in a row with at least one scrobble. One missed day is forgiven."
  - `milestones.persona`: "A badge based on your habits this period, for example Night Owl or Weekend Warrior."
  - `milestones.1001`: "Albums from the 1001 Albums You Must Hear Before You Die list that you finished in this period."
  - `live.connection`: "How many of the artists you played were ones you have seen live."
  - `friends`: "Your listening compared with the people you follow."
  - `gig.*` (odyssey map, cadence, rhythm, live gap, post-gig surge, rankings, venues, replay, badges): one sentence each, written from the widget's own subtitle or code comments; the implementer reads the widget before writing it.
  Skip the icon on widgets whose title is already self-explanatory (judgement call, listed in the PR).
- [ ] **Step 5:** Render `<InfoHint hintId=... label=...>` inside each title (`BarTrendChart`/`ListeningClockChart` via the optional `hint` prop). Keep titles' existing DOM text so current tests and the Page Check keep working.
- [ ] **Step 6:** Run `cd frontend && npm test`. Expected: all pass (including `mobileNoSidewaysScroll.test.js`, `cardConsistency.test.js`, `textContrast.test.js`).
- [ ] **Step 7:** Commit `feat(reports): add info hints to Reports widgets`.

### Task 3: New FAQ entries and fixes

**Files:**
- Modify: `frontend/src/components/settings/FaqSection.jsx`, `FaqSection.test.jsx`

**Interfaces:**
- Consumes: `REPORT_HINTS` from `reportHints.js` (Reports entry reuses these sentences).
- Produces: new `FAQ_DATA` items (`{ id, category, question, answer }`) with ids `import-history`, `reports-overview`, `recommend-music`, `jukebox-rough-trade`, `getting-started-spotify`, `entry-menu`, `page-map`, `offline-install`, plus `share-card` only if the share dialog's behaviour is clear from `ShareDialog.jsx` and `ShareCard.jsx`.

- [ ] **Step 1: Verify facts before writing each answer** by reading the code: the history importer (Settings -> Data, supported file types and bulk upload), `ReportCustomiseModal`/date range/Compare options, the recommend flow (`components/recommend/`), Jukebox Rough Trade (`components/jukebox/`), the Connect page, `EntryMenu.jsx` (Delete, Block, Clear Artwork), the nav in `HeaderNav.jsx`, and the offline banner. Write only what the code shows.
- [ ] **Step 2: Fix two existing answers.**
  - `sign-out-cache`: replace "Home page" with the page the Spotify connection card is actually on (`/connect`, "Connect" in the menu).
  - `privacy-visibility`: **finding while planning:** the backend rule (`backend/app/services/social_service.py:19`, `can_view_details`) lets anyone who follows you see your details, one-way; `follow_user` has no approval step. The current FAQ says it needs a follow back, so it is wrong. Rewrite it to describe the real behaviour, keep the Blocked Items sentence. Do not change backend behaviour in this plan; report the finding to the owner as a separate question.
- [ ] **Step 3: Write failing tests** in `FaqSection.test.jsx`: for each new id's question text, `getByText(/<question regex>/i)`; `keyword search "import" shows the history import entry`; `the privacy answer no longer says "follow you back"`; `the sign-out answer no longer says "Home page"` (open the `<details>` via click first).
- [ ] **Step 4:** Run `npx vitest run src/components/settings/FaqSection.test.jsx`; expected FAIL.
- [ ] **Step 5:** Add the entries to `FAQ_DATA` using existing categories where they fit (new category "Getting Started" and "Reports & Stats" are allowed). Follow the existing JSX style (`<p>`, `<strong>` for UI names, arrow `→` paths like "Settings → Data"). The Reports entry renders sentences from `REPORT_HINTS`.
- [ ] **Step 5b:** Update the search subtitle text and "Try searching for" examples only if they are now inaccurate.
- [ ] **Step 6:** Run the test file again; expected PASS. `npx prettier --write` the two files; `npm run lint`.
- [ ] **Step 7:** Commit `docs(faq): add missing FAQ entries and fix stale answers`.

### Task 4: User Guide, changelog, version, and release checks

**Files:**
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`, `UserGuideSection.test.jsx`, `frontend/src/changelogData.js`, `frontend/package.json`, `frontend/package-lock.json` (edit tool)

- [ ] **Step 1: Write failing test** in `UserGuideSection.test.jsx`: the guide mentions recommending music to friends and the (i) hints on Reports (`getByText` on the new sentence).
- [ ] **Step 2:** Add a short recommendations paragraph (Section 5 or 3, whichever fits) and one line in Section 5 saying "Tap the (i) next to a chart title to see what it means."
- [ ] **Step 3:** Add changelog entry at top, version `0.50.5`, date `2026-11-18`: "Clearer Reports and Help: ..." (plain English, mention hints and the new FAQ entries). Bump `0.50.4` to `0.50.5` in `package.json` and the two version lines at the top of `package-lock.json`.
- [ ] **Step 4: Full checks.** `cd frontend && npm run lint && npm test && npm run build`. Paste the last lines. Run `.venv`/backend tests are not needed (no backend change).
- [ ] **Step 5: Preview.** `scripts/preview.sh up`; run the Page Check (command in AGENTS.md) for all pages; take `/reports` and `/settings` desktop and phone screenshots with `node e2e/preview-shots.mjs <scratchpad folder> /reports /settings`; open a hint by hand in light and dark and in Sleeve and Timeline skins; open the FAQ and the new entries. Report anything seen. Then `scripts/preview.sh down`.
- [ ] **Step 6:** Run the `differential-review` skill on the branch; fix findings.
- [ ] **Step 7:** Push the branch and open the PR using `.github/pull_request_template.md`. Stop; the owner gives the go-ahead and merges on GitHub (visual change).
- [ ] **Step 8:** Commit `docs: update user guide, changelog and version for 0.50.5` before pushing.

---

## Self-review notes
- **Spec coverage:** FAQ entries (Task 3), stale sign-out and privacy checks (Task 3 Step 2), InfoHint and shared wording (Tasks 1, 2, 3), skins/dark/touch (Task 1 CSS, Task 4 Step 5), release housekeeping (Task 4).
- **Open item for the owner, not in this plan:** the privacy rule above (anyone can follow and then view, with no approval). It is a product decision and a possible backend change, so it needs its own plan.
- **Not covered:** any hint on individual bars or cells (non-goal).
