# Reports: Rough Trade card and "View all" pop-ups (short design)

**Date:** 2026-11-20
**Status:** Approved by the owner in conversation (approach A, pop-up list)
**Size:** small change, one release (v0.53.5)

## Intent
The Reports page has two cross-over cards: "1001 Albums Challenge" and "Live
Artist Connection". Each only ever shows 5 chips, because the backend throws the
rest away. The owner wants (1) the Rough Trade Top 100 progress on Reports too,
the three cards side by side, and (2) a way to see every item for the period.

## Goals
- New "Rough Trade Top 100" card mirroring the 1001 card: "X / 700 (Y%)",
  "N Completed This Period", first 5 chips as "Artist – Album", and a
  "Browse in Jukebox" link when nothing is completed.
- Each of the three cards shows a "View all N" button when it has more than 5
  items. It opens a scrollable pop-up listing every item for the selected range.
- Three columns on a PC, two then one on tablets, one on phones. Hiding a card in
  Customise makes the others stretch to fill the row.
- A Customise switch ("Rough Trade Top 100"), on by default, and an info hint.

## Non-goals
- No database change or migration. No change to how Rough Trade completions are
  recorded (they are still filled in when the Jukebox is opened, same as 1001).
- No changes to the Jukebox, the retro cabinet, or the checklist modals.
- No separate "view all" endpoint.

## Anti-goals
- A card that stretches its neighbours when opened (why a pop-up, not inline).
- Breaking an old cached frontend talking to the new backend: the existing
  `recent_albums` and `top_artists` fields keep their meaning (first 5).

## Approaches considered
- **A. Pop-up list (chosen):** button opens a dialog with the full list. Keeps the
  three cards a stable height. Matches the app's other dialogs (Esc closes).
- **B. Expand inside the card:** simpler, but unequal card heights in a row and
  long scrolls on phones. Rejected.

## Design
- **Backend** (`analytics_service.py`, `schemas/analytics.py`): `Challenge1001Entry`
  gains `all_albums: list[str]`; `recent_albums` stays the first 5. New
  `ChallengeRoughTradeEntry` (same shape) and `ReportSummaryResponse.challenge_rough_trade`.
  `LiveArtistsEntry` gains `all_artists: list[LiveArtistItem]`; `top_artists` stays
  the top 5. Completed albums are ordered most recently completed first (today the
  1001 choice of five is arbitrary). Labels are "Artist – Album".
- **Frontend:** one shared pop-up component `ReportViewAllModal`; the three card
  components each own an "is open" state. `ReportsPage` renders the new card behind
  `widgetPreferences.showRoughTrade`.
- **Layout:** `.report-crossover-grid` becomes `repeat(auto-fit, minmax(300px, 1fr))`.
  The only user of this grid is the Reports page; only the Timeline skin restyles the
  cards, and it does not touch the grid.

## Calls made by me (owner can correct)
- Chip format "Artist – Album" (agreed for 1001 in #102).
- Rough Trade total hard-coded as 700 in the card, like 1001's 1001.
- Pop-up lists live artists with their play counts, most-played first.

## Left to the builder
Exact pop-up CSS (flat, no shadows or gradients per DESIGN.md), button wording
beyond "View all N".
