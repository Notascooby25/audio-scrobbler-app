import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false
  );

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    const originalFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
    if (originalFetch) {
      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args);
          setOffline(false);
          return response;
        } catch (err) {
          if (err instanceof TypeError) {
            setOffline(true);
          }
          throw err;
        }
      };
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (originalFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  if (!offline) return null;

  return (
    <div role="status" aria-live="polite" className="update-banner offline-banner">
      <span className="update-banner__message">
        You are offline. Live data and saving changes won&apos;t work until you reconnect.
      </span>
    </div>
  );
}
