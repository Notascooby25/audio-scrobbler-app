# Arcade view: mockup look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Jukebox's Arcade view look like the owner's original mockup (cabinet with bulbs, record rack, lamps, counter, Pick from panel, grille, result card with cover), appearance only.

**Architecture:** Pure helper module for covers and rack tiles; `RetroJukebox.jsx` becomes the cabinet and delegates the result card to a new `RetroResultCard.jsx`; styles are rewritten in the arcade view's own CSS module. Pick logic and props are untouched.

**Tech Stack:** React 18, CSS Modules, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-20-arcade-view-mockup-look-design.md`

## Global Constraints

- Branch `feat/arcade-view-mockup-look`, from `main`. Commit and push to it by name (`git push origin feat/arcade-view-mockup-look`); never to `main`.
- Only these files may change: `frontend/src/components/jukebox/RetroJukebox.jsx`, `RetroJukebox.module.css`, `RetroJukebox.test.jsx`, new `RetroResultCard.jsx` (+ test), new `retroCovers.js` (+ test), `JukeboxFilters.jsx` (+ test, the one optional prop), plus version/changelog/docs in Task 6. Do not touch `FlatJukebox.*`, the skins, or global CSS.
- The arcade view is intentionally skeuomorphic: gradients and box-shadows are allowed inside it only (DESIGN.md exception).
- All arcade text keeps explicit colours (`#24212b` ink, `#394651` slate, `#c94032` coral-dark) because inherited colours were overridden by themes before. The existing inline colour styles on the result card title and artist must remain (`RetroJukebox.test.jsx` asserts them).
- UK English in user-facing text. `button { text-transform: uppercase }` is global: any mixed-case button must set `text-transform: none` in its module class.
- Component tests that render dialogs or several instances use `afterEach(() => cleanup())`.
- Mockup palette (use these hex values): bg `#f7f3ec`, ink `#24212b`, slate `#394651`, coral `#ff6b5b`, coral-dark `#c94032`, mint `#3cc8b4`, amber `#ffc145`, cabinet-mint `#91e6d5`, cabinet-coral `#ff9a83`, cabinet-yellow `#fff29a`, lamp-off `#e6e0d6`.
- Version 0.53.6 in `frontend/package.json`, `frontend/package-lock.json` (two places) and a new top entry in `frontend/src/changelogData.js`.

## Mockup CSS to port (exact values)

- **Cabinet** `.jukebox`: background cabinet-coral; `border: 2px solid #394651`; `border-radius: 220px 220px 24px 24px`; `padding: 132px 28px 22px`; `box-shadow: 7px 8px 0 #d9c8d6, inset -8px 0 0 #df7c79`; `position: relative; isolation: isolate; max-width: 480px; margin: 0 auto`. Frame `::before`: `inset: 9px; z-index: -1; border: 9px solid #91e6d5; border-radius: inherit; pointer-events: none; box-shadow: 0 0 0 2px #394651, inset 0 0 0 2px #394651, inset 0 0 0 8px #fff29a, inset 0 0 0 10px #394651`.
- **Bulbs** (13 `span`s in an `aria-hidden` container `top: 24px; left: 30px; right: 30px; height: 92px; position: absolute; pointer-events: none`): each `position: absolute; left: var(--x); top: var(--y); width: 10px; height: 19px; border: 1px solid #394651; border-radius: 6px; transform: translateX(-50%) rotate(var(--tilt)); box-shadow: inset 2px 2px 0 #ffffff70, 0 0 0 3px #626878`; colours cycle mint / yellow / coral (`nth-child(3n+2)` yellow, `nth-child(3n)` coral). (x%, y%, tilt) for 1..13: (4,85,-65) (9,62,-55) (16,40,-45) (24,22,-35) (32,10,-25) (41,2,-12) (50,0,0) (59,2,12) (68,10,25) (76,22,35) (84,40,45) (91,62,55) (96,85,65).
- **Marquee**: `position: absolute; top: 70px; left: 50%; transform: translateX(-50%); width: 56%; padding: 9px 5px; background: #ff9a83; border: 2px solid #394651; border-radius: 50% 50% 10px 10px; box-shadow: 0 0 0 4px #91e6d5, 0 0 0 6px #394651; text-align: center; color: #394651; font-weight: 800; letter-spacing: .3em; font-size: 1.05rem`.
- **Stage**: `position: relative; overflow: hidden; display: flex; flex-direction: column; background: linear-gradient(128deg, #ffffff35 0 15%, transparent 15% 34%, #ffffff15 34% 43%, transparent 43%), linear-gradient(#8d81a8 0 60%, #baa5bd); border: 0; border-radius: 12px; box-shadow: inset 0 0 0 2px #394651, inset 0 0 0 7px #cbd9c7`. Top clip `::before`: `left/right: 10px; top: 0; height: 6px; background: #24212b; border-radius: 0 0 4px 4px; z-index: 6`.
- **Rack**: `display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin: 0 10px 10px; padding: 10px; background: repeating-linear-gradient(#fff5d9 0 20px, #ebc8af 20px 21px); border: 2px solid #56666b; border-radius: 5px; box-shadow: 0 0 0 3px #a8d7ca` (10 columns at min-width 600px). Tile `.rec`: `aspect-ratio: 1; border-radius: 4px; box-shadow: 0 1px 0 rgba(0,0,0,.15); transition: opacity .3s, transform .3s, filter .3s, box-shadow .3s`. States: `.outpool { opacity: .5 }`, `.dim { opacity: .15; transform: scale(.6); filter: grayscale(1) }`, `.current { box-shadow: 0 0 0 2px #3cc8b4 }`.
- **Turntable** (inside stage, above the rack, `order: -1`): `position: relative; width: min(230px, 72%); aspect-ratio: 1.3; margin: 38px auto 18px; background: #efb6a4; border: 2px solid #394651; border-radius: 14px; box-shadow: 4px 5px 0 #615775`. Platter: `position: absolute; left: 7%; top: 50%; width: 64%; aspect-ratio: 1; transform: translateY(-50%); border-radius: 50%; background: #b6d8cb; border: 2px solid #24212b`. Vinyl: `inset: 4%; border-radius: 50%; background: repeating-radial-gradient(circle, #1d1b22 0 2px, #2c2933 2px 4px)`; spin keyframes 0 to 1080deg, `1.4s cubic-bezier(.2,.6,.3,1)`. Label: `inset: 32%; border-radius: 50%; display: grid; place-items: center; color #fff; font-weight: 800; font-size: .7rem; text-shadow: 0 1px 2px rgba(0,0,0,.4)` with a 6px dark centre dot. Tone arm: `position: absolute; right: 9%; top: 10%; width: 6px; height: 62%; background: #24212b; border-radius: 3px; transform-origin: 50% 0; transition: transform .5s ease`, pivot `::before` (18px coral circle, 2px dark border, `top: -6px; left: -6px`), head `::after` (`14px x 10px` dark, `bottom: -4px; left: -4px`); resting `rotate(0)`, `.on` is `rotate(24deg)`.
- **Lamps** group: `display: grid; grid-template-columns: repeat(var(--lamp-count), 1fr); gap: 6px; margin: 14px 0 0; padding: 8px; background: #c8dfd7; border: 2px solid #394651; border-radius: 10px; box-shadow: inset 0 0 0 3px #e9eee2, 3px 3px 0 #b16d78`. Lamp: `display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 44px; padding: 4px 1px; border: 2px solid #9faeaa; border-radius: 5px; background: #fff9e9; font-size: .75rem; font-weight: 600; line-height: 1.1; text-transform: uppercase; color: #6d6875`; bulb `10px` circle `#e6e0d6`; `.on`: border amber, text `#24212b`, bulb `#ffc145` with `box-shadow: 0 0 0 3px rgba(255,193,69,.35), 0 0 10px #ffc145`.
- **Counter**: `margin: 10px 0 0; padding: 6px; text-align: center; font-size: .95rem; background: #fff5d9; border: 2px solid #687875; border-radius: 6px`; number `font-size: 1.4rem; tabular-nums`; pool note colour `#6d6875`.
- **Empty box**: `margin: 12px 0 0; padding: 12px; border-radius: 12px; text-align: center; background: #fff2ef; border: 2px dashed #ff6b5b`.
- **Pick from**: fieldset `border: 2px solid #687875; border-radius: 8px; padding: 8px; margin: 14px 0 12px; background: #d5e3d8`; legend `.8rem 700 uppercase, letter-spacing .06em, #6d6875`; segmented 2 columns (4 at min-width 600px) with `gap: 6px`; each option `padding: 8px 6px; border-radius: 10px; border: 2px solid #e6dfd3; background: #fff; font-size: .85rem; font-weight: 600; text-align: center`; checked: `background: #4a5266; border-color: #24212b; color: #fff`; focus ring `3px solid #514367`.
- **Lucky Dip**: `width: 100%; min-height: 44px; font-size: 1.15rem; font-weight: 700; letter-spacing: .02em; background: #fff29a; color: #24212b; border: 2px solid #24212b; border-radius: 999px; box-shadow: 0 4px 0 #24212b`; active `translateY(3px)` with `box-shadow: 0 1px 0`; disabled `opacity: .45`. Hint under it `text-align: center; color: #6d6875; font-size: .85rem`.
- **Speaker grille**: `height: 100px; margin-top: 14px; border: 5px solid #c9d8c8; border-radius: 50% 50% 10px 10px / 22% 22% 10px 10px; outline: 2px solid #394651; background: repeating-linear-gradient(90deg, transparent 0 6px, #394651 6px 8px), radial-gradient(ellipse at 50% 100%, #f6cf96 0 24%, #75688f 25% 52%, #9b8cb5 53%); box-shadow: inset 0 0 0 2px #394651`.
- **Result card**: `background: #fffdf8; border: 3px solid #24212b; border-radius: 16px; padding: 16px`. Tag: `display: inline-block; padding: 3px 10px; border-radius: 999px; background: #ffc145; font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em`. Body: flex, `gap: 14px`. Cover: `width: 120px (150px from 600px); aspect-ratio: 1; border-radius: 8px; border: 2px solid #24212b; display: grid; place-items: center; color #fff; font-size: 2rem; font-weight: 800`. Title `1.2rem`, line-height 1.2, `overflow-wrap: anywhere`. Artist `color #6d6875; font-weight: 600`. Details list `font-size: .88rem`, labels `min-width: 78px; color #6d6875`, values `font-weight: 600`. Actions: 2-column grid, `gap: 10px; margin-top: 16px`, buttons `min-height: 44px; border-radius: 999px; border: 2px solid #24212b; font-weight: 700`; Open in Spotify background mint. Status line `.88rem #6d6875` (out of rolls: `#c94032` bold).

## Review Focus

- Zero matching records: rack fully dimmed, empty box with a working Clear filters button, Lucky Dip disabled, counter reads "0 records".
- Exactly one match: counter says "1 record" (singular).
- More than 40 matches with the current pick outside the first 40: the pick's tile is still in the rack and outlined.
- Records outside the pick pool are half-dimmed; with Pick from "Any" none are.
- 1001 and Rough Trade modes: no Pick from panel, no Length lamp, Mark Played buttons still work; Library mode shows all four lamps.
- Missing artwork or a broken image URL: the cover falls back to the generated cover with initials, never a broken-image icon.
- Very long album and artist names wrap inside the card, never overflow, at 320 px.
- Text stays readable (explicit colours) when the site theme is dark or the Sleeve skin is on.
- `prefers-reduced-motion`: no new motion; the existing spin is already short.

---

## File Structure

- Create `frontend/src/components/jukebox/retroCovers.js` (+ `retroCovers.test.js`): `coverBackground`, `coverInitials`, `buildRackTiles`.
- Create `frontend/src/components/jukebox/RetroResultCard.jsx` (+ `RetroResultCard.test.jsx`): the result card.
- Modify `JukeboxFilters.jsx` (+ `JukeboxFilters.test.jsx`): `hideModeSelector` prop.
- Modify `RetroJukebox.jsx`, `RetroJukebox.module.css` (rewrite), `RetroJukebox.test.jsx`.
- Modify release files in Task 6.

---

### Task 1: Cover and rack helpers

**Files:**
- Create: `frontend/src/components/jukebox/retroCovers.js`
- Test: `frontend/src/components/jukebox/retroCovers.test.js`

**Interfaces:**
- Produces:
  - `coverBackground(album: {album_name?: string, artist_name?: string}): string`, a CSS `background` value, stable for the same title and artist (hash-based hues, three patterns: linear, radial, repeating-linear, as in the mockup's `coverBackground`).
  - `coverInitials(title: string): string`, 1 to 2 upper-case letters, skipping "the/a/an/of/and/in", falling back to the first two letters, `"LP"` for an empty title.
  - `buildRackTiles({ filteredAlbums, pool, currentPick, size = 40 }): Array<{ key: string, id: number | string | null, state: "in" | "outpool" | "current" | "empty", album: object | null }>` returns exactly `size` tiles. Up to `size` matching records come first in their given order; if `currentPick` is among `filteredAlbums` but beyond the first `size`, it replaces the last tile. A record in `filteredAlbums` but not in `pool` (when `pool` is non-empty) is `"outpool"`; the current pick is `"current"`; leftover slots are `"empty"` with `id: null`.

- [ ] **Step 1: Write failing tests** in `retroCovers.test.js`: `coverBackground` returns the same string for the same album and a different one for a different album; `coverInitials("The Queen Is Dead") === "QI"`, `coverInitials("Rumours") === "RU"`, `coverInitials("") === "LP"`; `buildRackTiles` with 3 matches returns 40 tiles, first 3 not empty, remaining 37 `"empty"`; with 100 matches returns 40 non-empty tiles; the pick at index 70 is present as the last tile and has state `"current"`; with `pool` of 1 of 3 matches the other two are `"outpool"`; with an empty `pool` array no tile is `"outpool"`; zero matches gives 40 `"empty"` tiles.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/components/jukebox/retroCovers.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the three exports in `retroCovers.js` (pure functions, no React). Port the mockup's FNV-1a hash and pattern choice.
- [ ] **Step 4: Run** the test file. Expected: PASS. `npx prettier --write` the two new files.
- [ ] **Step 5: Commit** both files; message `feat(jukebox): cover and rack helpers for the arcade view`.

### Task 2: Optional `hideModeSelector` on the shared filters

**Files:**
- Modify: `frontend/src/components/jukebox/JukeboxFilters.jsx` (the "Mode Selector (in Library mode)" block)
- Test: `frontend/src/components/jukebox/JukeboxFilters.test.jsx`

**Interfaces:**
- Produces: `JukeboxFilters` accepts `hideModeSelector` (boolean, default `false`). When true, the "POOL SELECTION MODE" block is not rendered. Nothing else changes; the "N active" count still includes the mode.

- [ ] **Step 1: Write failing test**: with `sourceMode="library"` and the drawer expanded, "POOL SELECTION MODE" is present by default and absent with `hideModeSelector`.
- [ ] **Step 2: Run** `npx vitest run src/components/jukebox/JukeboxFilters.test.jsx`. Expected: new test FAILS.
- [ ] **Step 3: Implement** the prop with the smallest edit (add to the props destructure with default `false`, and `!hideModeSelector &&` to the existing condition).
- [ ] **Step 4: Run** the file and the whole `src/components/jukebox` folder. Expected: PASS.
- [ ] **Step 5: Commit** with `git add` of the two files; message `feat(jukebox): let the arcade view hide the filters' mode selector`.

### Task 3: The cabinet

**Files:**
- Modify: `frontend/src/components/jukebox/RetroJukebox.jsx`, `RetroJukebox.module.css` (rewrite using the "Mockup CSS to port" section; delete rules no longer used)
- Test: `frontend/src/components/jukebox/RetroJukebox.test.jsx`

**Interfaces:**
- Consumes: `buildRackTiles`, `coverBackground`, `coverInitials` (Task 1); `JukeboxFilters` prop `hideModeSelector` (Task 2); `RetroResultCard` (Task 4, rendered where the old card was; until Task 4 lands, keep the existing card markup in place so every commit stays green, then move it in Task 4).
- Produces: `RetroJukebox` keeps every existing prop and now also reads `pool` (rename the unused `_pool` parameter; default `[]`). New markup, in order: bulbs (`aria-hidden`), marquee (`JUKEBOX`), stage (rack `aria-hidden`, turntable with tone arm; the tone arm gets the `on` class when `currentPick` exists), lamps group (`role="group" aria-label="Filter selectors"`, each lamp a `button` with `aria-label` like `Genre filter on, go to filters` / `off`), counter (`<p>` with the number in `<strong>`, `record`/`records`, and the pool note), empty box (only when `filteredAlbums.length === 0`) with a `Clear filters` button calling `clearFilters`, Pick from fieldset (only when `sourceMode === "library"`, a `legend` "Pick from" and four radio-style options Any / Least played / Most played / Recently added calling `setMode(key)`), the `JukeboxFilters` block (with `hideModeSelector`), Lucky Dip, a hint line, the result card, and the grille (`aria-hidden`) last.
- Lamp set: Artist (`filters.artist.trim()`), Year (`filters.decade.size || filters.year?.size`), Genre (`filters.genre.size`), and Length (`filters.length.size`, Library mode only). Lamp click scrolls the filters block into view and focuses the `.jukebox-filters-toggle` button inside it (guard `scrollIntoView` being undefined in jsdom).
- Counter pool note: `· picking from {pool.length} {least played|most played|recently added}` when `mode !== "any"`, `sourceMode === "library"` and there are matches.

- [ ] **Step 1: Write failing tests** in `RetroJukebox.test.jsx` (keep the two existing tests, updating only the counter text assertion to `/records?$/`-style: the count element reads "1 record"): rack has 40 tiles (query by `data-testid="rack-tile"`), with 1 match one tile is not `data-state="empty"`; the current pick's tile has `data-state="current"`; a pool narrower than the matches gives `data-state="outpool"` tiles; lamps: an active genre filter marks the Genre lamp `aria-pressed`-free but its `aria-label` contains "on" and its class/`data-on="true"`; the Length lamp exists in Library mode and not in `sourceMode="1001"`; Pick from options render only in Library mode and clicking "Least played" calls `setMode("least")`; the Filters drawer, when opened, does not contain "POOL SELECTION MODE"; with zero matches the empty box shows and "Clear filters" calls `clearFilters`; clicking a lamp moves focus to the Filters button; counter reads "0 records" / "1 record" / "5 records" and shows the pool note for `mode="least"`.
- [ ] **Step 2: Run** `npx vitest run src/components/jukebox/RetroJukebox.test.jsx`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the markup and CSS. Use `data-testid="rack-tile"` and `data-state` on tiles, `data-on` on lamps. Tile background comes from `coverBackground`. Keep `handleRoll`, the spin and all existing behaviour unchanged.
- [ ] **Step 4: Run** the file, then the whole `src/components/jukebox` folder. Expected: PASS. Prettier on touched files only.
- [ ] **Step 5: Commit** the touched files; message `feat(jukebox): arcade cabinet with bulbs, rack, lamps, counter and grille`.

### Task 4: The result card

**Files:**
- Create: `frontend/src/components/jukebox/RetroResultCard.jsx`
- Test: `frontend/src/components/jukebox/RetroResultCard.test.jsx`
- Modify: `RetroJukebox.jsx` (replace the old inline card with `<RetroResultCard .../>`), `RetroJukebox.module.css`

**Interfaces:**
- Produces: `RetroResultCard({ currentPick, sessionActive, sourceMode, mode, rollsLeft, busy, outOfRolls, spotifyLink, onReroll, onCommit, onToggle1001Completed, onToggleRoughTradeCompleted })`. `onReroll` is the already-wrapped handler (the parent passes `() => handleRoll(onReroll)`). It renders: the tag (`Today's featured pick` when no session, else `Lucky dip · <Any|Least played|Most played|Recently added|1001 Albums|Rough Trade Top 100>`), a cover (`<img>` of `currentPick.artwork_url` with `alt=""`, hidden on error; otherwise the generated cover with initials), the title as `<h3>` and the artist line with inline colours exactly as today (`#24212b`, `#394651`, text `"Artist (Year)"`), a details list (Year; Plays when `play_count` is a number; for 1001 Decade and genres; for Rough Trade Rank and list year), the 1001/Rough Trade Mark Played button (same `aria-label` and toggle calls as today), Re-roll (`Re-roll (n)`, disabled as today) and Open in Spotify (same link and `onCommit`), and a status line (`Re-rolls left: n` while a session runs; `No more rolls – give it a spin!` when out of rolls; otherwise `Hit Lucky Dip for a random record.`). With no pick: title `No Album Picked`.

- [ ] **Step 1: Write failing tests**: tag text for no session, library session with mode `least`, `sourceMode="1001"`, and `rough_trade`; cover shows the generated initials when `artwork_url` is missing; after firing an `error` event on the cover image the image is gone and initials show; title colour `#24212b` and artist `"The Beatles (1969)"` colour `#394651` inline; Plays row shown for `play_count: 42` and absent when missing; Mark Played calls `onToggle1001Completed(id, true)` / `onToggleRoughTradeCompleted(id, false)` in the matching modes and shows `✓ Played` when completed; Re-roll is disabled when `!sessionActive` or out of rolls and calls `onReroll` otherwise; Open in Spotify has the given `href`, `target="_blank"`, `rel` containing `noopener`, and calls `onCommit`; a very long title renders in the heading.
- [ ] **Step 2: Run** `npx vitest run src/components/jukebox/RetroResultCard.test.jsx`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the component (move the existing inline-styled card code into it, restyling with module classes from the mockup values; keep the inline colour styles on title and artist). Add the card classes to `RetroJukebox.module.css` or a sibling `RetroResultCard.module.css` (builder's choice; keep the module small and focused).
- [ ] **Step 4: Run** the card test, `RetroJukebox.test.jsx` and the whole `src/components/jukebox` folder. Expected: PASS.
- [ ] **Step 5: Commit** the touched files; message `feat(jukebox): arcade result card with cover, tag and details`.

### Task 5: Look at it for real and fix what shows

**Files:** the files from Tasks 1 to 4 only, as needed.

- [ ] **Step 1: Build and preview.** `cd frontend && npm run lint && npm test && npm run build`, then `scripts/preview.sh up` and open the Play page, switch to Arcade View (button "Switch to Arcade View").
- [ ] **Step 2: One batched browser round** (Playwright script kept in the scratchpad, never in the repo; screenshots saved outside the repo because they show real data) at 1280, 800, 390 and 320 px, in Classic dark, Timeline light and Sleeve dark looks (set `data-skin` and `data-theme` on `<html>` after load, as the preview's saved skin overrides localStorage): bulbs follow the arch; rack shows real counts (library, 1001 and Rough Trade modes via the source buttons); click every control and watch the result: each lamp, each Pick from option, Filters drawer, Clear filters in the empty state (filter to zero by typing nonsense in Artist), Lucky Dip, Re-roll, Mark Played, Open in Spotify (do not follow the link); no sideways page scroll; no console errors; text contrast on cream panels measured with sampled pixels (≥ 4.5:1).
- [ ] **Step 2b: Compare with the mockup.** Read the mockup file's screenshot-equivalent layout from the "Mockup CSS to port" section and say what still differs.
- [ ] **Step 3: Fix everything shown in one batch, then one confirming round.** Run `node "$HOME/.gemini/config/safe-change/bin/page_check.mjs" http://localhost:15173 /play /library /gigs /reports /profile /following /settings /connect /changelog --sign-in /preview-login.html --skip /gigs/:concertId /profile/:userId` from `frontend/`; expected `0 failed`.
- [ ] **Step 4: Commit fixes** by explicit path; message `fix(jukebox): arcade view layout fixes from browser check`. Stop the preview later with `scripts/preview.sh down` (or leave it up for the owner, then stop it when they say).

### Task 6: Release, docs and hand-over

**Files:**
- Modify: `frontend/src/changelogData.js`, `frontend/package.json`, `frontend/package-lock.json` (two places), `frontend/src/components/settings/UserGuideSection.jsx` and `FaqSection.jsx` only if they describe the arcade look (grep "Arcade"); `HANDOVER.md` (one line under feature history; also update `HANDOVER.private.md` if it exists, never commit it).

- [ ] **Step 1:** Changelog `0.53.6`, 2026-11-20, plain English: the Arcade view now looks much more like the original jukebox design (bulbs, record rack, lamps, counter, Pick from panel, speaker grille, result card with cover). No change to how picks work.
- [ ] **Step 2:** Bump the version in three places; update the docs found by the grep.
- [ ] **Step 3: Full check set** as `AGENTS.md`: `ruff check backend/app worker scripts` (unchanged but part of CI), `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q` saved to a file and checked for "failed", `cd frontend && npm run lint && npm test && npm run build`. `npm run test:e2e` is not required (no routes or navigation change). Show the last lines of each real output.
- [ ] **Step 4: Security and process checks:** `differential-review` on the whole branch (report under `$HOME/.local/share/safe-change/audio-scrobbler/`), the `pwa-failure-points` quick check, `impeccable` audit of the changed area (an arcade-specific read, since DESIGN.md's flat rules are waived here), gitleaks with `--redact` on commits, working tree and staged changes.
- [ ] **Step 5: Commit, push by branch name, open the PR** with the template headings (What changed / What was checked / What was not checked / Live check / host-edit question). Hand over a phone-sized try-out list; preview with `scripts/preview.sh up --phone` only when the owner asks. The owner merges.
