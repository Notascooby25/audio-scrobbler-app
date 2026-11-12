# Update Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a temporary top banner when a newer build is live, with one click that clears the offline copy and reloads.

**Architecture:** The build stamps an id into the bundle and publishes it in `version.json`. A small React component compares the two (on load, on return to the tab, every 10 minutes) and shows the banner on a mismatch. Frontend-only plus one nginx header.

**Tech Stack:** React 18, Vite, Vitest + Testing Library (jsdom), nginx.

**Spec:** `docs/superpowers/specs/2026-11-12-update-banner-design.md`

## Global Constraints

- Flat styling: zero gradients, zero `box-shadow`, approved colour tokens only (`DESIGN.md`).
- Buttons are mixed case: scoped class sets `text-transform: none;`.
- No new dependency (`@testing-library/user-event` is not installed: use `fireEvent`).
- Component tests call `afterEach(() => cleanup())` (vitest `globals` is off).
- No build id (dev server, tests) means the banner never appears.
- Service worker keeps caching only the app shell. `version.json` is never cached.
- Prettier only on files touched; do not reformat unrelated code.
- Version bump to 0.48.0 and a changelog entry at the top of `frontend/src/changelogData.js`.

## Review Focus

- `version.json` is missing, returns HTML (dev SPA fallback), invalid JSON, or the network is down: no banner, no error shown.
- The latest id equals the running id: no banner.
- **Later** pressed, then the same mismatch is seen again at the next check: banner returns (spec'd), and a check that finds a match hides it.
- `caches` is unavailable (older browser, private mode): **Update now** still reloads.
- Banner above the header must not disturb the mobile header grid or other skins (verify by screenshots at desktop and phone width).

---

### Task 1: Build stamp and `version.json`

**Files:**
- Modify: `frontend/vite.config.js`
- Modify: `frontend/nginx.conf` (add `location = /version.json` next to the `/index.html` block)

**Interfaces:**
- Produces: `import.meta.env.VITE_BUILD_ID` (string, set at build) and a built file `dist/version.json` containing `{"build":"<same id>"}`.

- [ ] **Step 1:** In `vite.config.js` compute `const buildId = String(Date.now());`, add `define: { "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId) }`, and a small inline plugin `{ name: "emit-version-json", apply: "build", generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: buildId }) }); } }`.
- [ ] **Step 2:** In `nginx.conf` add `location = /version.json { add_header Cache-Control "no-cache"; }` with a one-line comment why.
- [ ] **Step 3: Verify** — Run: `cd frontend && npm run build && cat dist/version.json && grep -c "$(sed 's/.*:"\(.*\)".*/\1/' dist/version.json)" dist/assets/*.js | head -3` — Expected: JSON with a numeric `build`, and at least one built JS file contains that same number.
- [ ] **Step 4: Commit** — `git add frontend/vite.config.js frontend/nginx.conf && git commit -m "feat(update-banner): stamp each build and publish version.json"`

### Task 2: Update check helpers

**Files:**
- Create: `frontend/src/updateCheck.js`
- Test: `frontend/src/updateCheck.test.js`

**Interfaces:**
- Produces: `export async function fetchLatestBuildId(): Promise<string | null>` and `export async function clearAppCaches(): Promise<void>`.

- [ ] **Step 1: Write failing tests** in `updateCheck.test.js` (stub `globalThis.fetch` and `globalThis.caches` with `vi.stubGlobal`):
  - `fetchLatestBuildId returns the build string from version.json` (fetch called with `"/version.json"` and `{ cache: "no-store" }`)
  - `returns null when the response is not ok`, `returns null when the body is not JSON`, `returns null when fetch rejects`, `returns null when build is missing or not a string`
  - `clearAppCaches deletes every cache key`, `clearAppCaches does nothing when caches is undefined`, `clearAppCaches swallows errors`
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/updateCheck.test.js` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** both functions in `updateCheck.js`: `fetchLatestBuildId` wraps fetch + `res.json()` in try/catch and returns `null` for anything but a non-empty string `build`; `clearAppCaches` lists `caches.keys()` and deletes each, guarded for a missing `caches` and wrapped in try/catch.
- [ ] **Step 4: Run** the same command — Expected: all PASS.
- [ ] **Step 5: Commit** — `git add frontend/src/updateCheck.js frontend/src/updateCheck.test.js && git commit -m "feat(update-banner): version check and cache-clear helpers"`

### Task 3: Banner component and layout

**Files:**
- Create: `frontend/src/components/UpdateBanner.jsx`
- Create: `frontend/src/components/UpdateBanner.test.jsx`
- Modify: `frontend/src/components/Layout.jsx` (render `<UpdateBanner />` as the first child of `<main className="app-shell">`)
- Modify: `frontend/src/styles.css` (append `.update-banner` rules)

**Interfaces:**
- Consumes: `fetchLatestBuildId`, `clearAppCaches` from `../updateCheck`.
- Produces: `export default function UpdateBanner({ currentBuildId = import.meta.env.VITE_BUILD_ID, intervalMs = 600000 })` renders nothing, or `<div role="status" className="update-banner">` with text "A new version is available." and buttons named exactly `Update now` and `Later`.

- [ ] **Step 1: Write failing tests** (mock `../updateCheck`, `afterEach(() => cleanup())`, `fireEvent`, `waitFor`):
  - `renders nothing when there is no current build id` (and `fetchLatestBuildId` is not called)
  - `renders nothing when the latest id matches`
  - `shows the banner when the latest id differs`
  - `Later hides it, and a later check that still differs shows it again` (advance with `vi.useFakeTimers` and `intervalMs`)
  - `a later check that matches hides it`
  - `checks again when the tab becomes visible` (dispatch `visibilitychange` with `document.visibilityState` stubbed to `"visible"`)
  - `Update now clears caches then reloads` (stub `window.location` with a `reload` mock; assert order `clearAppCaches` then `reload`)
  - `Update now still reloads when clearing caches rejects`
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/components/UpdateBanner.test.jsx` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `UpdateBanner.jsx`: state `available`; an effect that, when `currentBuildId` is truthy, defines `check()` (calls `fetchLatestBuildId`, sets `available` to `latest !== null && latest !== currentBuildId`), runs it on mount, on `visibilitychange` when visible, and on `setInterval(check, intervalMs)`, and cleans all three up. **Update now** awaits `clearAppCaches()` inside try/finally and then calls `window.location.reload()`.
- [ ] **Step 4: Style** in `styles.css`: `.update-banner` as a flex row (message left, buttons right, wraps on phones), background `var(--color-accent-soft)`, `border-bottom: 0.5px solid var(--color-border)`, text `var(--color-ink)`, buttons `text-transform: none;`. No shadow, no gradient. Touch targets at least 44px tall at `@media (max-width: 720px)`.
- [ ] **Step 5: Mount** in `Layout.jsx`. Add one test in `UpdateBanner.test.jsx` or a new `Layout.test.jsx` that renders `Layout` inside a `MemoryRouter` with a mismatching mock and finds the banner before the nav.
- [ ] **Step 6: Run** `cd frontend && npx vitest run src/components/UpdateBanner.test.jsx` — Expected: all PASS. Then `npx prettier --write` the new/changed files.
- [ ] **Step 7: Commit** — `git add frontend/src/components/UpdateBanner.jsx frontend/src/components/UpdateBanner.test.jsx frontend/src/components/Layout.jsx frontend/src/styles.css && git commit -m "feat(update-banner): top banner with Update now and Later"`

### Task 4: Release housekeeping and full checks

**Files:**
- Modify: `frontend/package.json` (version `0.48.0`)
- Modify: `frontend/src/changelogData.js` (new top entry, plain English, date 2026-11-12)
- Modify: `frontend/src/components/settings/FaqSection.jsx` (new FAQ item: "Why does a banner say a new version is available?")

- [ ] **Step 1:** Make the three edits above; add `UpdateBanner` mention to the FAQ answer: Update now clears the saved offline copy and reloads; Later hides it for now.
- [ ] **Step 2: Run everything CI runs** — `cd frontend && npm run lint && npm test && npm run build` — Expected: lint clean, all tests pass, build succeeds. Also `ruff check backend/app worker scripts` and `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q` (unchanged, must still pass).
- [ ] **Step 3: Screenshots** — with a preview running (`scripts/preview.sh up`), temporarily publish a different `version.json` in the preview to force the banner; capture desktop and phone with `node e2e/preview-shots.mjs <folder outside repo> /reports /library`. Check the mobile header grid, every skin, and that the banner does not push the nav out of place.
- [ ] **Step 7: Differential review** (`differential-review` skill) and report by severity; then commit, push the branch, open the pull request with the change record, and wait for the owner's merge.
- [ ] **Step 8: Commit** — `git add frontend/package.json frontend/src/changelogData.js frontend/src/components/settings/FaqSection.jsx docs/superpowers/specs/2026-11-12-update-banner-design.md docs/superpowers/plans/2026-11-12-update-banner.md && git commit -m "feat(update-banner): release 0.48.0"`
