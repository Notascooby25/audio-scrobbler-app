/**
 * Skins Registry
 * Central registry defining available visual skins, metadata, and slot components.
 */

import SleeveNav from "./sleeve/slots/SleeveNav";
import SleeveTodayPage from "./sleeve/slots/SleeveTodayPage";
import SleevePlayPage from "./sleeve/slots/SleevePlayPage";
import TimelineNav from "./timeline/slots/TimelineNav";
import TimelineTodayPage from "./timeline/slots/TimelineTodayPage";

export const SKINS = [
  {
    id: "classic",
    name: "Classic",
    description: "The original clean, utility-focused scrobbler interface.",
    supportsThemes: true,
    status: "live",
    slots: {},
  },
  {
    id: "sleeve",
    name: "Sleeve",
    description: "An album-led, immersive dark aesthetic derived dynamically from artwork.",
    supportsThemes: false,
    status: "live",
    slots: {
      appNav: SleeveNav,
      todayPage: SleeveTodayPage,
      playPage: SleevePlayPage,
    },
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "A calm, data-first vertical rail of plays with quiet gaps and hourly charts.",
    supportsThemes: true,
    status: "hidden",
    slots: {
      appNav: TimelineNav,
      todayPage: TimelineTodayPage,
    },
  },
];

export const DEFAULT_SKIN_ID = "classic";

export function getSkin(id) {
  const match = SKINS.find((skin) => skin.id === id);
  return match || SKINS.find((skin) => skin.id === DEFAULT_SKIN_ID);
}

export function getAvailableSkins({ includeHidden = false, includePreview = false } = {}) {
  return SKINS.filter((skin) => {
    if (skin.status === "live") return true;
    if (includePreview && skin.status === "preview") return true;
    if (includeHidden && skin.status === "hidden") return true;
    return false;
  });
}
