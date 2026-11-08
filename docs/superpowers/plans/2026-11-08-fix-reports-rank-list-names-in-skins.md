# Implementation Plan: Restore Artist, Album, and Track Info in Reports Category Grids for Timeline and Sleeve Skins

**Goal:** Restore visible artist, album, and track text on the Reports page category grids ("Artists scrobbled", "Albums scrobbled", "Tracks scrobbled") in both the Timeline and Sleeve skins.

---

## 1. Root Cause Analysis
In `frontend/src/styles.css`, `.report-category-grid .library-rank-row` is styled as a 2-row CSS Grid layout:
```css
.report-category-grid .library-rank-row {
  display: grid;
  grid-template-areas: "media copy" "media actions";
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 8px;
  row-gap: 4px;
}
.report-category-grid .library-rank-actions {
  grid-area: actions;
  width: 100%;
}
```
However, both `timeline.css` and `sleeve.css` declared broad selectors:
```css
[data-skin="timeline"] .library-rank-row {
  display: flex !important;
  ...
}
[data-skin="sleeve"] .library-rank-row {
  display: flex !important;
  ...
}
```
Because `display: flex !important` overrode the parent `.report-category-grid` grid layout, the child `.library-rank-actions` with `width: 100%` occupied all remaining horizontal space on the single flex line. This collapsed `.library-row-copy` (which holds `<strong>` and `<small>`) to `0px` width, causing all artist, album, and track text to vanish on the Reports page in both skins.

Furthermore, on mobile viewports (`<= 640px`), the underline progress bar rules in `timeline.css` and `sleeve.css` targeted `.library-rank-row`:
```css
.library-rank-row .library-bar-track {
  width: auto !important;
}
```
In the 2-row grid of `.report-category-grid`, the actions row contains `.library-bar-track`, which on mobile needs `width: 100%` and `display: flex` so the scrobble count bar aligns cleanly underneath the text copy without pushing the copy to 0 width.

---

## 2. Proposed Solution
1. In `frontend/src/skins/timeline/timeline.css`:
   - Add scoped rule:
     ```css
     [data-skin="timeline"] .report-category-grid .library-rank-row {
       display: grid !important;
       grid-template-areas: "media copy" "media actions" !important;
       grid-template-columns: auto minmax(0, 1fr) !important;
       column-gap: 8px !important;
       row-gap: 4px !important;
       align-items: center !important;
       height: auto !important;
       min-height: 52px !important;
       padding: 6px 4px !important;
     }

     [data-skin="timeline"] .report-category-grid .library-row-copy {
       min-width: 0 !important;
       display: flex !important;
       flex-direction: column !important;
       gap: 2px !important;
     }

     [data-skin="timeline"] .report-category-grid .library-row-copy strong {
       font-size: 13.5px !important;
       white-space: nowrap !important;
       overflow: hidden !important;
       text-overflow: ellipsis !important;
     }

     [data-skin="timeline"] .report-category-grid .library-row-copy small {
       font-size: 12px !important;
       white-space: nowrap !important;
       overflow: hidden !important;
       text-overflow: ellipsis !important;
     }

     [data-skin="timeline"] .report-category-grid .library-rank-actions {
       display: flex !important;
       align-items: center !important;
       justify-content: flex-start !important;
       width: 100% !important;
       margin-left: 0 !important;
       gap: 8px !important;
     }

     [data-skin="timeline"] .report-category-grid .library-bar-track {
       flex: 1 1 auto !important;
       max-width: 180px !important;
       width: 100% !important;
     }
     ```
2. In `frontend/src/skins/sleeve/sleeve.css`:
   - Add matching scoped rule under `[data-skin="sleeve"] .report-category-grid`:
     ```css
     [data-skin="sleeve"] .report-category-grid .library-rank-row {
       display: grid !important;
       grid-template-areas: "media copy" "media actions" !important;
       grid-template-columns: auto minmax(0, 1fr) !important;
       column-gap: 8px !important;
       row-gap: 4px !important;
       align-items: center !important;
       height: auto !important;
       min-height: 52px !important;
       padding: 6px 4px !important;
     }

     [data-skin="sleeve"] .report-category-grid .library-row-copy {
       min-width: 0 !important;
       display: flex !important;
       flex-direction: column !important;
       gap: 2px !important;
     }

     [data-skin="sleeve"] .report-category-grid .library-row-copy strong {
       font-size: 13.5px !important;
       white-space: nowrap !important;
       overflow: hidden !important;
       text-overflow: ellipsis !important;
     }

     [data-skin="sleeve"] .report-category-grid .library-row-copy small {
       font-size: 12px !important;
       white-space: nowrap !important;
       overflow: hidden !important;
       text-overflow: ellipsis !important;
     }

     [data-skin="sleeve"] .report-category-grid .library-rank-actions {
       display: flex !important;
       align-items: center !important;
       justify-content: flex-start !important;
       width: 100% !important;
       margin-left: 0 !important;
       gap: 8px !important;
     }
     ```
3. Update automated tests in `timeline.test.jsx` and `sleeve.test.jsx` asserting that:
   - Artists list displays artist names (`entry.label`).
   - Albums list displays album name (`entry.label`) and artist name (`entry.secondary`).
   - Tracks list displays track name (`entry.label`) and artist name (`entry.secondary`).
   - `.library-row-copy` is rendered with nonzero width and visible text in `.report-category-grid`.

---

## 3. Regression & Invariant Checks
- **Classic skin:** 100% untouched; uses base styles in `styles.css`.
- **Desktop viewports:** Restored to proper 2-row grid without clipping.
- **Mobile viewports:** Clean 2-row layout with artwork + text on top, scrobble bar beneath.
- **RetroJukebox:** Completely untouched.

---

## 4. Step-by-Step Implementation

### Step 1 - Add Scoped CSS Rules for `.report-category-grid` in `timeline.css` and `sleeve.css`
- Files:
  - `frontend/src/skins/timeline/timeline.css`
  - `frontend/src/skins/sleeve/sleeve.css`
- Tests: `npm run lint && npm test`
- Commit Message: `fix(skins): restore artist, album and track text in reports category grid for timeline and sleeve (Planner Step 1)`

### Step 2 - Add Automated Assertions in Unit Tests
- Files:
  - `frontend/src/skins/timeline/timeline.test.jsx`
  - `frontend/src/skins/sleeve/sleeve.test.jsx`
- Tests: `npm test`
- Commit Message: `test(skins): add assertions for reports category grid labels and secondary text (Planner Step 2)`

### Step 3 - Verification, Preview Screenshots & Release Bump
- Bump to `v0.38.4` in `package.json` and `changelogData.js`.
- Run differential review.
- Start preview, capture screenshots of `/reports` under Timeline and Sleeve on mobile and desktop.
- Commit Message: `chore(release): bump version to v0.38.4 with changelog entry`

---

## Confirm to proceed.
