# Jukebox Mobile Styling, Text Visibility & Artwork Fixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical mobile styling bugs across the Album Jukebox: unconstrained exploding album artwork in the checklist modal, aggressive album and artist text truncation (`"After T..."`), vertically split filter checkboxes, and dataset mojibake character encoding, while preserving the authentic Retro Jukebox arcade cabinet aesthetic.

**Architecture:** 
- Add strict `.jukebox-checklist-thumb` CSS rules in `frontend/src/styles.css` with 40×40px bounds, object-fit cover, and defensive wrapper overflow clipping.
- Switch album and artist metadata from rigid single-line `whiteSpace: nowrap` to responsive wrapped text (`whiteSpace: normal; wordBreak: break-word`) in both `FlatJukebox.jsx`, `RetroJukebox.jsx`, and `1001AlbumsChecklistModal.jsx`.
- Decouple the "Mark Played" button from crowding the album title into tiny horizontal widths on mobile.
- Force `flexDirection: "row"` on the Jukebox filter checkbox label to override leaking global CSS `flex-direction: column`.
- Sanitize the 13 mojibake UTF-8 entries in `backend/app/data/1001_albums.json` (e.g. `Björk`).
- Preserve `RetroJukebox.module.css` and its authentic skeuomorphic arcade cabinet aesthetic, wiring clean text wrapping and 1001 completion controls.

**Tech Stack:** React 18, CSS, Python 3.12, Vite, Vitest, Pytest.

---

## Global Constraints
- Exception / Protected Component: `RetroJukebox.module.css` is an intentionally skeuomorphic novelty arcade cabinet preserving original retro aesthetic; never modify or restyle it when performing site-wide theme or design system adjustments.
- Public repo safety: No secrets, hostnames, or credentials committed.
- Safe-change process: Build on a working branch (`fix/jukebox-styling-and-text`), run all linters/tests, differential security review, changelog/version bump (`v0.31.1`).
- Plain English explanations for non-developer owner.

## Review Focus
1. Mobile viewports (360px–390px): Album titles up to 60 characters (e.g. *"Sgt. Pepper's Lonely Hearts Club Band"*) must wrap cleanly and remain 100% visible without overflowing or ellipsis truncation.
2. Artwork loading: Full-resolution external covers (up to 640×640px) must stay strictly bounded to 40×40px with 4px border radius and never bleed over adjacent list rows.
3. Checkbox alignment: The "Exclude previously played albums" checkbox must render on the same horizontal line directly before its text label.
4. Retro Jukebox parity: In Arcade view, the 1001 mode must show decade/genres, allow marking played, and wrap titles cleanly without altering the retro pastels or shadow styling.
5. Character encoding: No mojibake characters (`Ã¶`, `\u00c3`) in the 1001 albums catalog.

---

### Task 1: Dataset Character Encoding Cleanup & Integrity Test
**Files:**
- Modify: `backend/app/data/1001_albums.json`
- Test: `backend/app/tests/test_catalog_1001_service.py`

**Interfaces:**
- Consumes: `backend/app/data/1001_albums.json`
- Produces: Clean UTF-8 artist and album names without double-encoded mojibake (`\u00c3`)

- [ ] **Step 1: Write test asserting zero mojibake in 1001 albums catalog**
Add a test in `backend/app/tests/test_catalog_1001_service.py` verifying that no artist or album names contain `\u00c3` or `Ã`, and specifically verifying that album #730 is `"Debut"` by `"Björk"`.
- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_catalog_1001_service.py -k test_zero_mojibake`
Expected: FAIL with `Bj\u00c3\u00aerk != Björk`.
- [ ] **Step 3: Fix the 13 mojibake records in `backend/app/data/1001_albums.json`**
Replace corrupted strings (`Bj\u00c3\u00aerk` -> `Björk`, `D\u00c3\u2021j\u00c3\u2013 Vu` -> `Déjà Vu`, `The K\u00c3\u00aeln Concert` -> `The Köln Concert`, `Risqu\u00c3\u2021` -> `Risqué`, `Mot\u00c3\u00aerhead` -> `Motörhead`, `Caf\u00c3\u2021 Bleu` -> `Café Bleu`, `Immigr\u00c3\u2021s` -> `Immigrés`, `H\u00c3\u2026sker D\u00c3\u2026` -> `Hüsker Dü`, `Ing\u00c3\u2021nue` -> `Ingénue`, `Ali Farka Tour\u00c3\u2021` -> `Ali Farka Touré`) and update Spotify search query URLs.
- [ ] **Step 4: Run test to verify it passes**
Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_catalog_1001_service.py -q`
Expected: PASS.
- [ ] **Step 5: Commit**
`git commit -m "fix(catalog): repair UTF-8 mojibake encoding in 1001 albums dataset"`

---

### Task 2: Fix Checklist Artwork Bounds & Album Text Wrapping
**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/components/jukebox/1001AlbumsChecklistModal.jsx`
- Test: `frontend/src/components/jukebox/1001AlbumsChecklistModal.test.jsx`

**Interfaces:**
- Consumes: `Artwork` component, `album.album_name`, `album.artist_name`
- Produces: Strictly bounded 40×40px thumbnails and wrapped full-visibility album text

- [ ] **Step 1: Write test for artwork class and text wrap styling**
In `1001AlbumsChecklistModal.test.jsx`, assert that checklist thumbnail containers have `overflow: hidden`, and album titles do not enforce `whiteSpace: nowrap`.
- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- 1001AlbumsChecklistModal.test.jsx`
- [ ] **Step 3: Add CSS for `.jukebox-checklist-thumb` in `styles.css` and update `1001AlbumsChecklistModal.jsx`**
  - In `frontend/src/styles.css`:
    ```css
    .jukebox-checklist-thumb {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
      display: block;
    }
    ```
  - In `1001AlbumsChecklistModal.jsx`:
    - Thumb wrapper: `overflow: "hidden"`, `borderRadius: "4px"`.
    - Title `<label>`: remove `whiteSpace: "nowrap"`, set `wordBreak: "break-word"`, `lineHeight: 1.3`.
    - Artist div: remove `whiteSpace: "nowrap"`, set `wordBreak: "break-word"`, `lineHeight: 1.3`.
- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test -- 1001AlbumsChecklistModal.test.jsx`
Expected: PASS.
- [ ] **Step 5: Commit**
`git commit -m "fix(jukebox): prevent checklist artwork overflow and allow full title wrapping"`

---

### Task 3: Fix Album & Artist Text Visibility in Flat Jukebox
**Files:**
- Modify: `frontend/src/components/jukebox/FlatJukebox.jsx`
- Test: `frontend/src/components/jukebox/FlatJukebox.test.jsx`

**Interfaces:**
- Consumes: `currentPick.album_name`, `currentPick.artist_name`, `onToggle1001Completed`
- Produces: Fully visible unwrapped/wrapped album text and non-crowded "Mark Played" button

- [ ] **Step 1: Write test asserting long album names and artists are not truncated by `whiteSpace: nowrap`**
In `FlatJukebox.test.jsx`, render a long album name (e.g. *"After the Gold Rush (Expanded Edition with Extra Tracks)"*) and verify the title element allows wrapping.
- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- FlatJukebox.test.jsx`
- [ ] **Step 3: Refactor title and action layout in `FlatJukebox.jsx`**
  - Allow the album name to wrap with `wordBreak: "break-word"`, `lineHeight: 1.25`, removing `whiteSpace: "nowrap"`.
  - Position the `[ Mark Played ]` / `[ ✓ Played ]` button (and `LikedHeart`) so it wraps gracefully with `flexWrap: "wrap"` or sits neatly next to the decade/genres row without crowding the title into 7 characters.
  - Add `onError` handler on the vinyl platter image to fallback gracefully to the "LP" monogram if the artwork URL fails to load.
- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test -- FlatJukebox.test.jsx`
Expected: PASS.
- [ ] **Step 5: Commit**
`git commit -m "fix(jukebox): ensure full album and artist text visibility on mobile"`

---

### Task 4: Fix Filter Checkbox Alignment (`flex-direction: row`)
**Files:**
- Modify: `frontend/src/components/jukebox/JukeboxFilters.jsx`
- Test: `frontend/src/components/jukebox/JukeboxFilters.test.jsx`

**Interfaces:**
- Consumes: `excludeCompleted`, `setExcludeCompleted`
- Produces: Horizontal inline checkbox and text label

- [ ] **Step 1: Write test asserting label has `flexDirection: row`**
In `JukeboxFilters.test.jsx`, verify the exclude-completed label style specifies `flex-direction: row`.
- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- JukeboxFilters.test.jsx`
- [ ] **Step 3: Update `JukeboxFilters.jsx`**
Add `flexDirection: "row"`, `alignItems: "center"`, and `gap: "8px"` to the label style, overriding global `label { flex-direction: column }`. Also increase filter pill tap targets to `min-height: 34px`.
- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test -- JukeboxFilters.test.jsx`
Expected: PASS.
- [ ] **Step 5: Commit**
`git commit -m "fix(jukebox): align exclude completed filter checkbox inline"`

---

### Task 5: Retro Jukebox Text Wrapping & 1001 Parity (Preserving Retro Styling)
**Files:**
- Modify: `frontend/src/components/jukebox/RetroJukebox.jsx`
- Modify: `frontend/src/components/jukebox/JukeboxCard.jsx`
- Test: `frontend/src/components/jukebox/JukeboxCard.test.jsx`

**Interfaces:**
- Consumes: `sourceMode`, `currentPick`, `onToggle1001Completed`
- Produces: Clean text wrapping in the retro card and retro-styled 1001 completion controls while keeping `RetroJukebox.module.css` arcade styling untouched.

- [ ] **Step 1: Write test verifying RetroJukebox handles 1001 albums and long text**
In `JukeboxCard.test.jsx`, switch to arcade view in 1001 mode and assert the 1001 album details and mark played button render cleanly.
- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- JukeboxCard.test.jsx`
- [ ] **Step 3: Update `RetroJukebox.jsx` and `JukeboxCard.jsx`**
  - Pass `onToggle1001Completed={handleToggle1001Completed}` to `RetroJukebox` in `JukeboxCard.jsx`.
  - In `RetroJukebox.jsx`:
    - Ensure `h3` album name and `p` artist text have `wordBreak: "break-word"`, `lineHeight: 1.25`.
    - If `sourceMode === "1001"`, display decade and genres, and provide a retro-styled `Mark Played` / `✓ Played` button styled to match the arcade aesthetic (`border: 2px solid #394651`, `borderRadius: 6px`, matching the existing arcade button border and font weight).
    - Leave `RetroJukebox.module.css` completely untouched.
- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test -- JukeboxCard.test.jsx`
Expected: PASS.
- [ ] **Step 5: Commit**
`git commit -m "fix(jukebox): ensure retro jukebox handles long album text and 1001 mode cleanly"`

---

### Task 6: Full Verification, Documentation, Changelog & Version Bump (v0.31.1)
**Files:**
- Modify: `frontend/package.json` (bump to `0.31.1`)
- Modify: `frontend/src/changelogData.js`
- Create: `docs/security/2026-11-05-jukebox-styling-fixes-review.md`

- [ ] **Step 1: Run all backend, worker, and frontend tests and linters**
  - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
  - `ruff check backend/app worker scripts`
  - `ruff format --check backend/app worker scripts`
  - `.venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh`
  - `cd frontend && npm run lint`
  - `cd frontend && npm test`
  - `cd frontend && npm run build`
- [ ] **Step 2: Differential Security Review**
Perform security analysis covering inputs, encoding, and style blast radius. Save to `docs/security/2026-11-05-jukebox-styling-fixes-review.md`.
- [ ] **Step 3: Bump version to `0.31.1` and update changelog**
Add `v0.31.1` entry in `frontend/src/changelogData.js` detailing mobile layout and text wrapping fixes.
- [ ] **Step 4: Commit and push working branch**
Push to `fix/jukebox-styling-and-text`.
- [ ] **Step 5: Open GitHub Pull Request**
Open PR targeting `main`.
