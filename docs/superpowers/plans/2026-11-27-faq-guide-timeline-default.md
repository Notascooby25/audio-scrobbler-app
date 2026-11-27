# FAQ and Guide catch-up, Timeline FAQ audit, Timeline default skin: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Follow `agents/implementation_agent.md` and AGENTS.md.

**Goal:** Bring the FAQ and User Guide up to date, polish the FAQ page in the Timeline skin, and make Timeline the default skin for new accounts.

**Architecture:** Three independent releases, each on its own branch cut from a clean `main` (the current branch `fix/timeline-library-grid-and-bars` holds unrelated uncommitted test edits and is left alone). Parts 1 and 2 are frontend-only. Part 3 changes the default in frontend, API and database, with a new Alembic migration that changes only the column's server default.

**Tech Stack:** React 18 + Vite + Vitest (frontend), FastAPI + SQLAlchemy 2 + Alembic (backend), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-27-faq-guide-timeline-default-design.md`

## Global Constraints

- UK English in all user-facing text (`frontend/src/ukSpelling.test.js` enforces it).
- Flat-by-default: zero gradients, zero `box-shadow`, approved colour tokens only. Retro Jukebox files are never touched.
- Timeline CSS goes only in `frontend/src/skins/timeline/timeline.css`, selectors prefixed `[data-skin="timeline"]`. Classic (`styles.css`) and Sleeve CSS unchanged.
- Buttons showing mixed-case text declare `text-transform: none;`.
- Existing users' stored skin is never changed. No migration of rows. Old migrations are never edited.
- Every FAQ or Guide claim is verified against the code (or the preview) before it is written.
- Never commit to `main`; version bump + `changelogData.js` entry once per release, just before go-ahead. Check `main`'s current version first: `0.55.1` is already used on an unmerged branch, so pick the next free number at release time.
- Run `differential-review` on each branch before its PR; reports go to `$HOME/.local/share/safe-change/audio-scrobbler/`, never the repo.

## Review Focus

- Brand-new visitor with nothing in localStorage: first paint must already be Timeline (no flash of Classic). Owned by Task 5.
- Existing user with `classic` stored on a new device: sees Timeline briefly, then their saved skin. Accepted; noted in the changelog. Owned by Task 5.
- User with `?skin=classic` in the URL still gets Classic. Owned by Task 5.
- FAQ search still finds every new answer by keyword and an empty search shows all. Owned by Task 1.
- Page-map answer lists only pages and tabs that exist. Owned by Task 1.

---

## PART 1: FAQ and User Guide catch-up (branch `docs/faq-guide-catch-up`)

### Task 1: New and corrected FAQ answers

**Files:**
- Modify: `frontend/src/components/settings/FaqSection.jsx` (add entries to `FAQ_DATA`; edit `page-map`)
- Test: `frontend/src/components/settings/FaqSection.test.jsx`

**Interfaces:**
- Produces: new FAQ ids, used by the tests: `discover-filters`, `setlists-cover-band`, `jukebox-lucky-dip`, `gig-report-widgets`, `wrapped-where-and-share`, `timeline-skin-guide`, `share-scrobbles-undo`.

- [ ] **Step 1: Verify each claim in code first.** Read `DiscoverFilters.jsx`, `DiscoverSettingsModal.jsx`, `DiscoverGigsTab.jsx`, `JukeboxCard.jsx` (roll limit, view switch), `ReportsPage.jsx` and the gigs report components (widget names, customiser), `WrappedPage.jsx` (Share button, where past years list), the Timeline Today page slot (source markers, quiet-gap threshold), `LibraryPage.jsx` (Grid/List toggle) and the Share Scrobbles backend (no undo, no marker). Note any claim that turns out wrong and change the answer, not the code.
- [ ] **Step 2: Write failing tests** in `FaqSection.test.jsx`: one `it` per new id asserting its question text is present (`getByText(/.../i)`), e.g. `/how do i use the filters on the discover tab/i`, `/cover band or tribute act/i`, `/lucky dip/i`, `/what do the gig report widgets/i`, `/where do i find my past wrapped/i`, `/what do the coloured markers/i`, `/can i undo share scrobbles/i`; plus `it("finds new answers by keyword")` searching `"discover"` and asserting the Discover-filters question shows; plus `it("page map lists Today, Discover and Wrapped")` opening nothing (answers render in the DOM) and asserting text `Today`, `Discover`, `Wrapped` appear in the page-map list.
- [ ] **Step 3: Run** `cd frontend && npx vitest run src/components/settings/FaqSection.test.jsx`. Expected: the new tests FAIL.
- [ ] **Step 4: Add the seven entries and fix `page-map`** in `FaqSection.jsx`. Categories: Discover filters and cover band under "Set Lists & Gigs"; Jukebox under "General & Appearance"; widgets and Wrapped under "Reports & Stats"; Timeline guide under "General & Appearance"; share-undo under "Friends & Social". Same JSX style as neighbouring entries (`<p>`, `<strong>`, `<em>`; `&apos;`). Also check every "Settings → X" in the file against the real tabs (General, Views, Scrobble, Data, Notifications, User Guide, FAQ, Danger Zone) and correct any wrong.
- [ ] **Step 5: Run** the same command. Expected: all PASS. Also `npx vitest run src/ukSpelling.test.js`. Expected: PASS.
- [ ] **Step 6: Commit** `docs: bring FAQ up to date with recent features`.

### Task 2: User Guide mirrors the same gaps

**Files:**
- Modify: `frontend/src/components/settings/UserGuideSection.jsx` (chapters 1, 5, 7 mainly)
- Test: `frontend/src/components/settings/UserGuideSection.test.jsx`

**Interfaces:**
- Consumes: the verified facts from Task 1 step 1.

- [ ] **Step 1: Write failing tests** asserting new headings/phrases exist: a Discover filters subsection (`getByText(/local radar/i)`), cover band (`/tribute act/i`), Jukebox Lucky Dip and Arcade/Flat (`/arcade/i`), Wrapped tab (`/wrapped/i`), Timeline markers (`/quiet gap/i`). Check first with `getAllByText` where the phrase already exists, and only assert the genuinely new ones.
- [ ] **Step 2: Run** `npx vitest run src/components/settings/UserGuideSection.test.jsx`. Expected: new tests FAIL.
- [ ] **Step 3: Add the text** to the matching chapters in the Guide's existing style (`<h4>` subsections, short paragraphs). Do not duplicate the FAQ word for word.
- [ ] **Step 4: Run** the guide, FAQ and UK-spelling tests, then `cd frontend && npm run lint && npm test && npm run build`. Expected: all pass (paste the last lines).
- [ ] **Step 5: Verify in a real browser** on the preview (`scripts/preview.sh up`): open Settings → FAQ and → User Guide in all three skins; open each new answer; use the search box.
- [ ] **Step 6: Release prep and commit:** bump `frontend/package.json` version and add the top entry in `frontend/src/changelogData.js` (plain English: "Help: the FAQ and User Guide now cover ..."). Commit `docs: update user guide; release vX.Y.Z`. Then differential-review, PR with change record, preview hand-over, wait for go-ahead.

---

## PART 2: FAQ page audit in Timeline (branch `fix/timeline-faq-audit`, cut after Part 1 is merged)

### Task 3: Impeccable audit and findings list

**Files:**
- Read: `frontend/src/skins/timeline/timeline.css:2700-2830` (existing `.faq-*` rules), `frontend/src/styles.css` (`.faq-*` base rules).

- [ ] **Step 1: Invoke the `impeccable` skill in audit mode on the FAQ page** (Settings → FAQ, `?skin=timeline`), at 1280px, 390px and 320px wide, light and dark. Cover: search box (focus, clear button, empty-results message), category headings, open and closed `<details>` states (marker, hover, focus-visible ring), tap target height (≥44px on phone), text contrast (body, muted, links in answers), long answers and `<code>` wrapping with no sideways scroll, nested lists and `<ol>` indentation (the `car-friends` answer uses inline style).
- [ ] **Step 2: Save the findings** (severity-ordered, with measurements) to `$HOME/.local/share/safe-change/audio-scrobbler/faq-audit.md`, not the repo. Show the list to the owner in chat and agree which to fix before changing CSS.

### Task 4: Fix agreed findings (Timeline only)

**Files:**
- Modify: `frontend/src/skins/timeline/timeline.css` (only `[data-skin="timeline"] .faq-*` rules)
- Test: `frontend/src/skins/timeline/timeline.test.jsx`

- [ ] **Step 1: Write failing tests** in `timeline.test.jsx`, one per agreed fix, in the file's existing style: read `timeline.css` and assert the rule exists with the agreed property (e.g. `[data-skin="timeline"] .faq-question` has `min-height: 44px`), plus one standing invariant test: the FAQ block of `timeline.css` contains no `box-shadow` and no `gradient`.
- [ ] **Step 2: Run** `npx vitest run src/skins/timeline/timeline.test.jsx`. Expected: new tests FAIL.
- [ ] **Step 3: Implement the CSS fixes.** Blast radius: `git grep -n "faq-"` shows the classes are used only by `FaqSection.jsx`; confirm Classic and Sleeve rules are untouched (`git diff --stat` shows only `timeline.css` and tests).
- [ ] **Step 4: Run** `cd frontend && npm run lint && npm test && npm run build`, then `npx prettier --write` on the edited files only.
- [ ] **Step 5: Page check** from `frontend/`: `node "$HOME/.gemini/config/safe-change/bin/page_check.mjs" http://localhost:15173 /play /library /gigs /reports /profile /following /settings /connect /changelog --sign-in /preview-login.html`. Expected: no FAIL lines.
- [ ] **Step 6: Click every control** in a real browser on the preview: search, clear, each category's open and closed items, keyboard Tab/Enter/Space on summaries, phone and PC, light and dark. Screenshots go outside the repo.
- [ ] **Step 7: Release prep and commit:** version bump + changelog entry ("Help: the FAQ page is easier to read and tap in the Timeline theme"). Differential-review, PR, preview hand-over, wait for go-ahead.

---

## PART 3: Timeline as the default skin (branch `feat/timeline-default-skin`, cut after Part 2 is merged)

### Task 5: Default skin becomes Timeline for new accounts

**Files:**
- Modify: `frontend/src/skins/index.js:48` (`DEFAULT_SKIN_ID = "timeline"`)
- Modify: `frontend/public/theme-init.js:3-5` (when no URL or stored skin, set `data-skin="timeline"`)
- Modify: `frontend/src/pages/SettingsPage.jsx:428,436` (replace the `"classic"` literals with `DEFAULT_SKIN_ID`)
- Modify: `backend/app/models.py:82` (`default="timeline"`), `backend/app/schemas/preferences.py:33` (`skin: str = "timeline"`), `backend/app/services/preferences_service.py:12` (`"skin": "timeline"`)
- Create: `backend/migrations/versions/0039_default_skin_timeline.py`
- Test: `backend/app/tests/test_preferences.py` (rename `test_settings_returns_classic_skin_default` to `..._timeline_...`, assert `"timeline"`), `backend/app/tests/test_migrations.py`, `frontend/src/skins/skins.test.jsx`, `frontend/src/pages/SettingsPage.test.jsx`

**Interfaces:**
- Migration `0039_default_skin_timeline`, `down_revision = "0038_add_year_reviews"`. `upgrade()` runs `batch_alter_table("user_preferences")` then `alter_column("skin", existing_type=sa.String(16), existing_nullable=False, server_default="timeline")`. `downgrade()` sets it back to `"classic"`. It never runs an UPDATE.

- [ ] **Step 1: Write failing tests.**
  - Backend: `test_settings_returns_timeline_skin_default` (new user's `GET` settings returns `skin == "timeline"`); `test_existing_classic_user_keeps_classic` (user with stored `classic` still returns `classic`); in `test_migrations.py`, a test that after `upgrade head` a bare INSERT into `user_preferences` without `skin` yields `timeline`, and that an existing row inserted as `classic` before upgrading stays `classic`. Use the app's non-autoflush session style per AGENTS.md.
  - Frontend: in `skins.test.jsx`, `DEFAULT_SKIN_ID === "timeline"` and `getSkin("nonsense").id === "timeline"`; a `useSkin` resolution test with empty localStorage and no URL returning `timeline`; with `?skin=classic` returning `classic`; with localStorage `classic` returning `classic`. A `theme-init.js` test (load the script in jsdom with empty storage) asserting `data-skin="timeline"` is set, and `classic` when stored.
- [ ] **Step 2: Run** `PYTHONPATH=worker python -m pytest backend/app/tests/test_preferences.py backend/app/tests/test_migrations.py -q` and `cd frontend && npx vitest run src/skins src/pages/SettingsPage.test.jsx`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the edits listed under Files. In `theme-init.js` keep the existing theme (light/dark) logic intact and only add the no-skin fallback.
- [ ] **Step 4: Run migrations against a throwaway Postgres database** (never the `postgres_data` volume): create a uniquely named DB, `cd backend && alembic upgrade head`, confirm `\d user_preferences` shows default `'timeline'`, run `alembic downgrade -1` and confirm `'classic'`, then drop the DB. Paste the output.
- [ ] **Step 5: Run everything CI runs:** `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`, `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`, `cd frontend && npm run lint && npm test && npm run build`, and `npm run test:e2e` (default-skin change touches first load). Paste the last lines of each.
- [ ] **Step 6: Preview checks (PC and phone):** in a private window with no stored data, the first paint is Timeline with no flash of Classic; sign in as a new-style account and see Timeline; Settings still offers Classic and Sleeve and switching persists after reload; `?skin=classic` still works; the owner's existing account is unchanged. Run the page check and capture screenshots outside the repo.
- [ ] **Step 7: Release prep and commit:** version bump + changelog entry ("New accounts now start in the Timeline theme. Existing accounts keep the theme they have. Classic and Sleeve are still in Settings → General"); update the FAQ `skins-visual-themes` answer to say Timeline is the default; update `HANDOVER.md` if it states the default skin. Differential-review, PR with change record (state the schema change and that no rows are updated), preview hand-over, wait for go-ahead.

---

## Self-review notes
- Spec coverage: FAQ items (Task 1), Guide mirror (Task 2), audit (Tasks 3-4), default skin incl. migration, no row changes, settings still list all skins, changelog note (Task 5). Covered.
- The three releases are sequential so each later branch starts from merged `main`; versions are assigned at release time.
- Not covered by tests, flagged for the preview: real-device first-paint flash, real Postgres on the host (the migration only changes a column default, so rollback is `alembic downgrade -1`).
