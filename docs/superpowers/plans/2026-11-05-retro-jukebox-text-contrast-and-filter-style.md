# Implementation Plan: Classic (Retro) Jukebox Text Contrast and Filter Button Styling

**Date:** 2026-11-05  
**Author:** Antigravity  
**Goal:** Fix dark-mode text invisibility (album title rendered white-on-white) and align the filter button/drawer styling with the retro arcade cabinet aesthetic in the Classic (Retro) Jukebox view.

---

## 1. Problem Statement & Root Cause Analysis

### Issue 1: Missing / Invisible Album & Artist Text
- **Symptoms:** In the classic jukebox view, users see only `Yes (1972)` below the pick header, and the album title (`Close to The Edge`) appears to be missing or completely invisible.
- **Root Cause:**
  - `RetroJukebox.jsx` renders the pick inside `.card` (`styles.card`), which has a fixed light-cream background: `background: #fffdf8`.
  - The album title heading `<h3 style={{ margin: "4px 0 2px", fontSize: "16px", ... }}>` had no explicit `color` styling property.
  - In global CSS (`styles.css:362`), `h3` is styled with `color: var(--color-ink)`.
  - In dark mode, `--color-ink` is `#f7f7f7` (near-white).
  - This resulted in `#f7f7f7` text on `#fffdf8` background (contrast ratio: 1.04 : 1), making the album title completely invisible.
  - Below it, the artist line had `color: "#666"`, which rendered `Yes (1972)`. Because "Close to The Edge" was invisible, users perceived the album or artist as missing.
- **Solution:**
  - Explicitly assign `color: "#24212b"` (retro charcoal ink, 14:1 contrast ratio) to `<h3>` in `RetroJukebox.jsx`.
  - Style the artist line with `color: "#394651"` (retro slate border/text color, font weight 600) so both the album name and artist are unmistakably legible in both light and dark modes.

### Issue 2: Filter Button Style Mismatch in Classic Jukebox
- **Symptoms:** On the salmon/coral (`#ff9a83`) arcade cabinet, the filter toggle button renders as a modern, dark flat pill with a 1px border (`var(--color-border)` and `var(--color-surface)`), completely clashing with the arcade aesthetic.
- **Root Cause:**
  - `JukeboxFilters.jsx` was originally designed for the modern Flat Jukebox view and uses flat theme design tokens (`var(--color-surface)`, `var(--color-ink)`, `var(--color-border)`).
  - When embedded in `RetroJukebox.jsx`, it renders with dark slate container backgrounds and modern flat button styles.
- **Solution:**
  - Add `variant="retro"` support to `JukeboxFilters.jsx`.
  - When `variant === "retro"`:
    - **Filter Toggle Button:** Matches arcade buttons with `border: "2px solid #394651"`, `borderRadius: "6px"`, `fontWeight: 700`, `background: activeFilterCount > 0 ? "#3cc8b4" : "#fffdf8"`, `color: activeFilterCount > 0 ? "#FFFFFF" : "#24212b"`, and `boxShadow: "0 2px 0 #394651"`.
    - **Expanded Filter Drawer:** Styled to match the retro card with `background: "#fffdf8"`, `border: "2px solid #394651"`, `borderRadius: "10px"`, `boxShadow: "0 4px 0 #394651"`, and `#24212b` text.
    - **Filter Chips:** Styled with 2px `#394651` borders, `#fff` inactive backgrounds, and `#3cc8b4` active teal backgrounds with white text.
    - **Clear Filters Button:** Uses `#c94032` (arcade red) with font weight 700.
  - Keep `RetroJukebox.module.css` 100% untouched, adhering strictly to the repository's protected component invariant.

---

## 2. Impact Analysis

| Area | Impact | Description |
|---|:---:|---|
| `frontend/src/components/jukebox/RetroJukebox.jsx` | Medium | Explicitly set text colors for `h3` (`#24212b`) and artist paragraph (`#394651`), pass `variant="retro"` to `JukeboxFilters`. |
| `frontend/src/components/jukebox/JukeboxFilters.jsx` | Medium | Support `variant="retro"` styling for toggle button and expanded filter container while preserving default flat styling. |
| `frontend/src/components/jukebox/RetroJukebox.test.jsx` | Low | Add unit tests asserting explicit contrast text colors in `RetroJukebox`. |
| `frontend/src/components/jukebox/JukeboxFilters.test.jsx` | Low | Add unit tests asserting retro variant button and container styling. |
| `RetroJukebox.module.css` | None | **Untouched.** Preserves existing skeuomorphic rules without modification. |
| Backend & Database | None | Frontend-only styling and presentation change. |

---

## 3. Regression Checklist

- [x] **API Behavior:** No API routes or query parameters modified.
- [x] **Flat Jukebox Invariants:** Default `variant="flat"` in `JukeboxFilters.jsx` remains visually identical in the Flat Jukebox view.
- [x] **Protected Component Invariant:** `RetroJukebox.module.css` is not modified.
- [x] **Dark Mode & Light Mode Compatibility:** High-contrast retro tokens (`#24212b`, `#394651`, `#fffdf8`) are explicit inline CSS properties that do not inherit from root `--color-ink` or `--color-surface`.

---

## 4. Execution Steps

### Step 1 - Branch Creation
- Create and switch to working branch `fix/retro-jukebox-text-contrast-and-filter-style`.

### Step 2 - Fix Text Contrast in RetroJukebox
- **File:** `frontend/src/components/jukebox/RetroJukebox.jsx`
- **Changes:**
  - Add explicit `color: "#24212b"` and `fontWeight: 800` to the `<h3>` album title.
  - Set `color: "#394651"` and `fontWeight: 600` on the artist paragraph.
  - Set `color: "#24212b"` on the records count banner (`records match filters`).
  - Pass `variant="retro"` to `<JukeboxFilters />`.
- **Tests:** Add test in `frontend/src/components/jukebox/RetroJukebox.test.jsx` checking that the title element has style `color: rgb(36, 33, 43)` (`#24212b`).
- **Commit:** `fix(jukebox): fix album and artist text contrast in retro jukebox (Planner Step 2)`

### Step 3 - Support Retro Variant in JukeboxFilters
- **File:** `frontend/src/components/jukebox/JukeboxFilters.jsx`
- **Changes:**
  - Accept optional `variant = "flat"` prop.
  - Apply arcade styling (`2px solid #394651`, `#fffdf8` background, `0 2px 0 #394651` shadow) to the filter toggle button when `variant === "retro"`.
  - Apply matching retro card styling to the expanded drawer, filter chips, and labels when `variant === "retro"`.
  - Ensure standard flat view continues using CSS variables seamlessly.
- **Tests:** Add test in `frontend/src/components/jukebox/JukeboxFilters.test.jsx` verifying that `variant="retro"` renders the 2px arcade border and retro colors.
- **Commit:** `fix(jukebox): add retro styling variant for jukebox filters (Planner Step 3)`

### Step 4 - Full Verification & Security Review
- **Checks:**
  - `cd frontend && npm run lint`
  - `cd frontend && npm test`
  - `cd frontend && npm run build`
  - `ruff check backend/app worker scripts`
  - `.venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh`
  - Differential review report: `docs/security/2026-11-05-retro-jukebox-styling-review.md`.
- **Commit:** `test(jukebox): verify retro text contrast and filter styling (Planner Step 4)`

### Step 5 - Version Bump, Changelog & Hand-Over
- **Files:** `frontend/package.json` (bump to `0.31.3`), `frontend/src/changelogData.js`.
- **Commit:** `chore(release): bump version to 0.31.3 and update changelog (Planner Step 5)`
- **Open PR:** Open GitHub PR from `fix/retro-jukebox-text-contrast-and-filter-style` to `main`.
- **Hand-over:** Present preview instructions and test results for go-ahead.

---

## 5. Execution Approach Recommendation

I recommend **native execution** directly in the current session upon plan approval. This task involves targeted JSX styling and test assertions across 4 frontend files with immediate vitest feedback.

Confirm to proceed.
