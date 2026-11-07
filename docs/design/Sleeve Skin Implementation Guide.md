# Sleeve Skin (Idea B): Implementation Guide

**Date:** 7 November 2026  
**Author:** @Chris  
**Target Repository:** `Notascooby25/audio-scrobbler-app`  
**Status:** Approved for Implementation (Phased Rollout)

---

## 1. Overview & Objective

Add **Idea B** from the redesign package to the **Audio Scrobbler App** as an optional visual skin named **Sleeve**. The existing interface becomes the **Classic** skin and remains the default.

* **Default Behavior:** Users switch skins in **Settings > Appearance**. Anyone who does not switch experiences zero visual or behavioral changes.
* **Style Isolation:** Classic remains pixel-identical. Sleeve styles are scoped under `[data-skin="sleeve"]` or isolated in Sleeve-only components.
* **Palette Engine:** Sleeve is dynamic and always dark. Ambient backgrounds, cards, tabs, and borders are derived dynamically from the dominant color of the current playing album cover (`--sleeve`).

---

## 2. Agent Prompt

When initiating work with an automated coding agent (e.g. Cursor, Claude Code, Antigravity), provide this specification alongside `docs/design/sleeve-mockups.pdf` and invoke the following prompt:

```text
You are working in the audio-scrobbler-app repo. I want to add a second, optional visual skin called "Sleeve" (Idea B from the redesign) alongside the current look, which becomes the "Classic" skin. People choose their skin in Settings > Appearance. Classic stays the default, and anyone who never switches must see no change at all.

The full spec is docs/design/sleeve-skin.md, with phone mockups in docs/design/sleeve-mockups.pdf. Read both before planning.

How to work:
1. Follow AGENTS.md as usual: read HANDOVER.md, plan with agents/planner_agent.md, and wait for my approval before writing code. Use the safe-change process (branch, checks, preview, screenshots).
2. Deliver it as the phased PRs in the spec's "Delivery plan", one phase per PR, starting with Phase 1 (the skin switch and tokens only).
3. Classic must stay pixel-identical. Scope every Sleeve rule under [data-skin="sleeve"] or put it in a Sleeve-only component. Never change a Classic selector to make Sleeve work.
4. Do not touch RetroJukebox.jsx or RetroJukebox.module.css.
5. Where the spec and DESIGN.md disagree, the spec wins for the Sleeve skin only. In Phase 1, add a "Skins" section to DESIGN.md so both rule sets stay written down.
6. For every phase, show me 390px phone screenshots of each page you touched in both skins, and confirm lint, unit tests, and the build pass.

If something in the spec doesn't fit the code, stop and ask me rather than guessing. The spec's "Open Decisions" section lists settled choices; raise any unexpected blockers during planning.
```

---

## 3. How the Skin Switch Works

The skin preference mirrors existing theme and accent settings: it is stored in the database, synchronized with `localStorage`, and applied directly as a `data-skin` attribute on the root `<html>` element.

### Architecture by Layer

| Layer | Responsibility / Changes | File Locations |
| :--- | :--- | :--- |
| **Preference Schema** | Add `skin` column (`classic` \| `sleeve`, default `'classic'`) with a check constraint `ck_user_preferences_skin`. | `backend/app/models.py`<br>`backend/app/schemas/preferences.py`<br>`backend/app/services/preferences_service.py`<br>`alembic/versions/*_add_skin_preference.py` |
| **Apply on Load** | Read skin setting from user profile/cache; set `data-skin` attribute on `<html>`. Cache in `localStorage` under key `audio-scrobbler-skin`. | `frontend/src/App.jsx` (beside `data-theme` & `data-accent`) |
| **Flash Prevention** | Tiny inline script in `<head>` reading cached `localStorage` key and setting `document.documentElement.dataset.skin` before React renders. | `frontend/index.html` |
| **Settings Switch** | Add "Skin: Classic / Sleeve" segmented control in Appearance settings. Visible in both skins. | `frontend/src/pages/SettingsPage.jsx` |
| **URL Override** | `?skin=sleeve` or `?skin=classic` query parameters override user settings for testing, previews, and CI snapshots. | `frontend/src/App.jsx` |
| **Style Bundle** | All Sleeve rules housed in dedicated stylesheet, imported once. Every selector begins with `[data-skin="sleeve"]`. | `frontend/src/skins/sleeve.css`<br>`frontend/src/main.jsx` |
| **Layout Shell** | `Layout.jsx` conditionally renders Classic header/nav or Sleeve 56px header + 72px tab bar based on skin. | `frontend/src/components/Layout.jsx` |
| **Component Hook** | Expose `useSkin()` hook returning `{ skin, setSkin }` for structural conditionals. | `frontend/src/hooks/useSkin.js` |

> **Theme Invariant:** Sleeve is strictly dark. While `data-skin="sleeve"` is active, the light/dark theme switch is hidden and ignored. Switching back to Classic restores the user's prior light/dark theme and accent cleanly.

---

## 4. Design Tokens & Typography

Every surface and border in Sleeve is computed from `--sleeve`: the dominant color of the current playing track's artwork. When artwork is absent or the user disables "Match the album sleeve", `--sleeve` falls back to the active user accent.

### Color Tokens (`color-mix` Engine)

| Token | CSS Definition | Usage |
| :--- | :--- | :--- |
| `--sleeve` | Extracted artwork hex or user accent | Active album tiles, gig hero cards, wordmark blocks |
| `--sl-ground` | `color-mix(in srgb, var(--sleeve) 34%, #000000)` | Primary page canvas & viewport background |
| `--sl-card` | `color-mix(in srgb, var(--sleeve) 55%, #000000)` | Search bar, avatar backgrounds, active tab pills, cards |
| `--sl-deep` | `color-mix(in srgb, var(--sleeve) 22%, #000000)` | Bottom navigation bar background |
| `--sl-muted` | `color-mix(in srgb, var(--sleeve) 22%, #ffffff)` | Secondary text, inactive tab icons, metadata |
| `--sl-edge` | `color-mix(in srgb, var(--sleeve) 82%, #ffffff)` | Hairlines, tile borders, unselected pill outlines |
| `--sl-text` | `#FFFFFF` | Primary headers, active labels, track names |
| `--sl-on-sleeve` | `#1A1305` or `#FFFFFF` (JS contrast calculation) | Text placed directly on `--sleeve` backgrounds |

* **Transition:** When `--sleeve` updates, transition background colors over `300ms ease`. Under `@media (prefers-reduced-motion: reduce)`, transitions are instant (`0ms`).
* **Contrast Safeguard:** `--sl-on-sleeve` must be computed in JavaScript to test contrast against `#FFFFFF` and `#1A1305`, selecting whichever delivers $\ge 4.5:1$ WCAG AA contrast (fixed luminance cut-offs fail on mid-tones such as gold or amber).

### Typography Specs

Fonts are self-hosted via `@fontsource` npm packages (never Google Fonts CDN, ensuring offline PWA functionality).

* **Display Face:** `Young Serif` (Weight 400 only)
* **UI Face:** `Hanken Grotesk` (Weights 400, 500, 600, 700)
* **Tabular Numbers:** `font-variant-numeric: tabular-nums` applied globally across numbers, times, and counters.

| Role | Font Family | Size / Line-Height | Weight |
| :--- | :--- | :--- | :--- |
| **Page Title** (Library, Reports, Gigs) | Young Serif | 34px / 1.05 | 400 |
| **Now-Playing Track Title** | Young Serif | 36px / 1.1 | 400 |
| **Album Wordmark** (on sleeve tile) | Young Serif | 56px / 0.9 | 400 |
| **Section Heading** (Earlier today, Setlist) | Young Serif | 19px–20px / 1.2 | 400 |
| **Wordmark in Header** | Young Serif | 18px / 1.0 | 400 |
| **Row Title** | Hanken Grotesk | 16px / 1.3 | 600 |
| **Secondary Line / Artist** | Hanken Grotesk | 14px / 1.4 | 400 (`--sl-muted`) |
| **Metadata & Tab Labels** | Hanken Grotesk | 12px–13px / 1.2 | 500 (700 when active) |

### Dimensions, Radius & Geometry

* **Page Gutter:** 20px
* **Header Height:** 56px
* **Tab Bar Height:** 72px + `env(safe-area-inset-bottom)`
* **Touch Targets:** Minimum $44 \times 44\text{px}$ across all buttons, hearts, and toggles
* **List Row Height:** Minimum 64px
* **Corner Radii:**
  * Artwork tiles: 4px–6px
  * Surface cards: 12px
  * Fully rounded pills: Search (22px), Filters/Tabs (20px), Active Tab Pill (15px)
* **Flat Design Invariant:** No drop-shadows and no CSS gradients. Visual depth is produced solely by color tiering (`--sl-ground`, `--sl-card`, and `--sl-deep`).

---

## 5. Shared Shell & UI Components

| Component | Visual & Functional Specification |
| :--- | :--- |
| **Header** | **56px.** Left: Young Serif *"Scrobbler"* wordmark (18px). Right: Notification bell with unread badge + 32px avatar linked to `/profile`. Classic navigation link rows and mobile hamburger buttons are hidden. |
| **Bottom Tab Bar** | **72px + safe-area.** Fixed position on `--sl-deep`. 5 equal columns: *Today*, *Library*, *Play*, *Reports*, *Gigs*. 20px stroke icon above 12px label. Active tab features a $56 \times 30\text{px}$ `--sl-card` pill behind the icon with a white bold label (`aria-current="page"`). Inactive tabs render in `--sl-muted`. |
| **Sub-Page Header** | Used on `/settings`, `/connect`, `/following`, `/changelog`, and `/gigs/:id`. 44px back chevron with title (`< Settings`, `< Gig detail`). Suppresses wordmark and avatar. Tab bar remains visible with all tabs neutral. |
| **Sleeve Tile** | Square artwork rendered via `Artwork.jsx`. If artwork is missing: solid `--sleeve` square with artist/album initials positioned bottom-left in `--sl-on-sleeve`. Surrounded by 1px `--sl-edge` border. |
| **Now-Playing Stack** | 252px sleeve tile with a 232px black vinyl disc peeking out to the right. The vinyl disc is drawn with concentric 1px solid border rings (no gradients) and a center label in `--sleeve`. |
| **Crate Carousel** | Horizontal scroll container of 112px tiles. Title (13px / 600) and artist (12px muted) underneath each item. Smooth horizontal touch snapping. |
| **List Row** | 48px square tile, track title and artist, timestamp on the right, and a 44px heart toggle button. Rows separated by 1px `--sl-edge` hairlines. |
| **Pills & Chips** | Search input: 44px height on `--sl-card`. Filter chips: 40px pills. Selected: pure white with ground-colored text. Unselected: transparent with 1px `--sl-edge` outline. |
| **Buttons** | Primary: white surface with `--sl-ground` text. Secondary: transparent with 1px white outline. Text must be sentence case (`text-transform: none`). |
| **Switch** | $146 \times 28\text{px}$ track. White fill when active, `--sl-edge` when disabled. Native `<input type="checkbox">` wrapped inside the label. |
| **Focus Indicator** | High-contrast 2px solid white outline with 2px offset on all keyboard-focused interactive elements. |

### Tab Bar Vector Icons (SVG Paths)

* **Today:** `M3 12h4l3-8 4 16 3-8h4`
* **Library:** `M4 19V5M9 19V5M14 19V8l6 11`
* **Play:** `M6 4l14 8-14 8z`
* **Reports:** `M4 20V10M10 20V4M16 20v-7M22 20H2`
* **Gigs:** `M3 9a3 3 0 0 0 0 6v3h18v-3a3 3 0 0 1 0-6V6H3z`

---

## 6. Screen-by-Screen Routing & Layout

Routes remain identical between skins, with the addition of `/play` to support Sleeve's dedicated discovery tab.

| Tab / Route | Sleeve Screen Layout | Reused Components & Hooks |
| :--- | :--- | :--- |
| **Today**<br>`/` | Now-playing vinyl stack, track title in Young Serif (36px), artist, and playback source line (`Album · Scrobbled 8 minutes ago from Spotify`). Below: "Earlier today" horizontal crate with "See all N" link to Library. | `OverviewPage.jsx` data fetching,<br>`Artwork.jsx`,<br>`SourceBadge.jsx` |
| **Library**<br>`/library` | Young Serif title, pill search field, category pills (*Scrobbles*, *Artists*, *Albums*, *Tracks*). Scrobbles grouped by day with serif date headers and 64px track rows. | `LibraryPage.jsx`,<br>`LibraryScrobbleList`,<br>`LibraryRankList`,<br>`LikedHeart`, `Pagination` |
| **Play**<br>`/play` *(New)* | Big album sleeve tile with title, artist, year, track count, and last-played indicator. Jukebox filter pills, primary "Spin again" button, and secondary "I listened" button. Below: "Time Capsule" list of forgotten tracks. | `JukeboxCard`,<br>`FlatJukebox`,<br>`JukeboxFilters`,<br>`useJukeboxEngine`,<br>`RediscoverCard` |
| **Reports**<br>`/reports` | Listening / Gigs toggle, period pills (*7D*, *30D*, *90D*, *12M*, *All*). Large serif hero count ("4,218 tracks"), comparison delta, listening hours, plays-per-day stat blocks, and bar chart. | `ReportsPage.jsx`,<br>`ChartsPanel`,<br>`TimelineChart`,<br>`GigReportsSection` |
| **Gigs**<br>`/setlists` | Serif header with summary line ("24 shows, 19 artists, 9 venues") and white "Log a gig" pill button. Timeline / Artists / Venues / Songs filters. Timeline rows display stacked day/month date cards. | `SetlistsPage.jsx`,<br>`setlists/components/*` |
| **Gig Detail**<br>`/gigs/:concertId` | Sub-page header (`< Gigs`). Sleeve-colored hero card with date, artist in Young Serif, venue, and support acts. Setlist item rows with personal scrobble play counts and overall completion banner ("Played 6 of 8"). | `SetlistGigPage.jsx`,<br>`SetlistSongRow.jsx` |
| **Profile**<br>`/profile` | 56px Avatar, name in serif, handle, listening-since date, trio of stats (Scrobbles, Following, Followers). Public profile switch. Navigation links: Following, Connect sources, Settings, What's new, Sign out. | `ProfilePage.jsx` |
| **Following**<br>`/following` | Sub-page header (`< Following`). Following / Followers tabs, "Compare listening with friends" pill button. User rows show real-time listening status ("Listening to Loaded") and follow button. | `FollowingPage.jsx`,<br>`FollowButton.jsx` |
| **Connect**<br>`/connect` | Sub-page header (`< Connect sources`). Service cards for Spotify, YouTube History, and BBC Sounds with connection status, last sync time, and action controls. | `HomePage.jsx` connection cards,<br>`ImportProgressBar.jsx`,<br>`YouTubeScrobblerTools.jsx` |
| **Settings**<br>`/settings` | Sub-page header (`< Settings`). Appearance section: Skin segmented control, "Match album sleeve" toggle, and fallback accent color swatches. Notification toggles and data export options below. | `SettingsPage.jsx`,<br>`settings/components/*` |
| **What's New**<br>`/changelog` | Sub-page header (`< What's new`). Clean list of application release notes. | `ChangelogPage.jsx` |

---

## 7. Protected Code & Invariant Rules

1. **Retro Jukebox Protection:** Never modify `RetroJukebox.jsx` or `RetroJukebox.module.css`. On `/play`, Sleeve styles the flat jukebox engine. If a user selects the retro cabinet in settings, render it untouched inside the Sleeve viewport.
2. **Button Text Transform:** `styles.css` enforces `button { text-transform: uppercase; }`. Sleeve uses sentence case. Scope `[data-skin="sleeve"] button { text-transform: none; }` without altering Classic buttons.
3. **Classic Mobile Grid:** The Classic mobile header layout (`grid-template-areas`) at $\le 720\text{px}$ is an invariant. Do not modify Classic layout queries; Sleeve hides the Classic header and mounts its own layout under `[data-skin="sleeve"]`.
4. **Flat Design Test Suite:** `cardConsistency.test.js` fails on any CSS gradient or non-zero `box-shadow`. Sleeve must comply: draw the vinyl record and ambient cards using flat borders and solid color layers.
5. **Color Contrast Thresholds:** Add Vitest assertions in `tests/textContrast.test.js` computing derived tokens for edge-case sleeve inputs (all 8 accents, `#FFFFFF`, `#000000`, and `#FFE100`). Ensure:
   * `--sl-text` on `--sl-ground` $\ge 7.0:1$
   * `--sl-muted` on `--sl-ground` $\ge 4.5:1$
   * `--sl-on-sleeve` on `--sleeve` $\ge 4.5:1$
6. **Component Blast Radius:** Before touching shared components (`ScrobbleList`, `LibraryRankList`, `Artwork`, `LikedHeart`), run `git grep` to identify all usages across Classic pages.
7. **Test Cleanup:** Call `afterEach(() => cleanup())` in all new component test suites to prevent Vitest state leaks.

---

## 8. Delivery Plan

Execute in 9 discrete phases via independent branches and PRs. Classic must remain completely unchanged at every milestone.

```text
[Phase 1] Switch & Tokens (Gated) ──► [Phase 2] Layout Shell & /play
       │                                       │
       ▼                                       ▼
[Phase 3] Today & Play Screens    ──► [Phase 4] Library Screen
       │                                       │
       ▼                                       ▼
[Phase 5] Reports Screen          ──► [Phase 6] Gigs & Gig Detail
       │                                       │
       ▼                                       ▼
[Phase 7] Profile, Settings, etc. ──► [Phase 8] Backend Artwork Colors
                                               │
                                               ▼
                                      [Phase 9] Desktop Rails & Polish
```

| Phase | PR Scope & Tasks | Verification & Acceptance Criteria |
| :---: | :--- | :--- |
| **1** | **Skin Switch & Tokens:** Database migration (`skin` column), Alembic script, Pydantic schemas, `localStorage` sync, inline no-flash script, `?skin=` parameter override. Self-host `@fontsource` packages, establish `sleeve.css` token definitions, and add contrast tests. *Gating: Settings switch visible only with `?skin=sleeve`.* | `npm run lint && npm test && npm run build` pass.<br>Classic UI 100% untouched.<br>Contrast tests pass for all 8 accents + black/white/yellow. |
| **2** | **Sleeve Shell:** Conditional layout in `Layout.jsx`. 56px header, 72px 5-tab bottom bar, sub-page header, and register `/play` route. | Route navigation works on mobile viewports ($390\text{px}$).<br>Classic layout and desktop view remain intact. |
| **3** | **Today & Play Screens:** Build now-playing stack with border-drawn vinyl disc, track metadata, and horizontal crate carousel on `/`. Build `/play` screen with large sleeve, jukebox controls, and Time Capsule. | Pixel-match with mockups at $390\text{px}$.<br>`cardConsistency.test.js` passes (no gradients/shadows). |
| **4** | **Library:** Restyle `/library` under `[data-skin="sleeve"]`. Implement pill search field, category chips, daily scrobble grouping with serif headers, and 64px list rows. | Search, filtering, and pagination function identically to Classic. |
| **5** | **Reports:** Restyle `/reports`. Period pills (*7D*, *30D*, *90D*, *12M*, *All*), listening summary cards, plays-per-day charts, and top artist tiles. | Charts scale cleanly and contrast checks pass. |
| **6** | **Gigs & Gig Detail:** Restyle `/setlists` timeline and `/gigs/:concertId`. Render date blocks, venue details, and setlist completion counters. | Sub-page header transitions cleanly back to timeline. |
| **7** | **Profile, Social & Settings:** Restyle `/profile`, `/following`, `/connect`, `/settings`, and `/changelog`. **Unhide** the Skin segmented control in Settings for all users. | All sub-pages functional; switching skins instantly updates the application shell without reload. |
| **8** | **Dynamic Artwork Colors:** Add `artwork_color` to database track model. Update APScheduler ingestion worker to extract dominant hex colors upon artwork storage and serve via API responses. | Background color dynamically adapts to current track artwork; fallback kicks in when idle. |
| **9** | **Desktop Responsiveness & Final Polish:** Center a 480px column on viewports $>720\text{px}$. Add smooth motion transitions with `@media (prefers-reduced-motion)` fallbacks. Execute Playwright e2e comparison snapshots. | Zero layout regressions; full test suite passes. |

---

## 9. Resolved Architectural Decisions

| # | Topic | Decision | Implementation Rationale |
| :-: | :--- | :--- | :--- |
| **1** | **Dominant Color Extraction** | **Backend Extraction (FastAPI / Worker)** | Browser canvas extraction taints on external Spotify/Deezer CDN images without CORS headers. Compute and cache hex color during background ingestion. |
| **2** | **Desktop Appearance** | **Centered 480px Column (Initial)** | Keeps the tab bar and mobile ergonomics intact without stretching content across ultra-wide monitors. A desktop navigation rail can be evaluated in future iterations. |
| **3** | **Play Page in Classic** | **Shared Top-Level Route (`/play`)** | Register `/play` in `App.jsx` for both skins. Under Classic, render the existing Jukebox component; under Sleeve, render the new vinyl stack and Time Capsule. |
| **4** | **Early Access Gating** | **URL Override Only (`?skin=sleeve`)** | Hide the settings segmented control until Phase 7 is complete. Allows developers to test on mobile via URL without exposing incomplete views to other accounts. |
| **5** | **First-Run Welcome Screen** | **Deferred Post-Phase 9** | The welcome mockup requires changes to unauthenticated onboarding logic. Deferring it prevents scope creep during the visual skin implementation. |