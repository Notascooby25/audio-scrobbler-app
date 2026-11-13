import { useEffect, useState } from "react";
import { clearAppCaches, fetchLatestBuildId } from "../updateCheck";

const CHECK_EVERY_MS = 10 * 60 * 1000;

// Thin banner shown when a newer build of the app is live. It never reloads by itself:
// "Update now" clears the saved offline copy and reloads, "Later" hides it until the next
// check. With no build id (dev server, tests) it does nothing at all.
export default function UpdateBanner({
  currentBuildId = import.meta.env.VITE_BUILD_ID,
  intervalMs = CHECK_EVERY_MS,
}) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!currentBuildId) return undefined;
    let cancelled = false;

    async function check() {
      const latest = await fetchLatestBuildId();
      if (!cancelled) setAvailable(latest !== null && latest !== currentBuildId);
    }

    function onVisible() {
      if (document.visibilityState === "visible") check();
    }

    check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [currentBuildId, intervalMs]);

  async function updateNow() {
    try {
      await clearAppCaches();
    } catch {
      // Reload anyway: a stale offline copy is better than a banner that does nothing.
    }
    window.location.reload();
  }

  if (!available) return null;

  return (
    <div role="status" className="update-banner">
      <span className="update-banner__message">A new version is available.</span>
      <span className="update-banner__actions">
        <button type="button" className="update-banner__primary" onClick={updateNow}>
          Update now
        </button>
        <button type="button" className="update-banner__later" onClick={() => setAvailable(false)}>
          Later
        </button>
      </span>
    </div>
  );
}
