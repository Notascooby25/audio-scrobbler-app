# Reports: Rough Trade card and "View all" pop-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Rough Trade Top 100 card to Reports beside the 1001 and Live Artist cards, lay the three out in a row, and give each a "View all N" button that opens a pop-up listing every item for the period.

**Architecture:** The report summary already feeds the two cards. The backend now returns the full lists (keeping the first-5 fields for compatibility) plus a new Rough Trade entry. One shared pop-up component renders any list; each card owns its open/closed state. No database change.

**Tech Stack:** FastAPI + SQLAlchemy 2 + Pydantic v2 (backend), React 18 + Vitest + Testing Library (frontend), plain CSS.

**Spec:** `docs/superpowers/specs/2026-11-20-reports-rough-trade-view-all-design.md`

## Global Constraints

- Branch `feat/reports-rough-trade-view-all`; commit and push to it by name (`git push origin feat/reports-rough-trade-view-all`), never to `main`.
- Python: `from __future__ import annotations`, module-level imports only, ruff clean (`ruff check backend/app worker scripts`).
- Frontend: `DESIGN.md` flat style: no gradients, no `box-shadow`, approved colour tokens only. Do not touch `RetroJukebox.*`.
- UK English in user-facing text (colour, favourite, customise...). `frontend/src/ukSpelling.test.js` enforces it.
- Buttons are `text-transform: uppercase` globally: any mixed-case button (e.g. "View all 21") must set `text-transform: none;` in its scoped class.
- Component tests that render dialogs import and call `afterEach(() => cleanup())`.
- Chip label format is exactly `Artist – Album` (en dash with spaces). Rough Trade total is 700.
- Do not edit `backend/app/db/queries/analytics_queries.py` (dead copy).
- Version 0.53.5 in `frontend/package.json`, `frontend/package-lock.json` (two places) and a new top entry in `frontend/src/changelogData.js`.

## Review Focus

- Zero Rough Trade completions: card shows "Browse in Jukebox →", no "View all" button, no crash.
- Exactly 5 items: no button; 6 items: button reads "View all 6".
- A completion manually un-marked (`is_completed=False`) is not counted or listed.
- A completion whose album id is missing from the catalogue still lists as `Album #<id>` (no crash).
- New frontend talking to an old backend (no `all_albums` / `all_artists` field): falls back to the first-5 fields, no crash.
- Pop-up closes on Esc, on the ✕ button and on backdrop click; a long list (700 rows) scrolls inside the pop-up, not the page.
- Long labels (e.g. "Oasis – (What's The Story) Morning Glory?") wrap without sideways page scroll at 320px.
- Hiding one or two cards in Customise leaves the rest filling the row.

---

## File Structure

- Modify `backend/app/schemas/analytics.py`: new fields and `ChallengeRoughTradeEntry`.
- Modify `backend/app/services/analytics_service.py`: ordering, full lists, Rough Trade milestones.
- Modify `backend/app/tests/test_report_enhancements_api.py`: backend tests.
- Create `frontend/src/components/reports/ReportViewAllModal.jsx` (+ `.test.jsx`): shared pop-up.
- Create `frontend/src/components/reports/ReportRoughTradeMilestone.jsx`: new card.
- Modify `Report1001Milestone.jsx`, `ReportLiveConnection.jsx`: View all button.
- Modify `ReportsPage.jsx`, `ReportCustomiseModal.jsx`, `frontend/src/reportHints.js`.
- Modify `frontend/src/styles.css`: grid and pop-up styles.
- Modify tests: `ReportCrossOvers.test.jsx`, `reportHintsWiring.test.jsx`, `ReportCustomiseModal.test.jsx`, `ReportsPage.test.jsx`.
- Modify docs/version: `changelogData.js`, `package.json`, `package-lock.json`, `UserGuideSection.jsx`, `FaqSection.jsx`.

---

### Task 1: Backend returns full lists and Rough Trade progress

**Files:**
- Modify: `backend/app/schemas/analytics.py` (near `Challenge1001Entry`, `LiveArtistsEntry`, `ReportSummaryResponse`)
- Modify: `backend/app/services/analytics_service.py` (`_get_1001_milestones`, `_get_live_artist_connection`, `get_report_summary`)
- Test: `backend/app/tests/test_report_enhancements_api.py`

**Interfaces:**
- Produces: `Challenge1001Entry.all_albums: list[str] = []`; `ChallengeRoughTradeEntry` with the same four fields as `Challenge1001Entry` (`completed_in_period: int`, `total_completed: int`, `recent_albums: list[str]`, `all_albums: list[str]`); `LiveArtistsEntry.all_artists: list[LiveArtistItem] = []`; `ReportSummaryResponse.challenge_rough_trade: ChallengeRoughTradeEntry = ChallengeRoughTradeEntry()`; `_get_rough_trade_milestones(db, user_id, period_start, period_end) -> ChallengeRoughTradeEntry`. `recent_albums` = first 5 of `all_albums`; `top_artists` = first 5 of `all_artists`.

- [ ] **Step 1: Write failing tests** in `test_report_enhancements_api.py` (reuse the `db_session` fixture; users are created as in the existing tests; completions use `completed_at` inside the custom range 2026-10-01..2026-10-31):
  - `test_report_1001_lists_every_album_newest_first`: 7 completions for 1001 ids at distinct `completed_at`; assert `len(recent_albums) == 5`, `len(all_albums) == 7`, `all_albums[:5] == recent_albums`, and `all_albums[0]` is the one completed latest.
  - `test_report_rough_trade_milestone`: completions for Rough Trade ids 1 and 2 (in range), id 3 with `is_completed=False`, id 4 completed outside the range. Assert `completed_in_period == 2`, `total_completed == 3` (ids 1, 2 and 4), `all_albums` equals `["SAULT – Untitled (Black Is)", <id 2 label>]` ordered newest first (read id 2's artist/album with `get_rough_trade_album_by_id(2)`), and that id 3 is absent.
  - `test_report_rough_trade_unknown_album_id_falls_back`: a completion with `album_id=999999` yields `"Album #999999"`.
  - `test_report_rough_trade_empty_for_new_user`: no completions gives zeros and empty lists.
  - `test_report_live_artists_lists_all_and_caps_top_five`: 7 attended artists each with scrobbles in range; assert `len(top_artists) == 5`, `len(all_artists) == 7`, `all_artists` sorted by count descending, `top_artists == all_artists[:5]`.
- [ ] **Step 2: Run** `PYTHONPATH=worker python -m pytest backend/app/tests/test_report_enhancements_api.py -q`. Expected: the five new tests FAIL (missing fields), the existing ones pass.
- [ ] **Step 3: Implement** the schema fields above. In the service add a small helper `_album_label(meta: dict | None, album_id: int) -> str` returning `"{artist} – {album_name}"` (or just the title if no artist, or `Album #{id}` if `meta` has no `album_name`) and use it from both milestone functions (move the label logic out of `_get_1001_milestones`). Order the in-period completions with `.order_by(<Completion>.completed_at.desc(), <Completion>.id.desc())`. Build `all_albums` from every in-period row, `recent_albums = all_albums[:5]`. Add `_get_rough_trade_milestones` using `UserRoughTradeAlbumCompletion` (same filters as the 1001 version) and `get_rough_trade_album_by_id` imported at module level from `.catalog_rough_trade_service`. In `_get_live_artist_connection` set `all_artists=top_matches` and `top_artists=top_matches[:5]`. In `get_report_summary` pass `challenge_rough_trade=_get_rough_trade_milestones(db, user_id, period_start, period_end)`.
- [ ] **Step 4: Run** the file again. Expected: all pass. Then confirm the new tests fail without the change: `git stash push backend/app/services/analytics_service.py`, rerun (expect failures), `git stash pop`.
- [ ] **Step 5: Run the full CI set** (`ruff check backend/app worker scripts`; `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q > /tmp/.../py.txt`; check the saved output has no "failed"). Commit: `git add backend/app/schemas/analytics.py backend/app/services/analytics_service.py backend/app/tests/test_report_enhancements_api.py && git commit -m "feat(reports): send full 1001, Rough Trade and live-artist lists for the period"`.

### Task 2: Shared "View all" pop-up

**Files:**
- Create: `frontend/src/components/reports/ReportViewAllModal.jsx`
- Create: `frontend/src/components/reports/ReportViewAllModal.test.jsx`
- Modify: `frontend/src/styles.css` (append `report-viewall-*` rules after the `.crossover-chip-empty` block)

**Interfaces:**
- Produces: `export default function ReportViewAllModal({ isOpen, title, items, onClose })` where `items: string[]`. Renders nothing when `!isOpen`. Markup follows `WhatsNewModal.jsx`: `.modal-backdrop` (click on backdrop closes), `.modal-dialog.report-viewall-dialog` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a heading, a close button `aria-label="Close dialog"`, a `<ul className="report-viewall-list">` of items, and Esc closes via a `keydown` listener added only while open.

- [ ] **Step 1: Write failing tests** (with `afterEach(() => cleanup())`): hidden when `isOpen` is false; shows the title and every item (render 700 strings and assert the first and last appear); Esc calls `onClose`; clicking ✕ calls `onClose`; clicking the backdrop calls `onClose` but clicking inside the dialog does not.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/components/reports/ReportViewAllModal.test.jsx`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the component and CSS: dialog `max-width: 560px; max-height: 85vh; display: flex; flex-direction: column`; list `overflow-y: auto` (the list scrolls, not the page); header with title left and ✕ right; flat styling only, existing colour tokens, no shadows.
- [ ] **Step 4: Run** the test file. Expected: PASS. `npx prettier --write` the two new files only.
- [ ] **Step 5: Commit** `git add` the three files; message `feat(reports): shared View all pop-up`.

### Task 3: Cards, page wiring, Customise switch, hint

**Files:**
- Create: `frontend/src/components/reports/ReportRoughTradeMilestone.jsx`
- Modify: `Report1001Milestone.jsx`, `ReportLiveConnection.jsx`, `frontend/src/pages/ReportsPage.jsx`, `ReportCustomiseModal.jsx`, `frontend/src/reportHints.js`
- Test: `ReportCrossOvers.test.jsx`, `reportHintsWiring.test.jsx`, `ReportCustomiseModal.test.jsx`, `ReportsPage.test.jsx`

**Interfaces:**
- Consumes: `ReportViewAllModal({ isOpen, title, items, onClose })` from Task 2; summary fields from Task 1.
- Produces: `ReportRoughTradeMilestone({ challengeRoughTrade })` with props shape `{ completed_in_period, total_completed, recent_albums, all_albums }`; `DEFAULT_WIDGET_PREFERENCES.showRoughTrade = true`; `REPORT_HINTS["milestones.rough-trade"]`.
- Each card shows a button `View all {N}` (class `crossover-viewall-btn`, `type="button"`) only when the full list has more than 5 items. Full list = `all_albums` if present, otherwise `recent_albums` (live card: `all_artists`, else `top_artists`). Pop-up titles: "1001 Albums completed this period", "Rough Trade Top 100 completed this period", "Seen-live artists played this period"; live items are `"{artist_name} ({count})"`.

- [ ] **Step 1: Write failing tests**:
  - `ReportCrossOvers.test.jsx`: for each card, 5 items gives no "View all" button; 6 items gives a button named exactly `View all 6` (use `exact: true`); clicking it opens a dialog whose list contains the 6th item and which closes on Esc. Rough Trade card: header `3 / 700`, title `2 Completed This Period`, chips visible, and with `total_completed: 0` shows a link "Browse in Jukebox →". Fallback: 1001 card given only `recent_albums` (no `all_albums`) renders without crashing.
  - `reportHintsWiring.test.jsx`: add `aboutButton("Rough Trade Top 100")` to the crossover test.
  - `ReportCustomiseModal.test.jsx`: the new checkbox "Rough Trade Top 100" is checked by default and toggling it saves `showRoughTrade: false`.
  - `ReportsPage.test.jsx`: with `challenge_rough_trade` in the mocked summary the card appears; with saved preferences `showRoughTrade: false` it does not.
- [ ] **Step 2: Run** `npx vitest run src/components/reports src/pages/ReportsPage.test.jsx`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** New card copies the structure of `Report1001Milestone.jsx` (`report-crossover-card crossover-rough-trade`, badge text "Rough Trade Top 100", `const ROUGH_TRADE_TOTAL = 700`, `InfoHint hintId="milestones.rough-trade"`, chips link to `/jukebox`). Hint text: "Albums from Rough Trade's Albums of the Year lists, 2020 to 2026, that you completed in this period." Add the checkbox in the "Milestones & Highlights" fieldset after the 1001 one (label "Rough Trade Top 100 (Completed albums & progress)"). In `ReportsPage.jsx` include `widgetPreferences.showRoughTrade` in the crossover-grid condition and render the new card between the 1001 and Live cards. The pop-up and button state live inside each card component.
- [ ] **Step 4: Run** the same command plus `npm run lint`. Expected: PASS, lint clean. `npx prettier --write` only the files touched.
- [ ] **Step 5: Commit** the touched files; message `feat(reports): Rough Trade card and View all buttons`.

### Task 4: Three-column layout and button styles, checked in a real browser

**Files:**
- Modify: `frontend/src/styles.css` (`.report-crossover-grid` at about line 7092 and the 820px media query at about 7362; add `.crossover-viewall-btn`)
- Check (no change expected): `frontend/src/skins/timeline/timeline.css` crossover rules

**Interfaces:** consumes the class names from Tasks 2 and 3.

- [ ] **Step 1: Implement** `.report-crossover-grid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }`; remove `.report-crossover-grid` from the 820px single-column media query (`.report-ratios-grid` stays); `.crossover-viewall-btn` is a flat text-style button: `text-transform: none`, min height 44px on touch sizes, colour `var(--color-primary)`, no shadow. Run `git grep -n "report-crossover-grid" -- frontend/src` and confirm Reports is the only user.
- [ ] **Step 2: Run** `cd frontend && npm run lint && npm test && npm run build`; expected all pass. Then `scripts/preview.sh up` and the page check from AGENTS.md (`## Page check`); expected `0 failed`.
- [ ] **Step 3: Click every control in a real browser** (Playwright script kept in the scratchpad, not the repo) at PC 1280, phone 390 and small-phone 320 on `/reports?range=all.time`: three cards in a row on PC and one column on phone; each "View all" opens its pop-up, the list scrolls inside it, Esc / ✕ / backdrop close it; no page-level sideways scroll; hide the Rough Trade card via Customise and confirm the other two fill the row. Save screenshots outside the repo (they show real data). Stop the preview with `scripts/preview.sh down` when finished.
- [ ] **Step 4: Fix anything found on this branch, then commit** `git add frontend/src/styles.css`; message `feat(reports): three-column cross-over row and View all styles`.

### Task 5: Docs, version and hand-over

**Files:**
- Modify: `frontend/src/changelogData.js`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/components/settings/UserGuideSection.jsx` (the "1001 Challenge & Live Gig Cross-Over" item, about line 339), `frontend/src/components/settings/FaqSection.jsx` (add or extend an entry about the Reports cards)

- [ ] **Step 1:** Add changelog entry `0.53.5` dated 2026-11-20: Reports gets a Rough Trade Top 100 card, the three cards sit in a row on wide screens, and each has a "View all" button showing everything from the period. Plain English, UK spelling. Bump the version in the three places.
- [ ] **Step 2:** Update the User Guide item to mention Rough Trade and "View all", and add a short FAQ entry ("Why doesn't the Rough Trade card show an album I've just played?": completions are recorded when you open the Jukebox).
- [ ] **Step 3: Full check set** exactly as in `AGENTS.md`: ruff check, full pytest, `cd frontend && npm run lint && npm test && npm run build`, `npm run test:e2e` is not required (no routes or navigation change). Show the last lines of each real output.
- [ ] **Step 4: Security and process checks**: run `differential-review` on the whole branch (report saved under `$HOME/.local/share/safe-change/audio-scrobbler/`), the `pwa-failure-points` quick check, and gitleaks (`--log-opts="origin/main..HEAD"`, `--pre-commit`, `--pre-commit --staged`, all with `--redact`).
- [ ] **Step 5: Commit, push, open the PR** (`git push origin feat/reports-rough-trade-view-all`; PR body uses `.github/pull_request_template.md` headings: What changed / What was checked / What was not checked / Live check / host-edit question). Hand over with the try-out list; the owner merges.
