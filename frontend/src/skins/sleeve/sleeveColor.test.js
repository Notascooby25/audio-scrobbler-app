import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import {
  parseHex,
  relativeLuminance,
  contrastRatio,
  getOnSleeveColor,
  applySleeveColor,
} from "./sleeveColor";

describe("sleeveColor helper", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty("--sleeve");
    document.documentElement.style.removeProperty("--sl-on-sleeve");
  });

  describe("parseHex", () => {
    it("parses valid 6-digit hex colors", () => {
      expect(parseHex("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseHex("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
      expect(parseHex("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
    });

    it("parses valid 3-digit shorthand hex colors", () => {
      expect(parseHex("#f00")).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseHex("#0f0")).toEqual({ r: 0, g: 255, b: 0 });
    });

    it("returns null for invalid inputs", () => {
      expect(parseHex("")).toBeNull();
      expect(parseHex(null)).toBeNull();
      expect(parseHex("ff0000")).toBeNull();
      expect(parseHex("#xyz123")).toBeNull();
    });
  });

  describe("getOnSleeveColor", () => {
    it("returns white (#ffffff) for dark backgrounds", () => {
      expect(getOnSleeveColor("#000000")).toBe("#ffffff");
      expect(getOnSleeveColor("#121212")).toBe("#ffffff");
      expect(getOnSleeveColor("#1e3a8a")).toBe("#ffffff"); // dark navy
      expect(getOnSleeveColor("#166534")).toBe("#ffffff"); // dark forest
    });

    it("returns dark brown (#1a1305) for bright and high-luminance backgrounds", () => {
      expect(getOnSleeveColor("#ffffff")).toBe("#1a1305");
      expect(getOnSleeveColor("#ffe100")).toBe("#1a1305"); // bright yellow
      expect(getOnSleeveColor("#facc15")).toBe("#1a1305"); // gold
      expect(getOnSleeveColor("#a7f3d0")).toBe("#1a1305"); // light mint
    });

    it("chooses optimal contrast for Fool's Gold mid-tone", () => {
      const foolsGold = "#D4AF37";
      const choice = getOnSleeveColor(foolsGold);
      expect(["#1a1305", "#ffffff"]).toContain(choice);

      // Verify that the chosen color has higher contrast than the alternative
      const lumSleeve = relativeLuminance(parseHex(foolsGold));
      const whiteRatio = contrastRatio(1.0, lumSleeve);
      const brownRatio = contrastRatio(relativeLuminance({ r: 26, g: 19, b: 5 }), lumSleeve);

      if (choice === "#1a1305") {
        expect(brownRatio).toBeGreaterThan(whiteRatio);
      } else {
        expect(whiteRatio).toBeGreaterThanOrEqual(brownRatio);
      }
    });
  });

  describe("applySleeveColor", () => {
    it("sets CSS variables when enabled with valid hex", () => {
      applySleeveColor("#112233", true);
      expect(document.documentElement.style.getPropertyValue("--sleeve")).toBe("#112233");
      expect(document.documentElement.style.getPropertyValue("--sl-on-sleeve")).toBe("#ffffff");
    });

    it("removes CSS variables when matchAlbumSleeve is false", () => {
      applySleeveColor("#ff0055", true);
      expect(document.documentElement.style.getPropertyValue("--sleeve")).toBe("#ff0055");

      applySleeveColor("#ff0055", false);
      expect(document.documentElement.style.getPropertyValue("--sleeve")).toBe("");
      expect(document.documentElement.style.getPropertyValue("--sl-on-sleeve")).toBe("");
    });

    it("removes CSS variables when artworkColor is missing", () => {
      applySleeveColor("#ff0055", true);
      expect(document.documentElement.style.getPropertyValue("--sleeve")).toBe("#ff0055");

      applySleeveColor(null, true);
      expect(document.documentElement.style.getPropertyValue("--sleeve")).toBe("");
    });
  });
});
