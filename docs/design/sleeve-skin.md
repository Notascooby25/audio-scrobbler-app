# Sleeve skin (Idea B): implementation guide

Nov 7, 2026 · @Chris

Add Idea B to the Audio Scrobbler app as an optional skin called **Sleeve**. The current look becomes **Classic** and stays the default. People switch between them in Settings, and anyone who never switches sees no change.

> **Building more than one skin?** Build "Skins framework: building and running multiple skins" first. It replaces "How the skin switch works" and phase 1 of the delivery plan below. Sleeve then becomes a skin registered in that framework: `skins/sleeve/sleeve.css`, slot components for navigation, the Today hero and Play, and its private `--sl-*` tokens mapped onto the shared token contract.

## The prompt

Give the coding agent two things: this guide as a Markdown file in the repo, and the prompt below. Export this doc as Markdown, save it as `docs/design/sleeve-skin.md`, and commit it with the Idea B mockups PDF beside it as `docs/design/sleeve-mockups.pdf`.

```text
You're working in the audio-scrobbler-app repo. I want to add a second, optional visual skin called "Sleeve" (Idea B from the redesign) alongside the current look, which becomes the "Classic" skin. People choose their skin in Settings > Appearance. Classic stays the default, and anyone who never switches must see no change at all.

The full spec is docs/design/sleeve-skin.md, with phone mockups in docs/design/sleeve-mockups.pdf. Read both before planning.

How to work:
1. Follow AGENTS.md as usual: read HANDOVER.md, plan with agents/planner_agent.md, and wait for my approval before writing code. Use the safe-change process (branch, checks, preview, screenshots).
2. Deliver it as the phased PRs in the spec's "Delivery plan", one phase per PR, starting with phase 1 (the skin switch and tokens only).
3. Classic must stay pixel-identical. Scope every Sleeve rule under [data-skin="sleeve"] or put it in a Sleeve-only component. Never change a Classic selector to make Sleeve work.
4. Do not touch RetroJukebox.jsx or RetroJukebox.module.css.
5. Where the spec and DESIGN.md disagree, the spec wins for the Sleeve skin only. In phase 1, add a "Skins" section to DESIGN.md so both rule sets stay written down.
6. For every phase, show me 390 px phone screenshots of each page you touched in both skins, and confirm lint, unit tests and the build pass.

If something in the spec doesn't fit the code, stop and ask me rather than guessing. The spec's "Open decisions" section lists questions I still need to answer; raise any that block the phase you're planning.
```

The prompt follows the repo's own process in AGENTS.md (plan first, then approval, then branch, preview and screenshots), so it slots into how the app is already maintained.

## How the skin switch works

Skin works like the existing theme and accent settings: it's a saved preference, mirrored to `localStorage` and applied as an attribute on `<html>`. Everything Sleeve-specific hangs off that attribute.

| Layer | What to add | Where |
| --- | --- | --- |
| Preference | `skin` column, `'classic'` or `'sleeve'`, default `'classic'`, with a check constraint like `ck_user_preferences_theme` | `backend/app/models.py`, a new Alembic migration, `backend/app/schemas/preferences.py`, `preferences_service.py` |
| Apply on load | Set `data-skin` on `<html>` from settings, cache it in `localStorage` as `audio-scrobbler-skin` | `frontend/src/App.jsx`, next to `data-theme` and `data-accent` |
| No flash | Read the cached skin in a tiny inline script in `index.html`, before React mounts | `frontend/index.html` |
| Switch | "Skin: Classic / Sleeve" segmented control in Appearance, shown in both skins | `frontend/src/pages/SettingsPage.jsx` |
| Preview | `?skin=sleeve` or `?skin=classic` in the URL overrides the setting for that session, for testing and screenshots | `App.jsx` |
| Styles | Sleeve rules in `frontend/src/skins/sleeve.css`, every selector starting `[data-skin="sleeve"]` | new file, imported once from `main.jsx` |
| Layout | `Layout.jsx` renders the Classic header nav or the Sleeve header and tab bar, depending on the skin | `frontend/src/components/Layout.jsx` |
| Pages | Reuse the existing data hooks and components; only swap markup where Sleeve's layout really differs (Today hero, Play) | see Screen by screen |

Expose the current skin through a small `useSkin()` hook so components can branch on it. Prefer CSS-only differences, and use a component swap only when the structure changes.

Sleeve is always dark. While Sleeve is on, the light/dark theme setting is hidden and ignored. Switching back to Classic restores the user's theme and accent exactly as they were.

## Design tokens

Every Sleeve colour comes from one input, `--sleeve`: the dominant colour of the artwork for the most recent play. When there's no artwork, or the user turns off "Match the album sleeve", `--sleeve` falls back to their existing accent colour (the eight `data-accent` options).

| Token | CSS | Used for |
| --- | --- | --- |
| `--sleeve` | dominant artwork colour, else accent | artwork tiles, gig card, album wordmark block |
| `--sl-ground` | `color-mix(in srgb, var(--sleeve) 34%, #000)` | page background |
| `--sl-card` | `color-mix(in srgb, var(--sleeve) 55%, #000)` | search field, avatar, active tab pill, cards |
| `--sl-deep` | `color-mix(in srgb, var(--sleeve) 22%, #000)` | bottom tab bar |
| `--sl-muted` | `color-mix(in srgb, var(--sleeve) 22%, #fff)` | secondary text, inactive tabs, icons |
| `--sl-edge` | `color-mix(in srgb, var(--sleeve) 82%, #fff)` | hairlines, tile borders, outlined pills |
| `--sl-text` | `#FFFFFF` | primary text |
| `--sl-on-sleeve` | `#1A1305` or `#FFFFFF` | text placed directly on a sleeve-coloured block. Pick whichever of the two has more contrast against the sleeve (computed in JS). A fixed luminance cut-off fails on mid-tones such as Fool's Gold. |

When `--sleeve` changes, cross-fade the background over 300 ms, or switch instantly under `prefers-reduced-motion`.

**Type.** Display face is Young Serif, used at weight 400 only. UI face is Hanken Grotesk at 400, 500, 600 and 700. Self-host both through `@fontsource` packages rather than Google Fonts, because the app is self-hosted. Turn on `font-variant-numeric: tabular-nums` throughout.

| Role | Face | Size / weight |
| --- | --- | --- |
| Page title (Library, Reports, Gigs) | Young Serif | 34 px, line-height 1.05 |
| Now-playing track title | Young Serif | 36 px |
| Album wordmark on a sleeve tile | Young Serif | 56 px, line-height 0.9 |
| Section heading (Earlier today, Setlist) | Young Serif | 19 to 20 px |
| Wordmark in header | Young Serif | 18 px |
| Row title | Hanken Grotesk | 16 px / 600 |
| Secondary line | Hanken Grotesk | 14 px / 400, `--sl-muted` |
| Meta, tab labels | Hanken Grotesk | 12 to 13 px / 500 (700 when active) |

**Shape and spacing.** Page gutter is 20 px. The header is 56 px tall and the tab bar 72 px plus the safe-area inset. List rows are at least 64 px, and every tap target is at least 44 × 44 px. Artwork tiles have a 4 to 6 px radius, cards 12 px, and pills are fully rounded (search 22 px, tabs and chips 20 px, active tab pill 15 px). Like Classic, Sleeve uses no shadows and no gradients; depth comes from the ground, card and deep tones.

## Shared components

These build up the Sleeve shell. Each is Sleeve-only, or a Classic component restyled under `[data-skin="sleeve"]`.

| Component | Spec |
| --- | --- |
| Header | 56 px. Young Serif "Scrobbler" wordmark on the left. Bell on the right with a white unread badge (ground-coloured number), then a 32 px avatar on `--sl-card` that links to Profile. No link row and no Menu toggle. |
| Bottom tab bar | Fixed, `--sl-deep`, five equal columns: Today, Library, Play, Reports, Gigs. Each tab is a 20 px stroke icon above a 12 px label. The active tab gets a 56 × 30 px `--sl-card` pill behind its icon, a white bold label and `aria-current="page"`; inactive tabs are `--sl-muted`. Pad the bottom with `env(safe-area-inset-bottom)`. |
| Sub-page header | Used for Gig detail, Connect, Following, Settings and What's new. A 44 px back chevron with the label "Back to …", and no wordmark. The tab bar stays visible, with no tab active. |
| Sleeve tile | Square artwork through `Artwork.jsx`. With no artwork, a `--sleeve`-coloured square with initials in Young Serif, bottom-left in `--sl-on-sleeve`. 1 px `--sl-edge` border. |
| Now-playing stack | A 252 px sleeve tile with a black vinyl disc (232 px, drawn with concentric 1 px rings, centre label in `--sleeve`) peeking out to its right. |
| Crate | Horizontal row of 112 px tiles, title (13 px / 600) and artist (12 px muted) under each, scrolls sideways. |
| List row | 48 px tile, title and artist, time on the right, 44 px heart button. 1 px `--sl-edge` divider. |
| Pills | Search field 44 px on `--sl-card`. Section tabs and filters are 40 px pills: selected is white with ground-coloured text, unselected has a 1 px `--sl-edge` outline. |
| Buttons | Primary: white with ground-coloured text. Secondary: 1 px white outline. Both sentence case (see repo rules). |
| Switch | 46 × 28 px track, white when on and `--sl-edge` when off. A real `<input type="checkbox">` inside the label. |
| Focus | 2 px white outline with a 2 px offset on every interactive element. |

Icon paths for the tab bar match the mockups: Today `M3 12h4l3-8 4 16 3-8h4`, Library `M4 19V5M9 19V5M14 19V8l6 11`, Play `M6 4l14 8-14 8z`, Reports `M4 20V10M10 20V4M16 20v-7M22 20H2`, Gigs `M3 9a3 3 0 0 0 0 6v3h18v-3a3 3 0 0 1 0-6V6H3z`.

## Screen by screen

The routes stay the same in both skins. The one addition is `/play`, which the Sleeve tab bar needs. Sample figures in the mockups are illustrative only; every screen uses the real data the page already loads.

| Tab / route | Sleeve layout | Reuse |
| --- | --- | --- |
| Today, `/` | Now-playing stack, then the track title in Young Serif, the artist, and "Album. Scrobbled 8 minutes ago from Spotify." Below that, an "Earlier today" crate with a "See all N" link to Library. | `OverviewPage.jsx` data, `Artwork`, `SourceBadge` text |
| Library, `/library` | Serif title, pill search, then Scrobbles / Artists / Albums / Tracks pill tabs, then rows grouped by day under serif day headings. | `LibraryPage.jsx`, `LibraryScrobbleList`, `LibraryRankList`, `LikedHeart`, `Pagination` |
| Play, `/play` (new) | Tonight's album as a big sleeve tile with the album name, the artist and "1991, 9 tracks. Last heard 14 months ago." Then the jukebox filter pills, a primary "Spin again" button and a secondary "I listened" button. Below, a "Time Capsule" list: "Tracks you loved, then stopped playing." | `JukeboxCard`, `FlatJukebox`, `JukeboxFilters`, `useJukeboxEngine`, `RediscoverCard` |
| Reports, `/reports` | Listening / Gigs tabs, then 7D / 30D / 90D / 12M / All period pills. A large serif headline number with "up 12.4% on the 90 days before", a pair of stats (listening time, plays per day), a plays-per-day chart, then top artists with tiles. | `ReportsPage.jsx`, `ChartsPanel`, `TimelineChart`, `GigReportsSection`, `FriendsComparisonSection` |
| Gigs, `/setlists` | Serif title with a summary line ("24 shows, 19 artists, 9 venues") and a "Log a gig" button. Then Timeline / Artists / Venues / Songs tabs, and rows with a stacked date block (day, month) beside the artist and venue. | `SetlistsPage` and the `setlists/` components |
| Gig detail, `/gigs/:concertId` | Sub-page header. A sleeve-coloured card holding the date, the artist in serif and the venue. Then the support acts, who you went with, and the setlist with each song's play count ("Not yet" for zero) and "You've played 6 of 8". | `SetlistGigPage` |
| Profile, `/profile` | Avatar, name in serif, handle and "listening since" line, a trio of stats, a public-profile switch, then menu rows: Following, Connect sources, Settings, What's new, Sign out. | `ProfilePage.jsx` |
| Following, `/following` | Sub-page header. Following / Followers tabs, a "Compare listening with friends" button, then people rows with a live line ("Listening to Loaded") and a Following button. | `FollowingPage.jsx`, `FollowButton` |
| Connect, `/connect` | Sub-page header. One card per source (Spotify, YouTube history, BBC Sounds) with its status and actions. | `HomePage.jsx`, `ImportProgressBar`, `ImportSummaryPanel`, `YouTubeScrobblerTools` |
| Settings, `/settings` | Sub-page header. Appearance: the Skin switch, then "Match the album sleeve" and "Colour when nothing has played" (the existing accent swatches). Then notifications and "Export everything". Existing sections stay below in Sleeve styling. | `SettingsPage.jsx`, `settings/` components |
| What's new, `/changelog` | Reached from Profile. A plain sub-page listing releases. | `ChangelogPage.jsx` |

The mockups also include a first-run welcome screen ("Your listening history, kept on your own server", with Connect Spotify and Import buttons). The app has no such state today, so treat it as optional; see Open decisions.

## Repo rules that bite

These come from `AGENTS.md`, `DESIGN.md` and the existing tests. Each one changes how Sleeve has to be built.

- **Retro Jukebox is protected.** Never restyle `RetroJukebox.jsx` or `RetroJukebox.module.css`. On Play, Sleeve styles the flat jukebox. If the user has picked the retro cabinet, render it unchanged inside the Sleeve page.
- **Buttons are uppercase by default.** `styles.css` sets `button { text-transform: uppercase; }`. Sleeve buttons are sentence case, so set `text-transform: none` under `[data-skin="sleeve"] button`.
- **The mobile header grid is a Classic invariant.** The `grid-template-areas` header layout at 720 px and below must not change for Classic. Sleeve hides that header's link row and Menu toggle and shows its own header and tab bar, all under `[data-skin="sleeve"]`.
- **Flat-design tests read `styles.css`.** `cardConsistency.test.js` fails on any gradient or non-none `box-shadow`. Sleeve needs neither: draw the vinyl with borders, not gradients. Keep Sleeve CSS in its own file and give it the same checks.
- **Contrast tests.** `textContrast.test.js` checks Classic. Add a Sleeve test that computes the derived tokens for worst-case sleeves (all eight accents, plus `#FFFFFF`, `#000000` and a bright yellow like `#FFE100`). It should assert at least 4.5:1 for text and muted text on ground, and for on-sleeve text on the sleeve. In a check of these colours, text on ground scored 7.2:1 or better and muted text 7.2:1 or better. On-sleeve text scored 4.7:1 or better, but only with the higher-contrast pick.
- **Shared components have a blast radius.** Before restyling `ScrobbleList`, `LibraryRankList`, `Artwork` or `LikedHeart`, `git grep` every page that uses them, and keep Sleeve selectors scoped.
- **Component tests need cleanup.** Call `afterEach(() => cleanup())` in any new component test, because Vitest globals are off.

## Delivery plan

Ship in phases, one PR each, so Sleeve can go live behind the switch while it's only partly built. Classic is untouched in every phase.

1. **Skin switch and foundations.** Add the `skin` preference (model, migration, schema, API), apply `data-skin`, the no-flash script, the Settings control and the `?skin=` preview. Add the tokens and self-hosted fonts in `skins/sleeve.css`, the Skins section in `DESIGN.md`, and the Sleeve contrast test. Until phase 2 lands, the Settings option is visible only with `?skin=sleeve`.
2. **Sleeve shell.** Add the header, bottom tab bar and sub-page header to `Layout.jsx`, plus the `/play` route.
3. **Today and Play.**
4. **Library.**
5. **Reports.**
6. **Gigs and Gig detail.**
7. **Profile, Following, Connect, Settings and What's new.** After this phase, show the Skin option in Settings to everyone.
8. **Sleeve colour from artwork.** Until this lands, `--sleeve` is the user's accent colour, so every earlier phase works without it.
9. **Polish.** Wider screens, reduced motion, and e2e screenshots of every route in both skins (`e2e/preview-shots.mjs` with `?skin=`).

Accept each phase when you have 390 px screenshots of the touched pages in both skins, Classic matches `main`, and `npm run lint && npm test && npm run build` passes.

## Making it go well

### Methods
- **Build the switch before any screen.** Once `data-skin` and `?skin=sleeve` work, every later change can be seen in both skins straight away, and Sleeve can merge to `main` half-built without anyone noticing.
- **Tokens first, screens second.** Get the `--sl-*` colours, fonts and spacing right on the existing layout before reshaping pages. Most of the look comes from tokens, and fixing a token later fixes every screen at once.
- **One screen per PR.** Small PRs are quicker to review, easier to screenshot and easy to revert. Resist "while I'm here" changes to Classic.
- **Restyle before rewriting.** Try CSS under `[data-skin="sleeve"]` first. Write a Sleeve-only component only when the structure itself differs (the Today hero, the Play page, the tab bar).
- **Keep the data layer shared.** Both skins call the same hooks and APIs. If a Sleeve screen needs new data, add it for both skins, so the skins never drift apart in what they show.
- **Work phone-first.** Build and review at 390 px, then check 360 px (small Android) and 430 px (large iPhone) before going wider.
- **Use real data on the preview.** Sample data hides long track names, missing artwork, empty days and huge play counts. `scripts/preview.sh` uses a copy of real data, so review there.

### Checks for every PR
- [ ] Classic looks identical to `main`: compare before and after screenshots of the touched pages.
- [ ] Sleeve matches the mockups at 390 px, apart from changes agreed in review.
- [ ] No selector outside `skins/sleeve.css` or a Sleeve-only component changed for Sleeve's sake.
- [ ] `RetroJukebox.jsx` and `RetroJukebox.module.css` are unchanged.
- [ ] `npm run lint && npm test && npm run build` passes, including the Sleeve contrast test.
- [ ] Every tap target is at least 44 × 44 px, and nothing scrolls sideways except the crate.
- [ ] Keyboard: Tab reaches everything in a sensible order, focus is always visible, and the active tab has `aria-current="page"`.
- [ ] Screen reader: artwork placeholders have a label, decorative icons are hidden, and switches announce their state.
- [ ] Edge cases are covered: no artwork, very long titles, no plays today, first-time user, slow network.
- [ ] Switching skin in Settings takes effect without a reload, and survives one.

### Ideas worth considering
- **A "try Sleeve" banner** for the owner during the build (phases 1 to 7), so feedback starts early without exposing a half-finished skin to followers.
- **A visual regression snapshot per route per skin**, using the repo's Playwright setup. Once both skins exist, a stray Classic change shows up as a diff instead of a surprise.
- **A fallback palette test page** at a dev-only route, showing the Sleeve tokens for every accent colour side by side. It makes contrast or muddy-colour problems obvious at a glance.
- **Measure before and after.** Record page weight and load time at phase 1. Two extra font families can add noticeable weight, so subset them to Latin and load only the weights used.
- **Keep a short decisions log** in `HANDOVER.md`: what was agreed, what was deferred and why. It saves re-arguing the same choices in later phases.
- **Leave a way back.** Keep Classic as the default until Sleeve has been used daily for a while. If Sleeve ever becomes the default, keep Classic available rather than deleting it.

## Open decisions

The owner needs to answer these. Each is marked with the phase it blocks.
- [ ] **Where does the sleeve colour come from?** (phase 8) The recommendation is the backend: when artwork is stored, compute its dominant colour once, cache it, and return `artwork_color` on scrobble responses. Sampling in the browser often fails, because CDN artwork without CORS headers taints the canvas.
- [ ] **What does Sleeve look like on desktop?** (phase 9) The mockups are phone-only. A simple start: above 720 px, centre a 480 px column and keep the tab bar. A later step could turn the tab bar into a left rail.
- [ ] **Should Classic get a Play page too?** (phase 2) `/play` exists for Sleeve's tab bar. Classic could link to it or leave the jukebox on Overview as it is today.
- [ ] **Who gets the switch first?** (phase 1) Everyone, or the owner only, until phase 7 is done.
- [ ] **Should the first-run screen be built?** (optional) The welcome screen is new behaviour for signed-out visitors, not just a reskin.
