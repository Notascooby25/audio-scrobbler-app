# Phase 2 Implementation Prompts

Copy-paste ready prompts, structured as Impeccable commands. Reference PHASE_2_REFINEMENT_BRIEF.md for full rationale and CSS.

---

## Prompt 1: Layout – Enlarge Album/Artist Grid Covers

**Command:** `impeccable layout grid-covers`

```
Refinement: Make Library grid-mode covers (Albums, Artists, Tracks) edge-to-edge and
larger, matching a Last.fm-style mobile grid (reference: user-supplied screenshot).

Current state:
- Artwork sits inside ~16px card padding, occupying ~55-60% of card
- Checkbox overlay above every image in grid mode
- Scrobble count is a separate gray pill with a three-dot menu per card

Target state:
- Artwork is full-bleed within the card: no padding, 1:1 aspect ratio, object-fit cover,
  clipped to the card's top corners (12px radius)
- Text block below artwork: rank + title (14px/500), artist (12px/#888888),
  scrobble count with small icon (12px/#888888)
- Thin relative-proportion bar under the count: width = (item count / max count in
  current list) * 100%, using primary blue (#0066FF) fill on a light gray track (#F0F0F0)
- Remove checkbox and three-dot menu from grid mode entirely
- Add a "Select" toggle in the toolbar (next to List/Grid buttons); when active,
  checkboxes appear as a top-left overlay badge with a scrim for contrast
- Keep three-dot menu available in List mode only

Grid columns: 2 (mobile <600px), 3 (tablet 600-1024px), 4 (desktop >1024px), 12px gaps

Acceptance:
✓ Artwork fills full card width with no visible padding around it
✓ No checkbox or three-dot menu visible in default Grid mode
✓ Relative bar renders correctly and scales with data (test with #1 vs #50 item)
✓ Card still has 0.5px #E5E5E5 border (per DESIGN.md — border, not shadow)
✓ Mobile (375px), tablet, and desktop breakpoints all look correct
✓ "Select" mode toggle successfully brings back checkboxes on demand
```

---

## Prompt 2: Feature – Source Attribution Badges

**Command:** `impeccable delight source-badges`

*(Using `delight` since this adds a small but meaningful piece of personality/clarity that reinforces the product's core value prop — "unified scrobbles from multiple sources" — not just a bug fix.)*

```
Refinement: Add a visual source badge (Spotify / YouTube Music) to every scrobble,
track, album, and artist item across Library grid and list views.

Rationale: PRODUCT.md's core pitch is consolidating scrobbles from Spotify and YouTube
into one timeline. Currently nothing in the UI shows users where their data came from —
a missed opportunity to demonstrate the product's actual value.

Data requirement:
- Each scrobble already has (or needs) a `source: 'spotify' | 'youtube' | 'import'` field
- For aggregate rows (artist/album/track), compute the distinct set of sources
  contributing to that item's scrobble count

Target state:
- Grid cards: 20px circular badge, bottom-right corner of artwork, white 2px ring,
  0.5px hairline outline (#E5E5E5) for definition — NOT a drop shadow
- List rows: 14-16px icon inline near the subtitle or as a trailing element before
  the scrobble count
- Multi-source items (scrobbled via both Spotify and YouTube): show a combined/split
  icon treatment rather than arbitrarily picking one source
- Use each platform's OFFICIAL icon-only brand mark (not wordmark), unmodified color,
  respecting their minimum clear-space guidelines — pull from Spotify's and YouTube's
  published brand asset kits, don't recreate freehand

Placement CSS:
.source-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #FFFFFF;
  border: 2px solid #FFFFFF;
  box-shadow: 0 0 0 0.5px #E5E5E5;
}

Acceptance:
✓ Every scrobble/track/album/artist item shows a source badge when source data exists
✓ Multi-source items show a distinct combined indicator, not a misleading single logo
✓ Badges never obscure title/artist text
✓ Badge remains legible against light and dark album artwork (white ring test)
✓ No items show a badge with unknown/missing source (fall back gracefully — e.g. no
  badge, or a neutral "imported" icon — rather than guessing)
✓ Icons match official brand colors, undistorted, correct aspect ratio
```

---

## Prompt 3: Clarify – Custom Date Range Formatting

**Command:** `impeccable clarify date-range-inputs`

```
Refinement: Fix custom date range inputs to match app typography and eliminate
confusing default/empty states.

Current state:
- Native <input type="date"> renders inconsistent browser chrome
- Defaults to a jarring 01/10/1912 on Library/Reports custom range
- Renders as broken-looking dashes (---------- ----) when empty on Connect page
- Format doesn't match the rest of the app's date style (e.g. "29 Aug 2025")

Target state (recommended — single range pill):
- Replace the two separate Start Date / End Date fields with one range control:
  a pill button showing "29 Aug 2025 → 14 Sep 2026" with a small calendar icon
- Tapping opens a calendar popover for selecting both endpoints in one interaction
- Formatted using the app's existing date style (d MMM yyyy) via date-fns or equivalent
- Sensible defaults: start = earliest scrobble on record (never 1912), end = today
- Empty/unset state (Connect page From/To) shows placeholder text "Any date" instead
  of native dash rendering

If a single pill is out of scope for this pass, minimum acceptable fallback:
- Keep two fields but restyle them to match .form-input styling (8px/12px padding,
  0.5px #E5E5E5 border, 8px radius, 14px Inter text)
- Format displayed value as "29 Aug 2025" via JS, using a custom calendar dropdown
  instead of native browser date picker chrome
- Fix the default value bug — confirm no field ever shows 1912 or an epoch fallback

Acceptance:
✓ No date field ever displays 01/10/1912 or similar bogus default
✓ Empty states show "Any date" or equivalent, never native dashes
✓ Displayed date format matches rest of app (d MMM yyyy)
✓ Works consistently across Chrome/Firefox/Safari (no native picker inconsistency)
✓ Mobile: range control fits on one line or wraps cleanly, no horizontal overflow
```

---

## Prompt 4: Layout – Settings Categorized Tabs

**Command:** `impeccable layout settings-tabs`

```
Refinement: Split the single long-scrolling Settings page into categorized tabs,
reusing the existing segmented-tab component already used in Library.

Current state:
- One continuous vertical form: date range default, page size, 6 view-mode dropdowns,
  backfill artwork action, and destructive delete-scrobbles controls all in one scroll
- Destructive "Delete Scrobbles" section has the same visual weight/proximity as
  harmless cosmetic preferences

Target state — 4 tabs:
1. General — Default date range, Default page size
2. Views — Library/Scrobbles/Artists/Albums/Tracks/Liked Tracks view-mode dropdowns
   (grouped together since they're the same setting type, repeated 6x)
3. Data — Backfill missing artwork (safe, non-destructive maintenance actions)
4. Danger Zone — Delete Scrobbles (by source / date range / import batch), kept
   visually and navigationally separate from everything else

Use the SAME segmented-tab pattern/component already implemented for Library's
Scrobbles/Artists/Albums/Tracks/Liked Tracks tabs — this is not a new UI pattern,
it's reuse per DESIGN.md's existing "Do use segmented tabs for view switching" rule.

Danger Zone tab gets a destructive color treatment so it reads as different before
the user even taps into it:
.settings-tab.destructive { color: #dc2626; }
.settings-tab.destructive.active { background: #dc2626; color: #FFFFFF; }

Keep the existing yellow warning banner at the top of the Danger Zone tab's content.

Mobile: tab bar scrolls horizontally if all 4 labels don't fit — same responsive
behavior the Library tab bar already needs at narrow widths, no new pattern required.

Acceptance:
✓ Settings page requires zero or minimal scrolling per tab on mobile (375px)
✓ All 4 tabs implemented, each showing only its relevant fields
✓ Danger Zone visually distinct (red accent) from General/Views/Data
✓ Existing warning banner and delete controls preserved, just relocated
✓ Tab switching preserves any in-progress form state (don't lose unsaved changes
  when switching tabs, if settings aren't auto-saved per field)
✓ Reuses existing segmented-tab component/styles — no new tab visual pattern introduced
```

---

## Execution Order

1. **Prompt 4 (Settings tabs)** — self-contained, no dependency on other changes, immediately reduces the most-complained-about pain point (scrolling)
2. **Prompt 3 (Date range)** — also self-contained; fixes a visible bug (1912 default) alongside the formatting polish
3. **Prompt 1 (Grid covers)** — larger visual change, do this once Settings/date work is merged to avoid conflicting in-flight branches on shared components (date fields might appear inside Library filters too)
4. **Prompt 2 (Source badges)** — do last since it depends on confirming the `source` field is actually available/reliable in the data layer; also lowest urgency of the four

---

## Testing Checklist (all four combined)

**Desktop (1440px):**
- [ ] Settings: 4 tabs visible, switching works, Danger Zone is visually distinct
- [ ] Date range: single pill or restyled fields, correct format, no 1912 bug
- [ ] Grid: covers edge-to-edge, rank/title/artist/count/bar all present, no checkbox/menu clutter
- [ ] Source badges: visible on grid cards and list rows, correct icon per source

**Mobile (375px):**
- [ ] Settings: each tab fits without excessive scroll
- [ ] Date range: fits without horizontal overflow
- [ ] Grid: 2-column layout, covers large and legible (compare directly against reference screenshot)
- [ ] Source badges: legible at small size, doesn't obscure text

**Data edge cases:**
- [ ] Item with zero scrobbles in current range (relative bar shouldn't break/divide-by-zero)
- [ ] Item with scrobbles from both Spotify and YouTube (multi-source badge, not a wrong single-source guess)
- [ ] Item with unknown/missing source (graceful fallback, no broken icon)
- [ ] Date range with no data in window (empty state messaging, not a blank confusing screen)
