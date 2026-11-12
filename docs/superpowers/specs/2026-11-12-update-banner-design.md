# Update banner: design (approved by Andy, 2026-11-12)

## Intent and the why
After a release the installed app (especially on phones) keeps running the old code until reloaded, and a plain reload can still show the old version because the service worker serves its saved copy first. Andy wants a temporary banner at the top saying an update is available, with one click that really switches to the new version.

## Goals
- A thin banner on every page inside the main layout: "A new version is available." with **Update now** and **Later**.
- **Update now** clears the app's saved offline copy (CacheStorage only; login and settings in localStorage stay) and reloads, so the new version is what loads.
- Detection does not depend on the service worker changing.

## Non-goals / anti-goals
- Never reload automatically or interrupt what someone is doing.
- No new dependency, no backend change, no database change.
- Must not announce itself for a release that was already running when the page loaded.
- Must not show up in local dev or in tests (no build id).

## Constraints
- DESIGN.md: flat, no gradients, no box-shadow, approved colour tokens only.
- Buttons are mixed case, so the scoped class sets `text-transform: none`.
- Service worker must keep caching only the app shell; `version.json` is never cached.
- Public repo: nothing host-specific.

## Approaches considered
1. **Version file check (chosen).** Each build stamps a build id into the bundle and publishes `version.json` with the same id. The app compares them. Simple, works for every release, independent of the service worker.
2. Service-worker lifecycle ("waiting" worker). The standard PWA pattern, but the worker file only changes when someone edits it, so it would need a per-build stamp, removal of `skipWaiting`, and message passing. More moving parts for the same result.
3. Poll `index.html` and diff it. Heavier and brittle.

## Design
- `vite.config.js`: a build id (`Date.now()` string) is injected as `import.meta.env.VITE_BUILD_ID` and emitted as `version.json` (`{"build": "<id>"}`) in the build output.
- `src/updateCheck.js`: `fetchLatestBuildId()` (no-store fetch of `/version.json`; returns `null` on any failure or non-JSON, e.g. the dev server's SPA fallback) and `clearAppCaches()`.
- `src/components/UpdateBanner.jsx`: checks on mount, when the page becomes visible again, and every 10 minutes. Shows the banner when the latest id differs from the running id. **Later** hides it until the next check. **Update now** calls `clearAppCaches()` then reloads.
- `Layout.jsx` renders the banner above the nav, so it appears on every skin.
- `nginx.conf`: `location = /version.json` with `Cache-Control: no-cache`.
- The first release containing this cannot announce itself; the next one can.

## Left to the builder
Banner copy styling within DESIGN.md, exact CSS, test file layout.
