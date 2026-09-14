# Phase 2 Refinement Brief: Audio Scrobbler App

**Scope:** Album grid sizing, source attribution, date range UX, Settings IA  
**Mode:** Operate (task completion, scanability, native expectations)  
**Reference:** User-supplied Last.fm-style mobile screenshot (large edge-to-edge covers)

---

## Issue 1: Album/Artist Grid Covers Too Small (Mobile)

### Current State
Looking at the current Albums grid (mobile, 2-column):
- Card has ~16px padding *around* the artwork, so the image floats inside a white frame
- A checkbox sits above every image, eating vertical space and adding visual clutter for a view mode that's primarily browsing, not bulk-selecting
- Scrobble count renders as a separate gray pill with a three-dot menu — two extra tap targets per card
- Net effect: artwork occupies roughly 55–60% of the card; a lot of chrome for a visual-first surface

### Target State (per your reference image)
- **Artwork is edge-to-edge** within the card — no padding on left/right/top, square (1:1) aspect ratio, corners match the card's top corners (12px)
- **Rank number** overlays the bottom-left of the image as a small numeral, not a separate row (or sits inline with title — see markup below)
- **Text block** (title, artist, scrobble count) is compact, directly below the image with 8–12px padding
- **Relative bar** — a thin progress/proportion bar at the very bottom of the card showing this item's scrobbles relative to the #1 item in the current list (nice touch from your reference, cheap to compute: `width: (count / maxCount) * 100%`)
- **No checkbox in grid mode.** Bulk-select is a List-view-only or "Select" mode toggled explicitly, not always-on in Grid
- **No three-dot menu in grid mode.** Keep it in List mode where row-level actions make more sense

### Fix Strategy

**Layout:**
```
┌─────────────────┐
│                  │
│   ARTWORK        │ ← full bleed, 1:1
│   (edge-to-edge) │
│                  │
├─────────────────┤
│ 1. In Motion     │ ← rank + title, 14px/500
│ The Snuts        │ ← artist, 12px, secondary
│ ★ 23 scrobbles   │ ← count with small icon
│ ▬▬▬▬▬▬▬░░░░░░░░  │ ← relative bar
└─────────────────┘
```

**CSS guidance:**
```css
.album-card {
  background: #FFFFFF;
  border: 0.5px solid #E5E5E5;
  border-radius: 12px;
  overflow: hidden; /* clips artwork to rounded top corners */
  padding: 0; /* remove card padding — text block gets its own */
}

.album-card-artwork {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}

.album-card-body {
  padding: 10px 12px 12px;
}

.album-card-title {
  font-size: 14px;
  font-weight: 500;
  color: #111111;
  line-height: 1.3;
  display: flex;
  gap: 4px;
}

.album-card-artist {
  font-size: 12px;
  color: #888888;
  margin-top: 2px;
}

.album-card-count {
  font-size: 12px;
  color: #888888;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.album-card-bar-track {
  height: 3px;
  background: #F0F0F0;
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.album-card-bar-fill {
  height: 100%;
  background: #0066FF;
  border-radius: 2px;
  /* width set inline per-card: (count / maxCount) * 100% */
}
```

**Grid columns by breakpoint:**
- Mobile (<600px): 2 columns, 12px gap
- Tablet (600–1024px): 3 columns
- Desktop (>1024px): 4 columns

**Where checkbox/menu go instead:**
- Add a "Select" toggle button in the toolbar (next to List/Grid toggle). When active, checkboxes appear on grid cards as a top-left overlay badge with a semi-transparent scrim behind it for contrast against any artwork color.
- Three-dot menu stays available in **List mode** only, where there's already a dedicated row for it.

---

## Issue 2: No Source Attribution (Spotify / YouTube Music)

### Current State
Scrobbles, tracks, albums, and artists show no indication of which service they came from. Since the whole product pitch is *"consolidates scrobbles from Spotify and YouTube into one unified timeline"* (per PRODUCT.md), this is actually a missed opportunity to demonstrate the core value prop — users can't tell what's merged from where.

### Target State
- Each scrobble/track/album/artist row or card carries a small **source badge**: Spotify's icon (brand green, official logomark) or YouTube Music's icon (brand red)
- If an album/artist/track has scrobbles from **multiple sources**, show a small stacked/combined indicator (e.g. two tiny dots or a "multi-source" icon) rather than picking one arbitrarily
- Badge placement:
  - **Grid cards:** small circular badge (18–20px), bottom-right corner of the artwork, white ring (2px solid #FFFFFF) for contrast against any image
  - **List rows:** small icon (14–16px) inline before or after the title/subtitle, or as a leading icon in place of nothing currently there

### Fix Strategy

**Data requirement:** each scrobble needs a `source: 'spotify' | 'youtube' | 'import'` field (this likely already exists given the ingestion architecture — Spotify polling + YouTube JSON import — it just isn't surfaced in the UI yet). For aggregate rows (artist/album/track), compute the **set of distinct sources** contributing scrobbles.

**Brand guideline note:** Use each platform's official simplified mark (not the full wordmark) at minimum clear-space. Do not recolor, rotate, or apply effects to the logos — display them at native brand colors on a neutral background (white ring satisfies this).

**Markup/CSS guidance:**
```css
.source-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #FFFFFF;
  border: 2px solid #FFFFFF;
  box-shadow: 0 0 0 0.5px #E5E5E5; /* hairline definition, not a drop shadow */
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.source-badge svg {
  width: 14px;
  height: 14px;
}

/* multi-source variant */
.source-badge.multi {
  display: flex;
}
.source-badge.multi svg {
  width: 9px;
  height: 9px;
}
```

**List row variant:**
```css
.library-row-source-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.85;
}
```
Place it directly after the subtitle text, e.g. `Courteeners · 🟢` or as a small icon column at the row's far right before the count.

**Where to source icons:** Spotify and YouTube Music both publish brand asset kits (Spotify Design guidelines, YouTube brand resources) — pull the SVG icon-only marks from there rather than recreating them freehand, to stay accurate and stay within their usage guidelines (minimum size, clear space, no distortion).

---

## Issue 3: Custom Date Range Inputs Are Confusing

### Current State
- Native `<input type="date">` renders browser-default formatting, which is inconsistent across OS/browser and currently shows a jarring default of **01/10/1912** — almost certainly an unset/epoch-adjacent fallback rather than an intentional default
- On the Connect page, the same inputs render as empty dashes (`---------- ----`), which looks broken rather than empty
- The rest of the app formats dates as `29 Aug 2025`, `11 Aug 2024` — the date inputs don't match this style at all, breaking typographic consistency

### Target State
- Replace native date inputs with **app-styled date fields** that match the established date format (`D MMM YYYY`)
- Sensible defaults: **Start date** = earliest scrobble on record (or a reasonable bound like account creation date), **End date** = today. Never default to 1912.
- Empty/unset state (Connect page "From"/"To") should show a clear placeholder like `Any date` rather than dashes
- Consider consolidating Start/End into a **single range control**: a pill button reading `29 Aug 2025 – 14 Sep 2026` with a calendar icon, opening a popover calendar on tap — fewer fields, less scrolling, matches "Custom range" being a single filter concept rather than two disconnected inputs

### Fix Strategy

**Option A — Minimal fix (keep two fields, restyle):**
```css
.date-field {
  padding: 8px 12px;
  height: 36px;
  border: 0.5px solid #E5E5E5;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  color: #111111;
  background: #FFFFFF;
}
```
Format the *displayed* value in JS (e.g. `date-fns format(date, 'd MMM yyyy')`) and use a custom calendar dropdown rather than relying on the browser's native picker chrome, so formatting is consistent across all browsers/OSes.

**Option B — Recommended: single range pill**
```
┌────────────────────────────────────┐
│ 📅  29 Aug 2025  →  14 Sep 2026     │
└────────────────────────────────────┘
```
Tapping opens a calendar popover with two selectable endpoints (standard range-picker pattern). This:
- Cuts the Custom Range UI from 2 fields + labels down to 1 control
- Matches date formatting used everywhere else in the app
- Reduces mobile vertical space significantly (relevant to Issue 4's "reduce scrolling" goal too)

**Defaults logic:**
```js
// Instead of hardcoded/epoch fallback:
const defaultStart = earliestScrobbleDate ?? subYears(new Date(), 1);
const defaultEnd = new Date(); // today
```

**Empty state copy (Connect page):**
Replace native empty date rendering with a styled placeholder:
```jsx
<button className="date-field date-field--empty">
  {value ? format(value, 'd MMM yyyy') : 'Any date'}
</button>
```

---

## Issue 4: Settings Page Needs Categorized Tabs

### Current State
Settings is a single long vertical form mixing:
- Display defaults (date range, page size)
- Per-view preferences (5 separate view-mode dropdowns: Library, Scrobbles, Artists, Albums, Tracks, Liked Tracks)
- Data maintenance (backfill artwork)
- Destructive actions (delete scrobbles — by source / date range / import batch)

On mobile this is a long scroll with no visual grouping, and it buries a **destructive, irreversible action** (Delete Scrobbles) at the same visual weight as a cosmetic preference like "Albums view: Grid."

### Target State
Group into tabs using the **same segmented-tab pattern already established** for Library (Scrobbles/Artists/Albums/Tracks/Liked Tracks) — this is a DESIGN.md-sanctioned pattern already ("Do use segmented tabs for view switching"), so it's a natural extension, not a new pattern.

**Proposed categories:**

1. **General** — Default date range, default page size
2. **Views** — Library/Scrobbles/Artists/Albums/Tracks/Liked Tracks view-mode dropdowns (the 6 list-vs-grid preferences), grouped together since they're all the same type of setting
3. **Data** — Backfill missing artwork (safe, non-destructive)
4. **Danger Zone** — Delete Scrobbles (by source / date range / import batch) — visually separated, kept on its own tab so it's never one scroll-past-accident away from a harmless toggle

### Fix Strategy

**Tab bar (reuses existing segmented-tab component):**
```
┌─────────┬───────┬──────┬─────────────┐
│ GENERAL │ VIEWS │ DATA │ DANGER ZONE │
└─────────┴───────┴──────┴─────────────┘
```

**Mobile:** tabs scroll horizontally if they don't fit (same behavior as Library's 5-tab bar already needs to handle on narrow viewports) — no new responsive pattern required.

**Danger Zone tab styling:**
- Tab label itself can use the existing destructive-red already present on the "Delete Scrobbles" button (`#dc2626`-ish red, matching the current warning box), so it's visually distinct *before* the user even taps into it
- Keep the existing yellow warning banner ("Deleting scrobbles removes them permanently...") at the top of that tab's content

**Code guidance:**
```jsx
const SETTINGS_TABS = [
  { id: 'general', label: 'General' },
  { id: 'views', label: 'Views' },
  { id: 'data', label: 'Data' },
  { id: 'danger', label: 'Danger Zone', variant: 'destructive' },
];

<nav className="settings-tabs">
  {SETTINGS_TABS.map(tab => (
    <button
      key={tab.id}
      className={cx('settings-tab', {
        active: activeTab === tab.id,
        destructive: tab.variant === 'destructive',
      })}
      onClick={() => setActiveTab(tab.id)}
    >
      {tab.label}
    </button>
  ))}
</nav>

<div className="settings-panel">
  {activeTab === 'general' && <GeneralSettings />}
  {activeTab === 'views' && <ViewSettings />}
  {activeTab === 'data' && <DataSettings />}
  {activeTab === 'danger' && <DangerZoneSettings />}
</div>
```

```css
.settings-tab.destructive {
  color: #dc2626;
}
.settings-tab.destructive.active {
  background-color: #dc2626;
  color: #FFFFFF;
}
```

**Result:** each tab's content fits on a single mobile screen (or close to it) instead of one continuous scroll — directly addresses "save loads of scrolling."

---

## Summary Table

| # | Issue | Fix | Effort |
|---|-------|-----|--------|
| 1 | Small album covers | Edge-to-edge artwork, remove grid-mode checkbox/menu, add rank + relative bar | Medium |
| 2 | No source attribution | Add source badge (Spotify/YouTube icon) to cards + rows, handle multi-source case | Medium |
| 3 | Messy date range | Restyle date fields to match app typography, fix broken defaults, consider single range-pill | Medium |
| 4 | Settings is one long scroll | Split into General / Views / Data / Danger Zone tabs, reuse existing tab component | Low–Medium |
