import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "fs";
import path from "path";
import { REQUIRED_TOKENS } from "../tokens.contract";
import TimelineNav from "./slots/TimelineNav";
import Slot from "../Slot";
import { SkinProvider } from "../useSkin";
import * as api from "../../api";
import * as session from "../../session";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Helper function to calculate relative luminance per WCAG 2.1
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

// Helper simulating CSS color-mix(in srgb, color1 p1, color2)
function colorMix(hex1, hex2, p1) {
  const p2 = 1 - p1;
  const c1 = [
    parseInt(hex1.slice(1, 3), 16),
    parseInt(hex1.slice(3, 5), 16),
    parseInt(hex1.slice(5, 7), 16),
  ];
  const c2 = [
    parseInt(hex2.slice(1, 3), 16),
    parseInt(hex2.slice(3, 5), 16),
    parseInt(hex2.slice(5, 7), 16),
  ];
  const r = Math.round(c1[0] * p1 + c2[0] * p2);
  const g = Math.round(c1[1] * p1 + c2[1] * p2);
  const b = Math.round(c1[2] * p1 + c2[2] * p2);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

describe("Timeline Skin: Token Contract, Rules & Contrast Matrix", () => {
  const cssPath = path.resolve(__dirname, "timeline.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  describe("Token Contract & Scoping Compliance", () => {
    it("defines every required token in REQUIRED_TOKENS across timeline.css", () => {
      for (const token of REQUIRED_TOKENS) {
        expect(cssContent).toContain(`${token}:`);
      }
    });

    it("defines Timeline-specific tokens (--tl-rail, --tl-tile, --tl-mark)", () => {
      expect(cssContent).toContain("--tl-rail:");
      expect(cssContent).toContain("--tl-tile:");
      expect(cssContent).toContain("--tl-mark:");
    });

    it('enforces that all rules are strictly scoped under [data-skin="timeline"]', () => {
      const stripped = cssContent
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/@media[^{]*\{/g, "")
        .trim();

      const blocks = stripped.split("}");
      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        const selectorPart = trimmed.split("{")[0].trim();
        const selectors = selectorPart.split(",").map((s) => s.trim());
        for (const selector of selectors) {
          expect(selector.startsWith('[data-skin="timeline"]')).toBe(true);
        }
      }
    });

    it("enforces flat-by-default rules (zero gradients, zero box-shadows)", () => {
      expect(cssContent).not.toMatch(/linear-gradient/i);
      expect(cssContent).not.toMatch(/radial-gradient/i);
      expect(cssContent).not.toMatch(/conic-gradient/i);

      const nonFocus = cssContent.replace(/:focus[^{]*\{[^}]*\}/g, "");
      const boxShadowMatches = nonFocus.match(/box-shadow\s*:\s*([^;]+);/g) || [];
      for (const match of boxShadowMatches) {
        expect(match.toLowerCase()).toMatch(/box-shadow\s*:\s*none/);
      }
    });
  });

  describe("Mathematical Contrast Matrix (WCAG AA Compliance)", () => {
    const lightTokens = {
      canvas: "#F2F4F5",
      surface: "#FFFFFF",
      ink: "#0E1A24",
      muted: "#55626D",
    };

    const darkTokens = {
      canvas: "#0E1A24",
      surface: "#16242F",
      ink: "#E8EDF0",
      muted: "#9AA9B5",
    };

    it("validates Light theme text contrast meets or exceeds WCAG AA and spec targets", () => {
      const inkOnCanvas = getContrastRatio(lightTokens.ink, lightTokens.canvas);
      expect(inkOnCanvas).toBeGreaterThanOrEqual(4.5);
      expect(inkOnCanvas).toBeGreaterThan(15);

      const mutedOnCanvas = getContrastRatio(lightTokens.muted, lightTokens.canvas);
      expect(mutedOnCanvas).toBeGreaterThanOrEqual(4.5);
      expect(mutedOnCanvas).toBeGreaterThan(5.5);

      const inkOnSurface = getContrastRatio(lightTokens.ink, lightTokens.surface);
      expect(inkOnSurface).toBeGreaterThanOrEqual(4.5);
      expect(inkOnSurface).toBeGreaterThan(15);

      const mutedOnSurface = getContrastRatio(lightTokens.muted, lightTokens.surface);
      expect(mutedOnSurface).toBeGreaterThanOrEqual(4.5);
      expect(mutedOnSurface).toBeGreaterThan(5.5);
    });

    it("validates Dark theme text contrast meets or exceeds WCAG AA and spec targets", () => {
      const inkOnCanvas = getContrastRatio(darkTokens.ink, darkTokens.canvas);
      expect(inkOnCanvas).toBeGreaterThanOrEqual(4.5);
      expect(inkOnCanvas).toBeGreaterThan(14);

      const mutedOnCanvas = getContrastRatio(darkTokens.muted, darkTokens.canvas);
      expect(mutedOnCanvas).toBeGreaterThanOrEqual(4.5);
      expect(mutedOnCanvas).toBeGreaterThan(7.0);

      const inkOnSurface = getContrastRatio(darkTokens.ink, darkTokens.surface);
      expect(inkOnSurface).toBeGreaterThanOrEqual(4.5);
      expect(inkOnSurface).toBeGreaterThan(13);

      const mutedOnSurface = getContrastRatio(darkTokens.muted, darkTokens.surface);
      expect(mutedOnSurface).toBeGreaterThanOrEqual(4.5);
      expect(mutedOnSurface).toBeGreaterThan(6.0);
    });

    describe("Accent Marker Contrast Matrix across all 8 accents (≥ 3:1 for UI elements)", () => {
      const accents = {
        blue_monday: "#0066ff",
        spotify_green: "#169c46",
        red_red_wine: "#e11d48",
        purple_rain: "#7c3aed",
        fools_gold: "#d97706",
        paint_it_black: "#475569",
        pretty_in_pink: "#ec4899",
        orange_crush: "#ea580c",
      };

      it("confirms all 8 accents meet or exceed 3:1 on Light Canvas with Fool's Gold override", () => {
        for (const [name, rawHex] of Object.entries(accents)) {
          let effectiveHex = rawHex;
          if (name === "fools_gold") {
            effectiveHex = colorMix(rawHex, "#000000", 0.8);
          }
          const ratio = getContrastRatio(effectiveHex, lightTokens.canvas);
          expect(
            ratio,
            `Expected accent ${name} on Light Canvas to meet 3:1 ratio (got ${ratio.toFixed(2)})`
          ).toBeGreaterThanOrEqual(3.0);
        }
      });

      it("confirms all 8 accents meet or exceed 3:1 on Dark Canvas with Paint It Black override", () => {
        for (const [name, rawHex] of Object.entries(accents)) {
          let effectiveHex = rawHex;
          if (name === "paint_it_black") {
            effectiveHex = colorMix(rawHex, "#ffffff", 0.6);
          }
          const ratio = getContrastRatio(effectiveHex, darkTokens.canvas);
          expect(
            ratio,
            `Expected accent ${name} on Dark Canvas to meet 3:1 ratio (got ${ratio.toFixed(2)})`
          ).toBeGreaterThanOrEqual(3.0);
        }
      });
    });
  });

  describe("TimelineNav Slot Component", () => {
    beforeEach(() => {
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        username: "Alex",
        userId: 1,
      });
      vi.spyOn(api, "fetchUnreadNotificationCount").mockResolvedValue({ count: 3 });
    });

    it("renders the 5 primary tabs with accessible labels and icons", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <TimelineNav />
        </MemoryRouter>
      );

      const nav = screen.getByRole("navigation", { name: "Timeline navigation" });
      expect(nav).toBeInTheDocument();

      const todayTab = screen.getByRole("link", { name: "Today" });
      const libraryTab = screen.getByRole("link", { name: "Library" });
      const playTab = screen.getByRole("link", { name: "Play" });
      const reportsTab = screen.getByRole("link", { name: "Reports" });
      const gigsTab = screen.getByRole("link", { name: "Gigs" });

      expect(todayTab).toBeInTheDocument();
      expect(libraryTab).toBeInTheDocument();
      expect(playTab).toBeInTheDocument();
      expect(reportsTab).toBeInTheDocument();
      expect(gigsTab).toBeInTheDocument();

      expect(todayTab).toHaveAttribute("aria-current", "page");
      expect(todayTab.className).toContain("active");
      expect(libraryTab).not.toHaveAttribute("aria-current");
    });

    it("activates the correct tab based on current route", () => {
      const routes = [
        { path: "/library", tabName: "Library" },
        { path: "/play", tabName: "Play" },
        { path: "/reports", tabName: "Reports" },
        { path: "/gigs", tabName: "Gigs" },
      ];

      for (const { path: routePath, tabName } of routes) {
        cleanup();
        render(
          <MemoryRouter initialEntries={[routePath]}>
            <TimelineNav />
          </MemoryRouter>
        );

        const activeLink = screen.getByRole("link", { name: tabName });
        expect(activeLink).toHaveAttribute("aria-current", "page");
        expect(activeLink.className).toContain("active");
      }
    });

    it("renders top header with Scrobbler wordmark, notification badge, and profile avatar", async () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <TimelineNav />
        </MemoryRouter>
      );

      expect(screen.getByText("Scrobbler")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /3 unread notifications/i })).toBeInTheDocument();
      });

      const avatar = screen.getByRole("link", { name: /Profile/i });
      expect(avatar).toBeInTheDocument();
      expect(screen.getByText("A")).toBeInTheDocument(); // initial of Alex
    });

    it("renders subpage header with back button and leaves tabs neutral on subpages", () => {
      const subpages = [
        { path: "/settings", backLabel: "Back to Profile" },
        { path: "/following", backLabel: "Back to Profile" },
        { path: "/connect", backLabel: "Back to Profile" },
        { path: "/changelog", backLabel: "Back to Profile" },
        { path: "/gigs/101", backLabel: "Back to Gigs" },
      ];

      for (const { path: subPath, backLabel } of subpages) {
        cleanup();
        render(
          <MemoryRouter initialEntries={[subPath]}>
            <TimelineNav />
          </MemoryRouter>
        );

        const backLink = screen.getByRole("link", { name: backLabel });
        expect(backLink).toBeInTheDocument();

        // Bottom tabs are rendered but none is marked aria-current="page"
        const nav = screen.getByRole("navigation", { name: "Timeline navigation" });
        const tabs = within(nav).getAllByRole("link");
        for (const tab of tabs) {
          expect(tab).not.toHaveAttribute("aria-current", "page");
        }
      }
    });

    it("resolves TimelineNav through <Slot name='appNav' /> when activeSkin is timeline", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <SkinProvider initialSkin="timeline">
            <Slot name="appNav" fallback={<div data-testid="classic-fallback">Classic</div>} />
          </SkinProvider>
        </MemoryRouter>
      );

      expect(screen.queryByTestId("classic-fallback")).not.toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Timeline navigation" })).toBeInTheDocument();
    });
  });
});
