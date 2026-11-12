// Helpers for the "new version available" banner.

// The build id of the newest deployed build, read from /version.json.
// Returns null on any failure (offline, 404, the dev server's HTML fallback,
// bad JSON), so a failed check never shows a banner or an error.
export async function fetchLatestBuildId() {
  try {
    const res = await fetch("/version.json", { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.build === "string" && body.build ? body.build : null;
  } catch {
    return null;
  }
}

// Deletes the app's saved offline copy (CacheStorage only; login and settings live in
// localStorage and are untouched) so the next load fetches the new version.
export async function clearAppCaches() {
  try {
    if (typeof caches === "undefined") return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // Not being able to clear the cache must not stop the reload.
  }
}
