import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

// Helper function to calculate relative luminance per WCAG 2.1 specifications
function getLuminance(hex) {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const transform = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = transform(r);
  const G = transform(g);
  const B = transform(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Helper to calculate contrast ratio between two colors (L1 + 0.05) / (L2 + 0.05)
function getContrastRatio(color1, color2) {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Primary Text Color & WCAG AA Contrast Verification", () => {
  const stylesPath = path.resolve(__dirname, "styles.css");
  const stylesContent = fs.readFileSync(stylesPath, "utf-8");

  describe("WCAG AA Contrast Mathematical Ratios", () => {
    it("confirms #111111 on #FFFFFF exceeds WCAG AA (≥ 4.5:1) with ~18.9:1", () => {
      const ratio = getContrastRatio("#111111", "#FFFFFF");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeGreaterThan(18);
    });

    it("confirms #111111 on #F7F7F7 off-white canvas exceeds WCAG AA with ~17.6:1", () => {
      const ratio = getContrastRatio("#111111", "#F7F7F7");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeGreaterThan(17);
    });

    it("confirms #111111 on #E5E5E5 border surfaces exceeds WCAG AA with ~15:1", () => {
      const ratio = getContrastRatio("#111111", "#E5E5E5");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeGreaterThan(14);
    });

    it("confirms #FFFFFF on #0066FF (primary blue) meets WCAG AA for UI components/buttons (≥ 3:1)", () => {
      const ratio = getContrastRatio("#FFFFFF", "#0066FF");
      expect(ratio).toBeGreaterThanOrEqual(3.0);
      expect(ratio).toBeGreaterThan(4.4);
    });

    it("confirms #FFFFFF on #111111 exceeds WCAG AA with ~18.9:1", () => {
      const ratio = getContrastRatio("#FFFFFF", "#111111");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("confirms #707070 (--color-muted) on #FFFFFF meets WCAG AA (≥ 4.5:1)", () => {
      const ratio = getContrastRatio("#707070", "#FFFFFF");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("confirms #707070 (--color-muted) on #F7F7F7 off-white canvas meets WCAG AA (≥ 4.5:1)", () => {
      const ratio = getContrastRatio("#707070", "#F7F7F7");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("CSS Audit for Design Tokens Declarations", () => {
    it("sets --color-muted to #707070 in :root", () => {
      expect(stylesContent).toMatch(/--color-muted:\s*#707070;/);
    });

    it("sets --color-ink to #111111 in :root", () => {
      expect(stylesContent).toMatch(/--color-ink:\s*#111111;/);
    });

    it("explicitly sets body text to color var(--color-ink) and font-size 14px", () => {
      expect(stylesContent).toMatch(/body\s*\{[^}]*color:\s*var\(--color-ink\)/i);
      expect(stylesContent).toMatch(/body\s*\{[^}]*font-size:\s*14px/i);
    });

    it("explicitly sets headings h1, h2, h3 to var(--color-ink)", () => {
      expect(stylesContent).toMatch(
        /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[^}]*color:\s*var\(--color-ink\)/i
      );
    });

    it("explicitly sets base labels to color var(--color-ink)", () => {
      expect(stylesContent).toMatch(/label\s*\{[^}]*color:\s*var\(--color-ink\)/i);
    });

    it("explicitly sets inputs and selects text to color var(--color-ink)", () => {
      expect(stylesContent).toMatch(
        /input,\s*select,\s*textarea\s*\{[^}]*color:\s*var\(--color-ink\)/i
      );
    });

    it("explicitly sets buttons white text to var(--color-surface)", () => {
      expect(stylesContent).toMatch(/button\s*\{[^}]*color:\s*var\(--color-surface\)/i);
    });

    it("contains no softer black text (#222, #333, #444, #555, #666) in styles.css", () => {
      expect(stylesContent).not.toMatch(/color:\s*#222/i);
      expect(stylesContent).not.toMatch(/color:\s*#333/i);
      expect(stylesContent).not.toMatch(/color:\s*#444/i);
      expect(stylesContent).not.toMatch(/color:\s*#555/i);
      expect(stylesContent).not.toMatch(/color:\s*#666/i);
    });

    it("defines design token aliases in :root for theme hardening", () => {
      expect(stylesContent).toMatch(/--color-text-muted:\s*var\(--color-muted\);/);
      expect(stylesContent).toMatch(/--color-surface-hover:\s*#f5f5f5;/);
      expect(stylesContent).toMatch(/--color-bg:\s*var\(--color-canvas\);/);
      expect(stylesContent).toMatch(/--text:\s*var\(--color-ink\);/);
      expect(stylesContent).toMatch(/--text-muted:\s*var\(--color-muted\);/);
    });
  });

  describe("Component Styles and Badges Contrast Audit", () => {
    it("verifies ChangelogPage version badge does not use dark text #000 on primary accent", () => {
      const changelogPath = path.resolve(__dirname, "pages/ChangelogPage.jsx");
      const changelogContent = fs.readFileSync(changelogPath, "utf-8");
      expect(changelogContent).not.toMatch(/color:\s*['"]#000['"]/);
      expect(changelogContent).toMatch(/color:\s*['"]var\(--color-surface,\s*#ffffff\)['"]/);
      expect(changelogContent).toMatch(
        /backgroundColor:\s*['"]var\(--color-primary,\s*#0066ff\)['"]/i
      );
    });
  });

  describe("Song-Title Accent Presets Contrast and Tokens", () => {
    const ACCENT_PRESETS = [
      { id: "blue_monday", hex: "#0066FF" },
      { id: "spotify_green", hex: "#169C46" },
      { id: "red_red_wine", hex: "#E11D48" },
      { id: "purple_rain", hex: "#7C3AED" },
      { id: "fools_gold", hex: "#B45309" },
      { id: "paint_it_black", hex: "#475569" },
      { id: "pretty_in_pink", hex: "#EC4899" },
      { id: "orange_crush", hex: "#EA580C" },
    ];

    it.each(ACCENT_PRESETS)(
      "confirms white text on $id ($hex) meets UI component contrast (≥ 3.0:1)",
      ({ hex }) => {
        const ratio = getContrastRatio("#FFFFFF", hex);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      }
    );

    it.each(ACCENT_PRESETS)(
      'confirms styles.css defines :root[data-accent="$id"] rule',
      ({ id }) => {
        const regex = new RegExp(`:root\\[data-accent=["']${id}["']\\]`);
        expect(stylesContent).toMatch(regex);
      }
    );
  });
});
