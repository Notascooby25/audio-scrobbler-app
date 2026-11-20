# Arcade view: look closer to the original jukebox mockup (short design)

**Date:** 2026-11-20
**Status:** Approved by the owner in conversation ("look only", no claw animation)
**Size:** small-to-medium change, one release (v0.53.6)

## Intent
The Jukebox has two looks: Flat and **Arcade** (`RetroJukebox.jsx`). The Arcade view
shipped as a simplified port and doesn't look like the owner's original mockup
(`jukebox-mockup.html`) or the product spec. The owner wants the Arcade view to look
much more like the mockup. Appearance only.

## Goals
- Cabinet: curved bulbs around the arch, mint-and-yellow double frame with layered
  border, "JUKEBOX" marquee, speaker grille at the foot (mockup colours and shapes).
- Purple stage with a **record rack** (up to 40 tiles, generated covers), a turntable
  with platter, spinning record, tone arm and a "now playing" label.
- Filter **lamps** (Artist, Year, Genre, and Length in Library mode) that light when
  that filter is on; tapping one scrolls to and focuses the Filters button.
- Boxed **record counter** ("N records", plus "· picking from X least played" when a
  Pick from mode narrows the pool) and a visible **Pick from** control (Library mode).
- Empty state ("No records match these filters" + Clear filters button).
- **Result card** with cover image, tag, title, artist, details, Re-roll and Open in
  Spotify in the mockup's style; the 1001 / Rough Trade "Mark Played" buttons stay.

## Non-goals
- No claw or record-moving animation (the existing 600 ms record spin stays).
- No change to pick logic, roll limits, props, the Flat view or other pages.
- No new filters (Mood, Label, Added are not in the app's data). No "Last picked" line
  (the app does not record it).
- No site-wide style changes; everything is scoped to the arcade view's own files.

## Anti-goals
- Pale text on the cream panels when a theme or skin overrides inherited colours (a
  past bug): all arcade text keeps explicit colours.
- A rack that lies: it must show the real number of matching records, not a fixed picture.
- Dozens of external image requests per filter change.

## Approaches considered
- **Port the mockup's look faithfully (chosen):** most pieces are missing, not slightly
  off, so a gradual restyle of the old markup would end up as the same rewrite.
- Restyle the old markup in place: rejected for the reason above.

## Design
- New pure helpers `retroCovers.js`: stable generated cover (hash of title + artist),
  initials, and `buildRackTiles` (up to 40 tiles from the matching records; the current
  pick is always included; leftover slots are dimmed empties; records outside the pick
  pool are half-dimmed).
- `RetroJukebox.jsx` becomes the cabinet; the result card moves to `RetroResultCard.jsx`.
- `JukeboxFilters.jsx` gets an optional `hideModeSelector` prop (default false) so the
  arcade view shows Pick from in the cabinet without duplicating it in the Filters drawer.
- `RetroJukebox.module.css` is rewritten from the mockup's CSS (values in the plan).

## Calls made by me (owner can correct)
- Rack tiles use generated covers like the mockup (artwork only on the result card),
  to avoid up to 40 image requests per filter change. Easy to change later.
- Counter text becomes "N records" (was "N records match filters").
- Lamps scroll to and focus the Filters button; they do not open the drawer.
- `RetroJukebox` now actually reads its `pool` prop (the old code named it `_pool` so
  the pool was never received).

## Left to the builder
Exact spacing at 320 px, bulb positions beyond the 13 in the mockup, wording of
accessible labels.
