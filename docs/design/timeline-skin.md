# Timeline skin (Idea A): implementation guide

Nov 7, 2026 · @Chris

This guide adds Idea A to the Audio Scrobbler app as a third skin, **Timeline**, next to Classic and Sleeve. Timeline turns each day into a vertical rail of plays. It is a calm, light, data-first skin that keeps the user's theme and accent settings. It builds on the switch described in "Skins framework: building and running multiple skins", so do that framework first.

## The prompt

Export this doc as Markdown and save it as `docs/design/timeline-skin.md`. Put the Idea A mockups beside it as `docs/design/timeline-mockups.pdf`. Then give the coding agent this prompt:

```text
You're working in the audio-scrobbler-app repo. I want to add an optional visual skin called "Timeline" (Idea A from the redesign), alongside Classic (the default) and Sleeve. People choose their skin in Settings > Appearance. Anyone who doesn't choose Timeline must see no change.

Specs: docs/design/timeline-skin.md (this skin), docs/design/timeline-mockups.pdf (phone mockups) and docs/design/skins-framework.md (how skins work in this app). Read all three before planning. If the skins framework isn't in the codebase yet, plan that first and stop for my approval.

How to work:
1. Follow AGENTS.md: read HANDOVER.md, plan with agents/planner_agent.md, and wait for my approval before writing code. Use the safe-change process.
2. Deliver the phases in the Timeline spec's "Delivery plan", one phase per PR.
3. Classic must stay pixel-identical, and Sleeve must not change. Scope every rule under [data-skin="timeline"] or put it in a Timeline slot component.
4. Timeline supports light, dark and system themes and all eight accent colours. Every PR must pass the contrast matrix for all of them.
5. Do not touch RetroJukebox.jsx or RetroJukebox.module.css.
6. For each phase, show me 390 px screenshots of the touched pages in Timeline light and dark, plus the Classic regression result, and confirm lint, unit tests and the build pass.

If something in the spec doesn't fit the code, stop and ask. Raise any "Open decisions" that block the phase you're planning.
```

## What Timeline is

Timeline treats listening as a log of time. Today opens on the date, a running total and an hour-by-hour bar chart, then a vertical rail of plays with quiet gaps shown as dashed stretches. The other screens share its plain grotesque type, white cards on a cool grey page, and one accent colour used sparingly.

| | Classic | Sleeve | Timeline |
| --- | --- | --- | --- |
| Mood | focused utility | album-led, immersive | calm, data-first |
| Themes | light, dark, system | dark only | light, dark, system |
| Colour | user's accent | taken from album artwork | user's accent, used sparingly |
| Type | Inter | Young Serif + Hanken Grotesk | Schibsted Grotesk |
| Navigation | header links | bottom tab bar | bottom tab bar |
| Signature element | cards and tables | sleeve and vinyl | time rail and hourly chart |

Timeline is the closest of the three to Classic, so it's the cheaper skin to build. Most of its screens are restyled Classic components; only the navigation and the Today rail need new slot components.

## Design tokens

The mockups are drawn in the light theme, with Blue Monday-like `#2A5BFF` standing in for the accent. In code the accent is always the user's choice, `--color-primary`. The dark values below are proposed and not yet in the mockups; check them in the first phase.

| Contract token | Light | Dark | Notes |
| --- | --- | --- | --- |
| `--color-canvas` | `#F2F4F5` | `#0E1A24` | page background |
| `--color-surface` | `#FFFFFF` | `#16242F` | cards, tab bar, search |
| `--color-ink` | `#0E1A24` | `#E8EDF0` | 16:1 and 15:1 on canvas |
| `--color-muted` | `#55626D` | `#9AA9B5` | 5.7:1 and 7.3:1 on canvas |
| `--color-border` | `#DDE3E7` | `#2A3A47` | card outlines, segmented track |
| `--color-border-subtle` | `#EDF0F2` | `#1E2D39` | row dividers inside cards |
| `--tl-rail` | `#CBD3D9` | `#3A4B58` | timeline line and empty-hour bars (decorative) |
| `--tl-tile` | `#DDE3E7` | `#22323E` | initials tile when there's no artwork, with text `#3C4953` / `#C5D0D8` |
| `--color-danger` | `#B3261E` | `#F2B8B5` | unread badge, liked heart |
| `--font-display` / `--font-body` | Schibsted Grotesk | same | weights 400, 500, 600, 700 |

**Accent rules.** The user's accent is a marker colour in Timeline, not a text colour. It colours the current-hour bar, YouTube diamonds, the active tab bar and the primary button fill. Two consequences follow:
- Links and "See all" are ink with an underline, never accent-coloured text. Even Blue Monday is only 4.4:1 on the light canvas.
- Markers need 3:1 against the canvas, and two accents fall short: Fool's Gold is 2.9:1 on light, and Paint It Black is 2.3:1 on dark. Define `--tl-mark` as the accent, and override it for those cases with `color-mix(in srgb, var(--color-primary) 80%, #000)` on light and `color-mix(in srgb, var(--color-primary) 60%, #fff)` on dark. Let the contrast matrix test confirm the result.

**Type and spacing.** Use Schibsted Grotesk throughout:
- **Page title:** 30 px / 600 with −0.03em tracking.
- **Row title:** 16 px / 600.
- **Secondary text:** 14 to 15 px / 400 in muted.
- **Meta and labels:** 12 to 13 px.
- **Numbers:** tabular figures everywhere.

The page gutter is 16 px, the header 56 px, and the tab bar 72 px plus the safe-area inset. Cards have a 12 px radius, tiles 6 px, and inputs and segmented controls 8 to 10 px. Tap targets are at least 44 px.

## Shared components

Only two of these need slot components: `appNav` (header and tab bar) and `todayHero` (the hourly chart and rail). Everything else is Classic components restyled under `[data-skin="timeline"]`.

| Component | Spec |
| --- | --- |
| Header | 56 px on canvas. "Scrobbler" in Schibsted 17 px / 700 on the left. On the right, a muted bell with a red unread badge, then a 32 px round avatar on `--tl-tile` linking to Profile. |
| Bottom tab bar (`appNav` slot) | Surface background with a 1 px top border. Five equal tabs: Today, Library, Play, Reports, Gigs. Each tab is a 22 px icon over a 12 px label. The active tab is ink at 700 weight with a 3 px `--tl-mark` bar along its bottom edge (`inset 0 -3px 0`, a border, not a shadow) and `aria-current="page"`. Inactive tabs are muted. |
| Sub-page header | Back chevron (44 px) with an accessible "Back to …" label, then the page title. The tab bar stays, with no tab active. |
| Hourly chart (part of `todayHero`) | One bar per hour from midnight to now, 44 px tall, 3 px gaps, 2 px radius. Bars are ink, the current hour is `--tl-mark`, and empty hours are 3 px `--tl-rail` stubs. Axis labels 12am, 6am, 12pm and Now in 12 px muted. Below it, a legend of the source marker shapes. Give the chart `role="img"` and an `aria-label` naming the busiest hours. |
| Time rail (part of `todayHero`) | Three columns: the time (40 px, right-aligned, 12 px muted, "5:32 pm"), the rail (16 px, a 2 px `--tl-rail` line), then the track. Each play gets a 14 px source marker on the rail with a 2 px canvas-coloured ring. Any gap of 60 minutes or more becomes a dashed rail stretch labelled "4 h quiet". |
| Source markers | The shape carries the meaning and colour is a bonus: Spotify is a filled ink circle and YouTube a `--tl-mark` diamond. Apple and BBC need shapes too (see Open decisions). Every marker also has a text label for screen readers. |
| Track row | Title 16 px / 600, artist 14 px muted, and a 44 px tile on the right: artwork through `Artwork.jsx`, or initials on `--tl-tile`. In lists, rows sit in a surface card with a 1 px border and a 12 px radius, divided by `--color-border-subtle`, with a 44 px heart button. |
| Segmented control | A `--color-border` track with a 10 px radius and 3 px padding. The selected segment is surface-coloured with a 1 px outline and 600 weight. Used for Library sections, Listening / Gigs, Forgotten / On this day, and Light / Dark / System. |
| Filter chips | 36 px pills. Selected chips are filled ink with canvas text; unselected chips have a 1 px muted outline. |
| Buttons | Primary: `--color-primary` fill with `--color-on-accent` text, 8 px radius, 48 to 56 px tall. Secondary: 1 px ink outline. Sentence case (`text-transform: none`). |
| Focus | 2 px `--color-focus` outline with a 2 px offset. |

## Screen by screen

The routes are the same as Classic, plus `/play` (shared with Sleeve; see the framework). Figures in the mockups are sample data.

| Tab / route | Timeline layout | Reuse |
| --- | --- | --- |
| Today, `/` | The date as the title ("Friday 6 November"), then "38 plays so far, 2 h 14 m of listening". Below that, the hourly chart with its legend, then the time rail of today's plays with quiet gaps. | `todayHero` slot; data from `OverviewPage.jsx`. Count per-hour plays client-side from today's scrobbles. |
| Library, `/library` | Title, a search field, a Scrobbles / Artists / Albums / Tracks segmented control, and All / Spotify / YouTube source chips. Then a day header ("Today · 14 plays") over a card of track rows with hearts. | `LibraryPage.jsx`, `LibraryScrobbleList`, `LibraryRankList`, `LikedHeart`, `LibraryViewToggle` |
| Play, `/play` | Title with "An album from your own history, start to finish." Filter chips (All time, This year, Unplayed, 1001 Albums). A card with the album tile, title, artist and "1991, 9 tracks. Last heard 14 months ago." Buttons: Spin again (primary), Open in Spotify and I listened to this (secondary). Then a Time Capsule card with a Forgotten / On this day segmented control. | `JukeboxCard`, `FlatJukebox`, `JukeboxFilters`, `RediscoverCard` |
| Reports, `/reports` | Title with the date range, Listening / Gigs segmented control, and period chips 7D to All. Three stat cards: Scrobbles 4,218 with "+12.4% on last 90 days", listening time and plays per day. Then a plays-per-day chart and a top artists list with counts. | `ReportsPage.jsx`, `ChartsPanel`, `TimelineChart`, `GigReportsSection` |
| Gigs, `/setlists` | Title, "24 shows, 19 artists, 9 venues" and a Log a gig button. Timeline / Artists / Venues / Songs segmented control, then rows with a stacked date block (OCT / 16 / 2026), the artist and the venue with its city. | setlists components |
| Gig detail, `/gigs/:concertId` | Sub-page header. The date, the artist as title, and the venue with city and country. Then the support acts, avatars with "Went with Sam and Jo", and the setlist card with play counts ("Not yet" for zero) and "You've played 6 of 8 songs". | `SetlistGigPage` |
| Profile, `/profile` | Avatar, name, handle line and three stat cards. A public-profile switch, then menu rows: Following, Connect sources, Settings, What's new, Sign out. | `ProfilePage.jsx` |
| Following, `/following` | Sub-page header, Following / Followers segmented control, a Compare listening button and people rows. | `FollowingPage.jsx`, `FollowButton` |
| Connect, `/connect` | Sub-page header. Cards for Spotify (connected, Check now, Disconnect), YouTube history (file import result, Choose a history file) and BBC Sounds (Connect). | `HomePage.jsx`, `ImportSummaryPanel`, `YouTubeScrobblerTools` |
| Settings, `/settings` | Sub-page header. Appearance: the Skin picker, Light / Dark / System, and accent swatches with each name explained ("Blue Monday, named after the New Order song"). Then notifications and Export everything, with existing sections below. | `SettingsPage.jsx` |
| What's new, `/changelog` | Sub-page reached from Profile. | `ChangelogPage.jsx` |

The first-run screen in the mockups (three benefit lines and Connect / Import buttons) is optional, the same as for Sleeve.

## Delivery plan

The skins framework must be merged first. After that, each phase is one PR, and Timeline stays `hidden` (reachable with `?skin=timeline`) until phase 7.

1. **Tokens.** Register `timeline`, add `skins/timeline/timeline.css` with light and dark contract values, `--tl-*` tokens, the accent marker overrides and self-hosted Schibsted Grotesk. Restyle nothing yet. The contrast matrix must pass for both themes and all eight accents.
2. **Navigation.** Add the `appNav` slot with the header and bottom tab bar, and the sub-page header.
3. **Today.** Add the `todayHero` slot with the hourly chart, the time rail, source markers and quiet gaps.
4. **Library and Play.**
5. **Reports, Gigs and Gig detail.**
6. **Profile, Following, Connect, Settings and What's new.**
7. **Preview.** Set the status to `preview` so the owner can choose Timeline in Settings, add CI snapshot baselines for light and dark, and fix what a week of daily use turns up. Then set it to `live`.

## Checks specific to Timeline

The framework's per-PR checklist applies to every PR. Timeline adds these:
- [ ] Today shows the right hours for the user's own time zone, including after midnight and across a clock change.
- [ ] Quiet gaps appear only at 60 minutes or more, and a day with one play, or none, still looks deliberate. With no plays, show an empty rail with "Nothing yet today".
- [ ] Heavy days (100+ plays) stay usable: the rail virtualises or paginates, and the chart scales to its busiest hour.
- [ ] Source markers are clear to someone who can't see the colour: check in greyscale and with a colour-blindness simulator.
- [ ] Links and "See all" are ink, never accent-coloured text.
- [ ] Dark theme is checked on every phase, not left to the end.
- [ ] Long titles and artist names truncate with an ellipsis and never push the time or the heart button off screen.

## Open decisions

- [ ] **Shapes for Apple Music and BBC Sounds markers** (phase 3). The app tracks four sources, but the mockups show two. A suggestion: a square for Apple and a triangle for BBC, both in ink.
- [ ] **Dark theme values** (phase 1). The dark palette here is proposed but hasn't been mocked up. Approve it from the phase 1 screenshots.
- [ ] **Desktop layout** (phase 7). The mockups are phone-only. The simplest option is a centred 560 px column with the tab bar kept at the bottom. Alternatively, move the tabs into the header above 1024 px.
- [ ] **Can Timeline and Sleeve share `/play`?** (phase 4) Yes, if both use the same jukebox data and differ only in styling. Agree this once, in the framework.
