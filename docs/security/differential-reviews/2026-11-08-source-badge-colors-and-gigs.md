# Differential Security Review: Source Badges, Brand Colors, and Live Gig Badges

- **Branch:** `feat/source-badges-colors-and-gigs`
- **Base:** `main` (commit `8ca006e`)
- **Review Date:** 2026-11-08
- **Scope:** Frontend source badge color alignment (Spotify green, Apple blue, BBC orange), live gig marker support, fallback geometric markers, and integration into Timeline and Sleeve skin surfaces.

---

## 1. Threat Modeling & Scope
- **Touchpoints:**
  - `frontend/src/styles.css`: CSS custom properties for Apple (`#0071e3`), Gig (`#8b5cf6`), and Fallback (`#0d9488`).
  - `frontend/src/components/SourceBadge.jsx`: Added resolver cases for live gigs (`setlistfm`, `gig`), import, and fallback geometric shape. Added `GigIcon` and `FallbackGeometricIcon`.
  - `frontend/src/skins/timeline/slots/TimelineHourlyChart.jsx`: Integrated `SourceBadge` in legend.
  - `frontend/src/skins/timeline/slots/TimelineRail.jsx`: Integrated `SourceBadge` in rail markers.
  - `frontend/src/skins/sleeve/slots/SleeveTodayPage.jsx`: Integrated `SourceBadge` in hero metadata.
  - `frontend/src/skins/timeline/timeline.css` & `frontend/src/skins/sleeve/sleeve.css`: Associated styling.
  - Test suites (`SourceBadge.test.jsx`, `timeline.test.jsx`, `sleeve.test.jsx`).
  - Version bump to 0.38.5 and changelog entry in `changelogData.js`.
- **Backend / Database Impact:** None. No backend endpoints, queries, or database schemas were touched.
- **Authentication / Token Theft:** No OAuth tokens, sessions, or credentials modified or exposed.
- **Client Cache Isolation:** No CacheStorage or Service Worker changes.
- **Secrets:** Zero secrets, API keys, or hostnames involved.

---

## 2. Findings by Severity

### Critical
None.

### High
None.

### Medium
None.

### Low / Informational
- **Fallback Badge Shape:** The fallback icon uses a centered geometric polygon (rhombus/diamond) in teal (`#0d9488`) with high contrast on both light and dark canvas backgrounds, ensuring that any untyped or novel scrobble sources render without broken image icons or missing symbols.

---

## 3. Test Coverage & Verification Summary
- **Unit Tests:**
  - `SourceBadge.test.jsx`: 11 passed (100%).
  - `timeline.test.jsx`: 35 passed (100%).
  - `sleeve.test.jsx`: 19 passed (100%).
  - Full Frontend Suite: 66 test files, 493 tests passed (100%).
  - Backend & Worker Suite: 435 passed, 13 skipped (100%).
- **Linters:**
  - Frontend ESLint (`npm run lint`): Clean.
  - ShellCheck: Clean.
  - Python Ruff: Clean (`ruff check backend/app worker scripts`).
- **E2E Tests:**
  - Playwright E2E Suite (`npm run test:e2e`): 18 passed (100%).
- **Visual Preview Verification:**
  - Captured responsive screenshots across Timeline and Sleeve themes on mobile (390px) and desktop (1440px). Confirmed source badges render cleanly with appropriate brand colors and live gig badges.

---

## 4. Verdict
**Approved for Merge.** No security risks, regression risks, or breaking changes identified.
