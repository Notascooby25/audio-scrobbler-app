/**
 * Dynamic Sleeve Color Extraction & Contrast Calculation
 *
 * Tints Sleeve tokens dynamically to the artwork color of the current record
 * and calculates optimal WCAG contrast text for `--sl-on-sleeve`.
 */

export function parseHex(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return null;
  const clean = hex.slice(1);
  if (clean.length !== 6 && clean.length !== 3) return null;
  let r, g, b;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

export function relativeLuminance({ r, g, b }) {
  const sRGB = [r, g, b].map((val) => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

export function contrastRatio(lum1, lum2) {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine whether `#ffffff` or `#1a1305` yields higher WCAG contrast on sleeveHex.
 */
export function getOnSleeveColor(sleeveHex) {
  const rgb = parseHex(sleeveHex);
  if (!rgb) return "#ffffff";
  const sleeveLum = relativeLuminance(rgb);
  const whiteRatio = contrastRatio(1.0, sleeveLum);
  const darkBrownLum = relativeLuminance({ r: 26, g: 19, b: 5 }); // #1a1305
  const darkBrownRatio = contrastRatio(darkBrownLum, sleeveLum);
  return darkBrownRatio > whiteRatio ? "#1a1305" : "#ffffff";
}

/**
 * Apply or clear dynamic sleeve color tokens on the root html element.
 */
export function applySleeveColor(artworkColor, matchAlbumSleeve = true) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isMatch = matchAlbumSleeve !== false && matchAlbumSleeve !== "false";

  if (isMatch && artworkColor && parseHex(artworkColor)) {
    root.style.setProperty("--sleeve", artworkColor);
    root.style.setProperty("--sl-on-sleeve", getOnSleeveColor(artworkColor));
  } else {
    root.style.removeProperty("--sleeve");
    root.style.removeProperty("--sl-on-sleeve");
  }
}
