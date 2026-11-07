import React, { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_SKIN_ID, getSkin, SKINS } from "./index";

const SkinContext = createContext({
  id: DEFAULT_SKIN_ID,
  skin: getSkin(DEFAULT_SKIN_ID),
  setSkin: () => {},
});

export const STORAGE_KEY = "audio-scrobbler-skin";

function detectInitialSkin(initialSkin = null) {
  if (initialSkin && SKINS.some((s) => s.id === initialSkin)) {
    return initialSkin;
  }

  // 1. URL parameter override: ?skin=<id>
  if (typeof window !== "undefined" && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    const urlSkin = params.get("skin");
    if (urlSkin && SKINS.some((s) => s.id === urlSkin)) {
      return urlSkin;
    }
  }

  // 2. Local storage cached preference
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SKINS.some((s) => s.id === stored)) {
        return stored;
      }
    } catch (_err) {
      // Ignore localStorage access failures
    }
  }

  return DEFAULT_SKIN_ID;
}

export function applySkinToDocument(skinId) {
  if (typeof document === "undefined") return;

  const skin = getSkin(skinId);
  document.documentElement.setAttribute("data-skin", skin.id);

  // If a skin does not support themes (e.g. Sleeve is dark only), force data-theme="dark"
  if (!skin.supportsThemes) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    // Restore saved theme when returning to a theme-supporting skin
    try {
      const savedTheme = localStorage.getItem("audio-scrobbler-theme") || "system";
      document.documentElement.setAttribute("data-theme", savedTheme);
    } catch (_err) {
      // Ignore localStorage access failures
    }
  }
}

export function SkinProvider({ initialSkin = null, children }) {
  const [skinId, setSkinId] = useState(() => detectInitialSkin(initialSkin));

  useEffect(() => {
    applySkinToDocument(skinId);
    try {
      localStorage.setItem(STORAGE_KEY, skinId);
    } catch (_err) {
      // Ignore localStorage access failures
    }
  }, [skinId]);

  const setSkin = (nextId) => {
    if (SKINS.some((s) => s.id === nextId)) {
      setSkinId(nextId);
    }
  };

  const activeSkin = getSkin(skinId);

  return (
    <SkinContext.Provider value={{ id: skinId, skin: activeSkin, setSkin }}>
      {children}
    </SkinContext.Provider>
  );
}

export function useSkin() {
  return useContext(SkinContext);
}
