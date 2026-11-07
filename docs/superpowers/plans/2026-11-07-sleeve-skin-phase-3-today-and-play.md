# Sleeve Skin Phase 3: Today and Play Implementation Plan

> **For agentic workers:** Execute via native directly upon plan approval. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 3 ("Today and Play") of the Sleeve visual skin according to `docs/design/sleeve-skin.md` and `docs/design/skins-framework.md`. Provide the dedicated **Today** view (`/`) with the vinyl now-playing stack and earlier today crate, and the album-led **Play** view (`/play`), while keeping Classic 100% pixel-identical and leaving `RetroJukebox.jsx` and `RetroJukebox.module.css` strictly untouched.

**Architecture:**
- **Route & Slot Architecture:**
  - In `App.jsx`: Route `/` renders `!session?.accessToken ? <Navigate to="/connect" replace /> : <Slot name="todayPage" fallback={<Navigate to="/play" replace />} />`.
    - In **Classic**: `slots.todayPage` is undefined $\rightarrow$ falls back to `<Navigate to="/play" replace />`, maintaining 100% backward compatibility.
    - In **Sleeve**: `slots.todayPage` renders `SleeveTodayPage`.
  - In `OverviewPage.jsx`: Renders `<Slot name="playPage" fallback={<ClassicPlayView session={session} />} />`.
    - In **Classic**: `slots.playPage` is undefined $\rightarrow$ renders the existing `AnalyticsPage` with `JukeboxCard` and `RediscoverCard`.
    - In **Sleeve**: `slots.playPage` renders `SleevePlayPage`.
- **Today Components (`frontend/src/skins/sleeve/slots/SleeveTodayPage.jsx`):**
  - Data: Fetches `fetchNowPlaying` and `fetchRecentScrobbles`.
  - `SleeveNowPlayingStack`: 252px square artwork sleeve tile; 232px black vinyl disc with concentric 1px groove circles and center label in `--sleeve` peeking out to the right (built with zero gradients, zero shadows); 36px Young Serif track title; Hanken Grotesk artist and metadata ("Album • Scrobbled X ago from Spotify").
  - `SleeveEarlierCrate`: Horizontal crate with "Earlier today" Young Serif heading, 112px tiles (`overflow-x: auto`), 13px title, 12px muted artist, and a "See all N →" link to Library.
  - Empty state: Clean friendly card when no scrobbles exist yet today.
- **Play Components (`frontend/src/skins/sleeve/slots/SleevePlayPage.jsx`):**
  - Big sleeve tile for tonight's album pick with album name in Young Serif, artist, and release metadata ("Year, N tracks. Last heard X ago").
  - Filter pills using `JukeboxFilters`.
  - Primary "Spin again" button (`background: #ffffff; color: var(--sl-ground); text-transform: none`) and secondary "I listened" button (`border: 1px solid #ffffff; background: transparent; color: #ffffff; text-transform: none`).
  - Below: Time Capsule list ("Tracks you loved, then stopped playing") wrapping `RediscoverCard`.
  - Protected invariant: `RetroJukebox.jsx` and `RetroJukebox.module.css` are untouched. If the user toggles to arcade mode, `RetroJukebox` renders unmodified.
- **Styles (`frontend/src/skins/sleeve/sleeve.css`):**
  - All new selectors strictly scoped under `[data-skin="sleeve"]`.
  - Flat design: 0 gradients, 0 box-shadows.
  - Mobile touch targets $\ge 44\text{px}$.
  - High-contrast text ($\ge 4.5:1$ AA / $\ge 7:1$ AAA).

**Tech Stack:** React 18, Vite, Vitest, CSS tokens, SVG.

---

## Impact Analysis

- **Affected Components / Files:**
  - `frontend/src/App.jsx`
  - `frontend/src/pages/OverviewPage.jsx`
  - `frontend/src/skins/index.js`
  - `frontend/src/skins/sleeve/slots/SleeveTodayPage.jsx` (new)
  - `frontend/src/skins/sleeve/slots/SleevePlayPage.jsx` (new)
  - `frontend/src/skins/sleeve/slots/SleeveVinylDisc.jsx` (new)
  - `frontend/src/skins/sleeve/sleeve.css`
  - `frontend/src/skins/sleeve/sleeve.test.jsx` (new)
  - `frontend/src/skins/skins.test.jsx`
- **Protected Code:**
  - `RetroJukebox.jsx` and `RetroJukebox.module.css` must remain strictly untouched.
  - Classic selectors in `styles.css` must remain untouched.
- **Deploy Impact:** None on database or backend; pure frontend change. Merging to `main` redeploys the frontend container via Watchtower.

---

## Regression Check & Checklist

- **Classic Invariant:** Classic `/` continues to redirect to `/play` (signed in) or `/connect` (signed out). Classic `/play` renders the existing `AnalyticsPage` layout with `JukeboxCard` and `RediscoverCard` unchanged.
- **Protected Jukebox:** `RetroJukebox` arcade cabinet styling and functionality are 100% preserved.
- **Touch Targets:** All interactive buttons and tabs $\ge 44\text{px}$.
- **Contrast:** Sleeve buttons and text maintain $\ge 4.5:1$ contrast against their respective backgrounds.
- **Zero-Shadow / Zero-Gradient Invariant:** Vinyl disc and tiles use borders and solid fills, zero CSS gradients, and zero non-none `box-shadow` declarations.

---

## Step-by-Step Implementation Tasks

### Step 1: Create Sleeve Today View Components
- **Description:** Implement `SleeveVinylDisc.jsx` and `SleeveTodayPage.jsx`:
  - `SleeveVinylDisc.jsx`: Razor-sharp SVG vinyl disc (232px) with concentric 1px borders, center label fill in `var(--sleeve)`, center spindle hole, zero gradients, zero shadows.
  - `SleeveTodayPage.jsx`:
    - Reads session and fetches `fetchNowPlaying` and `fetchRecentScrobbles`.
    - Renders the Now-Playing Stack: 252px sleeve tile with peeking vinyl disc, track title in Young Serif, artist, and relative time/source metadata.
    - Renders the Earlier Today Crate: horizontal row of 112px tiles with 13px titles and 12px muted artists, plus "See all N" link to `/library`.
    - Handles empty scrobble states gracefully.
- **Files:**
  - `frontend/src/skins/sleeve/slots/SleeveVinylDisc.jsx`
  - `frontend/src/skins/sleeve/slots/SleeveTodayPage.jsx`
- **Tests:** `cd frontend && npx vitest run src/skins/sleeve/sleeve.test.jsx`
- **Risks:** Handling missing artwork or empty today state smoothly.
- **Commit Message:** `feat(skins): add sleeve today view with vinyl now-playing stack and crate (Planner Step 1)`

### Step 2: Create Sleeve Play View Components
- **Description:** Implement `SleevePlayPage.jsx`:
  - Uses `JukeboxCard` data/engine or wraps `JukeboxCard` / `FlatJukebox` and `RediscoverCard`.
  - Formats tonight's album pick with Young Serif album title, artist, year, track count, and last heard metadata.
  - Styles primary "Spin again" and secondary "I listened" buttons as high-contrast pills with `text-transform: none`.
  - Preserves `RetroJukebox` completely if arcade mode is selected.
  - Integrates `RediscoverCard` styled with Sleeve tokens below the jukebox.
- **Files:**
  - `frontend/src/skins/sleeve/slots/SleevePlayPage.jsx`
- **Tests:** `cd frontend && npx vitest run src/skins/sleeve/sleeve.test.jsx`
- **Risks:** Jukebox state machine interactions must remain fully functional.
- **Commit Message:** `feat(skins): add sleeve play page with album-led jukebox and time capsule (Planner Step 2)`

### Step 3: Wire Slots in Registry, App.jsx, and OverviewPage.jsx
- **Description:**
  - Register `todayPage: SleeveTodayPage` and `playPage: SleevePlayPage` in `frontend/src/skins/index.js` under `sleeve.slots`.
  - In `frontend/src/App.jsx`, update root `/` route:
    `element={!session?.accessToken ? <Navigate to="/connect" replace /> : <Slot name="todayPage" fallback={<Navigate to="/play" replace />} />}`
  - In `frontend/src/pages/OverviewPage.jsx`, wrap content in `<Slot name="playPage" fallback={<ClassicPlayContent session={session} />} />`.
- **Files:**
  - `frontend/src/skins/index.js`
  - `frontend/src/App.jsx`
  - `frontend/src/pages/OverviewPage.jsx`
- **Tests:** `cd frontend && npx vitest run src/skins/skins.test.jsx src/App.test.jsx`
- **Risks:** Must ensure Classic routes and redirects remain 100% identical.
- **Commit Message:** `feat(skins): connect todayPage and playPage slots to app routes (Planner Step 3)`

### Step 4: Add Scoped Sleeve CSS for Today and Play
- **Description:** Add scoped CSS rules in `frontend/src/skins/sleeve/sleeve.css` for:
  - `.sleeve-today-page`, `.sleeve-now-playing-stack`, `.sleeve-vinyl-wrapper`, `.sleeve-vinyl-disc`.
  - `.sleeve-earlier-crate`, `.sleeve-crate-scroll`, `.sleeve-crate-tile`.
  - `.sleeve-play-page`, `.sleeve-album-hero`, `.sleeve-play-actions`.
  - `.rediscover-card` overrides under `[data-skin="sleeve"]`.
  - Assert zero gradients and zero box-shadows.
- **Files:**
  - `frontend/src/skins/sleeve/sleeve.css`
- **Tests:** `cd frontend && npx vitest run src/skins/skins.test.jsx`
- **Risks:** Ensure mobile responsive layout at 390px, 360px, and desktop widths.
- **Commit Message:** `feat(skins): add scoped styles for sleeve today and play views (Planner Step 4)`

### Step 5: Automated Verification & Mobile Preview Screenshots
- **Description:**
  - Run all linters: `cd frontend && npm run lint` and `ruff check backend/app worker scripts`.
  - Run all unit test suites: `cd frontend && npm test` and `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`.
  - Run production build: `cd frontend && npm run build`.
  - Run Playwright E2E tests: `cd frontend && npm run test:e2e`.
  - Spin up preview: `scripts/preview.sh up`.
  - Capture 390px mobile screenshots of `/` (Today) and `/play` in both Classic and Sleeve skins.
  - Tear down preview: `scripts/preview.sh down`.
- **Files:**
  - `file:///home/andyl/.gemini/antigravity/brain/89996a16-4025-4a64-a4c0-0409b3ebb9af/mobile_preview.md`
- **Tests:** Automated verification commands.
- **Risks:** None.
- **Commit Message:** `test(skins): verify sleeve today and play views with full test suite and preview (Planner Step 5)`

---

Confirm to proceed.
