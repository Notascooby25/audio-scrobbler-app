# FAQ gaps and Reports hints: design

Date: 2026-11-18. Size: a project (two linked pieces, one release, v0.50.5).

## Intent and the why
A friend was confused by the Reports page. The owner wants the site to explain
itself: fill the gaps in the FAQ, and put short hints right where people get
confused. The goal is clarity for new and non-technical users.

## Goals
1. Add about 8 new FAQ entries (see "FAQ work").
2. Add a small info (i) button on Reports widget titles that opens a short plain-English note.
3. Keep one source of wording so the hints and the FAQ cannot disagree.

## Non-goals
- No hints on individual bars, cells or map pins (widget titles only).
- No changes to the Retro Jukebox (protected component).
- Nothing for the unmerged Gig Discovery tab (feat/gig-discovery); its docs ship with that branch.
- No redesign of the FAQ page layout.

## Anti-goals (a failure even if it works)
- Hints that clutter the page for regular users, or add a visible line to every widget.
- An icon that only works on hover (the app is phone-first).
- Hint text that is jargon, or that contradicts the FAQ.
- Any shadow, gradient or off-palette colour (DESIGN.md: flat by default).

## Constraints
- Follow DESIGN.md and AGENTS.md: React 18 functional components, scoped CSS selectors,
  `text-transform: none` on any mixed-case button, tests call `cleanup()` in `afterEach`.
- Must work in all three skins (Classic, Sleeve, Timeline), light and dark.
- Reports widgets are not all shared components; check blast radius with `git grep` before touching any shared one.
- The icon must be a real `<button>` (keyboard, screen reader), at least 44px touch area, with a visible focus ring.
- User-facing change: changelog entry, version bump to 0.50.5, update UserGuideSection and FaqSection.

## Approaches considered
- **A. (i) button on each widget title opening a short note (chosen by owner, recommended).** Works on touch and keyboard, stays hidden until wanted. Cost: one shared component and about 17 lines of wording.
- B. One-line caption under every widget title. Always visible but adds clutter and height on phones.
- C. A single "How to read this page" panel at the top. Cheapest, but far from the point of confusion.

## FAQ work (content)
New entries, in priority order:
1. Importing listening history (Spotify Extended Streaming History, YouTube Music, bulk multi-file, Settings -> Data).
2. Reports: what the page shows, date ranges, Compare, Customise Widgets, streaks/peak day/persona, Discovery velocity and the ratios.
3. Recommending music to friends (share icon, Play page, clearing notifications).
4. Rough Trade Top 100 in the Jukebox (year and genre filters, played tracking).
5. Getting started: connecting Spotify, reconnect prompt, disconnecting.
6. The per-entry menu (Delete, Block, Clear Artwork).
7. What is on each page (Play, Library, Gigs, Reports, Profile, Following, Settings, Connect).
8. Offline and installing the app (Add to Home Screen, offline banner).
Also: fix the sign-out answer ("Home page" is stale; routes are /play and /connect), and verify the privacy answer ("only mutual followers") against the backend follow rules before touching it. If the claim is wrong, correct it and tell the owner.
Also covered if cheap: sharing a card or image (share dialog).

## The hints component (the how, decided)
- One shared component, `InfoHint`, rendering an outline (i) button beside a widget title and a small popover note.
- Opens on tap or click, closes on second tap, Escape, or outside click; focus returns to the button; `aria-expanded` and `aria-controls` set.
- Flat style: hairline border, no shadow, theme tokens only, text sized like body copy.
- Hint wording lives in one data file keyed by widget id. The FAQ Reports entry reuses the same sentences.
- Widgets get an icon only where the meaning is not obvious from the title (builder judges; owner reviews the list in the preview).

## Left to the builder
File names, popover positioning, which widgets are "obvious" enough to skip, exact wording (plain English, one to two sentences each, owner reviews on the preview).

## Release and risk
- One branch, one PR, one release (0.50.5). Visual change, so it waits for the owner's go-ahead after screenshots.
- Checks: lint, unit tests (including a test that every hinted widget renders its icon and the popover opens by keyboard), build, Page Check on /reports and /settings, E2E not needed unless routes change, differential review.
- Multi-surface test for any shared component touched.
