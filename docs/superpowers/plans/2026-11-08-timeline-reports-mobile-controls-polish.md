# Implementation Plan: Timeline Theme Mobile Reports Controls Polish (Option 2A)

**Goal:** Refine the Reports page controls and toolbar under the Timeline skin on mobile viewports (<= 640px) by styling the comparison buttons as compact, inline pill chips and neatly aligning "Browse library history →", eliminating wasted vertical space above listening stats.

**User Scope Selection:** Option 2A only (Action controls: inline compact pill chips and refined toolbar layout).

---

## 1. Impact Analysis
- **Target File:** `frontend/src/skins/timeline/timeline.css` (strictly scoped under `[data-skin="timeline"]` and `@media (max-width: 640px)`)
- **Components affected:** `.reports-toolbar`, `.reports-toolbar-actions`, `.compare-toggle-btn`, `.reports-library-link`
- **Protected Areas:** `RetroJukebox.jsx`, Classic skin, Sleeve skin, and desktop viewports remain 100% untouched.

---

## 2. Regression Checklist (§5 of Planner Agent)
- **API & Worker:** No changes.
- **Database & Migrations:** No changes.
- **Classic & Sleeve Skins:** Unaffected; all rules strictly scoped under `[data-skin="timeline"]`.
- **Accessibility & Touch Targets:** Comparison toggle buttons maintain a minimum 44px tap target height or touch footprint with clean visible focus rings.
- **Test Invariants:** Existing Vitest suite asserting token scoping (`[data-skin="timeline"]`), flat-by-default rules (zero gradients/shadows), and Reports page rendering will continue to pass.

---

## 3. Step-by-Step Implementation

### Step 1 - Add Scoped Mobile Styles for Reports Toolbar and Comparison Chips
- **Files:** `frontend/src/skins/timeline/timeline.css`
- **Changes:**
  - In `timeline.css` under the `@media (max-width: 640px)` section (or within `[data-skin="timeline"] .reports-toolbar`):
    - Set `.reports-toolbar` to have compact vertical margins (`margin-bottom: 14px !important`).
    - Configure `.reports-toolbar-actions` to display as an inline flex row with wrap (`flex-direction: row`, `flex-wrap: wrap`, `gap: 8px`).
    - Style `.compare-toggle-btn` to be compact chips (e.g. `min-height: 36px`, `padding: 0 12px`, `font-size: 12.5px`, `border-radius: 9999px` or `8px`), allowing "Compare previous period" and "Compare with Friends" to sit side-by-side or tightly wrap without consuming 100% width each.
    - Set `.reports-library-link` to align cleanly below or beside them without bloated margins.
- **Tests:**
  - `cd frontend && npm test -- src/skins/timeline/timeline.test.jsx`
  - `npm run lint`
- **Regression Risk:** Low - CSS-only adjustment strictly scoped to `[data-skin="timeline"]`.
- **Commit Message:** `fix(timeline): compact mobile reports toolbar and comparison pill chips (Planner Step 1)`

### Step 2 - Verification & Preview Check
- **Tests:** Run all frontend linters and unit tests (`npm run lint && npm test && npm run build`).
- **Visual Check:** Verify on preview server at 390px mobile viewport that toolbar buttons sit compactly without unnecessary vertical stacking.
- **Commit Message:** N/A (Verification step)

---

## Confirm to proceed.
