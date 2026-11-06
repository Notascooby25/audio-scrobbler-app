export function readSession() {
  try {
    return JSON.parse(localStorage.getItem("audio-scrobbler-session") || "null");
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem("audio-scrobbler-session");
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      window.caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
        .catch(() => null);
    } catch {
      // ignore
    }
  }
}
