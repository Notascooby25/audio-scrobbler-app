import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "fs";
import path from "path";
import { REQUIRED_TOKENS } from "../tokens.contract";
import TimelineNav from "./slots/TimelineNav";
import TimelineHourlyChart from "./slots/TimelineHourlyChart";
import TimelineRail from "./slots/TimelineRail";
import TimelineTodayPage from "./slots/TimelineTodayPage";
import TimelinePlayPage from "./slots/TimelinePlayPage";
import ReportsPage from "../../pages/ReportsPage";
import SetlistsPage from "../../components/setlists/SetlistsPage";
import SetlistGigPage from "../../components/setlists/SetlistGigPage";
import ProfilePage from "../../pages/ProfilePage";
import FollowingPage from "../../pages/FollowingPage";
import HomePage from "../../pages/HomePage";
import SettingsPage from "../../pages/SettingsPage";
import ChangelogPage from "../../pages/ChangelogPage";
import Footer from "../../components/Footer";
import Slot from "../Slot";
import { SkinProvider } from "../useSkin";
import * as api from "../../api";
import * as setlistsApi from "../../api/setlists";
import * as session from "../../session";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.documentElement.removeAttribute("data-skin");
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
      expect(avatar.querySelector(".timeline-avatar-disc")).toBeInTheDocument();
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

  describe("TimelineHourlyChart Component", () => {
    it("renders chart with accessible role='img' and aria-label", () => {
      const now = new Date();
      const currentHour = now.getHours();
      const sampleScrobbles = [
        {
          played_at: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            currentHour,
            10
          ).toISOString(),
        },
        {
          played_at: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            currentHour,
            25
          ).toISOString(),
        },
      ];

      render(<TimelineHourlyChart scrobbles={sampleScrobbles} />);

      const chart = screen.getByRole("img", { name: /Hourly listening distribution/i });
      expect(chart).toBeInTheDocument();
      expect(chart.getAttribute("aria-label")).toMatch(/2 plays? today/);

      // Check that legend exists
      expect(screen.getByText("Spotify")).toBeInTheDocument();
      expect(screen.getByText("YouTube")).toBeInTheDocument();
      expect(screen.getByText("Apple")).toBeInTheDocument();
      expect(screen.getByText("BBC")).toBeInTheDocument();
    });

    it("highlights the current hour and marks empty hours", () => {
      const now = new Date();
      const currentHour = now.getHours();
      const scrobbles = [
        {
          played_at: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            currentHour,
            5
          ).toISOString(),
        },
      ];

      const { container } = render(<TimelineHourlyChart scrobbles={scrobbles} />);

      const currentCol = container.querySelector(".timeline-chart-bar-col.current");
      expect(currentCol).toBeInTheDocument();

      // Check empty hours exist if currentHour > 0
      if (currentHour > 0) {
        const emptyCols = container.querySelectorAll(".timeline-chart-bar-col.empty");
        expect(emptyCols.length).toBeGreaterThan(0);
      }
    });
  });

  describe("TimelineRail Component", () => {
    it("renders 'Nothing yet today' empty state when there are no scrobbles", () => {
      render(<TimelineRail scrobbles={[]} nowPlaying={null} />);
      expect(screen.getByText("Nothing yet today")).toBeInTheDocument();
    });

    it("renders source markers for Spotify, YouTube, Apple Music, and BBC", () => {
      const now = Date.now();
      const scrobbles = [
        {
          id: 1,
          track_name: "Song A",
          artist_name: "Artist A",
          played_at: new Date(now - 10000).toISOString(),
          source: "spotify",
        },
        {
          id: 2,
          track_name: "Song B",
          artist_name: "Artist B",
          played_at: new Date(now - 20000).toISOString(),
          source: "youtube",
        },
        {
          id: 3,
          track_name: "Song C",
          artist_name: "Artist C",
          played_at: new Date(now - 30000).toISOString(),
          source: "apple",
        },
        {
          id: 4,
          track_name: "Song D",
          artist_name: "Artist D",
          played_at: new Date(now - 40000).toISOString(),
          source: "bbc",
        },
      ];

      render(<TimelineRail scrobbles={scrobbles} />);

      expect(screen.getByRole("img", { name: "Spotify" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "YouTube" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Apple Music" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "BBC Sounds" })).toBeInTheDocument();
    });

    it("renders quiet gaps when delta between consecutive scrobbles is >= 60 minutes", () => {
      const now = Date.now();
      const scrobbles = [
        {
          id: 1,
          track_name: "Newer Song",
          artist_name: "Artist 1",
          played_at: new Date(now).toISOString(),
        },
        // 2.5 hours gap
        {
          id: 2,
          track_name: "Older Song",
          artist_name: "Artist 2",
          played_at: new Date(now - 150 * 60 * 1000).toISOString(),
        },
      ];

      render(<TimelineRail scrobbles={scrobbles} />);

      const gap = screen.getByRole("separator", { name: "2 h quiet" });
      expect(gap).toBeInTheDocument();
      expect(screen.getByText("2 h quiet")).toBeInTheDocument();
    });

    it("does not render quiet gap when delta is less than 60 minutes", () => {
      const now = Date.now();
      const scrobbles = [
        {
          id: 1,
          track_name: "Song 1",
          artist_name: "Artist 1",
          played_at: new Date(now).toISOString(),
        },
        {
          id: 2,
          track_name: "Song 2",
          artist_name: "Artist 2",
          played_at: new Date(now - 20 * 60 * 1000).toISOString(),
        },
      ];

      render(<TimelineRail scrobbles={scrobbles} />);

      expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    });

    it("renders Now Playing row when active playback exists", () => {
      const nowPlaying = {
        is_playing: true,
        track_name: "Live Playing Track",
        artist_name: "Live Artist",
        artwork_url: "https://example.com/art.jpg",
      };

      render(<TimelineRail scrobbles={[]} nowPlaying={nowPlaying} />);

      expect(screen.getByText("Playing now")).toBeInTheDocument();
      expect(screen.getByText("Live Playing Track")).toBeInTheDocument();
      expect(screen.getByText("Live Artist")).toBeInTheDocument();
    });
  });

  describe("TimelineTodayPage Slot Component", () => {
    beforeEach(() => {
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        username: "Alex",
        userId: 1,
      });
      vi.spyOn(api, "fetchRecentScrobbles").mockResolvedValue({
        scrobbles: [
          {
            id: 1,
            track_name: "Today Song",
            artist_name: "Today Artist",
            played_at: new Date().toISOString(),
            duration_ms: 180000,
            source: "spotify",
          },
        ],
        total: 1,
      });
      vi.spyOn(api, "fetchNowPlaying").mockResolvedValue({ is_playing: false });
    });

    it("renders today's date heading and listening stats subtitle", async () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <TimelineTodayPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Today Song")).toBeInTheDocument();
      });

      // Subtitle contains plays and listening duration
      expect(screen.getByText(/1 play so far, 3 m of listening/i)).toBeInTheDocument();
    });

    it("resolves TimelineTodayPage through <Slot name='todayPage' /> when activeSkin is timeline", async () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <SkinProvider initialSkin="timeline">
            <Slot name="todayPage" fallback={<div data-testid="fallback-overview">Classic</div>} />
          </SkinProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId("fallback-overview")).not.toBeInTheDocument();
        expect(screen.getByText("Today Song")).toBeInTheDocument();
      });
    });
  });

  describe("TimelinePlayPage Slot Component", () => {
    it("renders signed-out empty notice linking to connect page when no session", () => {
      vi.spyOn(session, "readSession").mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={["/play"]}>
          <TimelinePlayPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Play" })).toBeInTheDocument();
      expect(
        screen.getByText(/to spin your Album Jukebox and explore your Time Capsule/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "connection page" })).toHaveAttribute(
        "href",
        "/connect"
      );
    });

    it("renders page title, subtitle, and jukebox/rediscover sections when signed in", async () => {
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        username: "Alex",
        userId: 1,
      });
      vi.spyOn(api, "fetchJukeboxAlbums").mockResolvedValue({
        albums: [
          {
            id: 1,
            album_name: "Blue Lines",
            artist_name: "Massive Attack",
            release_year: 1991,
            play_count: 50,
          },
        ],
      });
      vi.spyOn(api, "fetch1001Albums").mockResolvedValue({ albums: [] });
      vi.spyOn(api, "fetchRediscoverTracks").mockResolvedValue({ tracks: [] });

      render(
        <MemoryRouter initialEntries={["/play"]}>
          <TimelinePlayPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Play" })).toBeInTheDocument();
      expect(
        screen.getByText("An album from your own history, start to finish.")
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByLabelText("Album Jukebox")).toBeInTheDocument();
        expect(screen.getByLabelText("Time Capsule")).toBeInTheDocument();
      });
    });

    it("resolves TimelinePlayPage through <Slot name='playPage' /> when activeSkin is timeline", async () => {
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        username: "Alex",
        userId: 1,
      });
      vi.spyOn(api, "fetchJukeboxAlbums").mockResolvedValue({ albums: [] });
      vi.spyOn(api, "fetch1001Albums").mockResolvedValue({ albums: [] });
      vi.spyOn(api, "fetchRediscoverTracks").mockResolvedValue({ tracks: [] });

      render(
        <MemoryRouter initialEntries={["/play"]}>
          <SkinProvider initialSkin="timeline">
            <Slot name="playPage" fallback={<div data-testid="fallback-play">Classic</div>} />
          </SkinProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId("fallback-play")).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Play" })).toBeInTheDocument();
      });
    });
  });

  describe("Reports under Timeline Skin", () => {
    it("renders Reports page summary cards and tabs under timeline skin", async () => {
      document.documentElement.setAttribute("data-skin", "timeline");
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "alex",
      });
      vi.spyOn(api, "fetchReportsSummary").mockResolvedValue({
        period_scrobbles: 1420,
        listening_minutes: 4890,
        average_per_day: 47,
        comparison_percent: 12.4,
        listening_minutes_comparison_percent: 8.5,
        average_per_day_comparison_percent: 10.2,
      });
      vi.spyOn(api, "fetchReportsCharts").mockResolvedValue({
        weekly_scrobbles: [],
        listening_heatmap: [],
        listening_clock: [],
        music_by_decade: [],
      });
      vi.spyOn(api, "fetchReportsEntity").mockResolvedValue({ entries: [] });

      render(
        <MemoryRouter initialEntries={["/reports"]}>
          <ReportsPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Reports", level: 1 })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Listening" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Gigs" })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("1,420")).toBeInTheDocument();
        expect(screen.getByText("Scrobbles this period")).toBeInTheDocument();
        expect(screen.getByText("4,890")).toBeInTheDocument();
        expect(screen.getByText("Listening minutes")).toBeInTheDocument();
      });
    });

    it("verifies timeline.css defines two-row grid styles preserving artist, album, and track copy in report category grid", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const cssPath = path.resolve(__dirname, "timeline.css");
      const cssContent = fs.readFileSync(cssPath, "utf-8");

      expect(cssContent).toContain(
        '[data-skin="timeline"] .report-category-grid .library-rank-row'
      );
      expect(cssContent).toContain('grid-template-areas: "media copy" "media actions" !important');
      expect(cssContent).toContain(
        '[data-skin="timeline"] .report-category-grid .library-row-copy'
      );
      expect(cssContent).toContain(
        '[data-skin="timeline"] .report-category-grid .library-row-copy strong'
      );
      expect(cssContent).toContain(
        '[data-skin="timeline"] .report-category-grid .library-row-copy small'
      );
    });
  });

  describe("SetlistsPage (Gigs Index) under Timeline Skin", () => {
    it("renders page heading, log a gig button, segmented tabs and gig cards under timeline skin", async () => {
      document.documentElement.setAttribute("data-skin", "timeline");
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "alex",
      });
      vi.spyOn(setlistsApi, "fetchSetlistStatus").mockResolvedValue({ configured: true });
      vi.spyOn(setlistsApi, "fetchAttendances").mockResolvedValue([
        {
          id: 1,
          artist_name: "The Cure",
          venue_name: "Wembley Arena",
          event_date: "12-12-2022",
          city: "London",
          country: "United Kingdom",
        },
        {
          id: 2,
          artist_name: "Depeche Mode",
          venue_name: "Twickenham Stadium",
          event_date: "17-06-2023",
          city: "London",
          country: "United Kingdom",
        },
      ]);
      vi.spyOn(setlistsApi, "fetchGigInvites").mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={["/setlists"]}>
          <SetlistsPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Gigs", level: 1 })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "My Gigs" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Artists Seen" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Songs Heard" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Venues" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "+ Log a Gig" })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("The Cure")).toBeInTheDocument();
        expect(screen.getByText("Depeche Mode")).toBeInTheDocument();
      });
    });
  });

  describe("SetlistGigPage (Gig Detail) under Timeline Skin", () => {
    it("renders gig header, artist name, date, setlist songs and companion chips under timeline skin", async () => {
      document.documentElement.setAttribute("data-skin", "timeline");
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "alex",
      });
      vi.spyOn(setlistsApi, "fetchAttendance").mockResolvedValue({
        id: 1,
        artist_name: "The Cure",
        venue_name: "Wembley Arena",
        event_date: "12-12-2022",
        city: "London",
        country: "United Kingdom",
        tour_name: "Shows of a Lost World",
        raw_data: {
          sets: {
            set: [
              {
                song: [{ name: "Pictures of You" }, { name: "Lovesong" }],
              },
            ],
          },
        },
      });
      vi.spyOn(setlistsApi, "fetchGigBill").mockResolvedValue({
        acts: [],
        complete: true,
        capped: false,
      });
      vi.spyOn(setlistsApi, "fetchGigCompanions").mockResolvedValue({
        companions: [{ user_id: 10, username: "sam", display_name: "Sam", status: "added" }],
        following: [],
      });

      render(
        <MemoryRouter initialEntries={["/gigs/1"]}>
          <SetlistGigPage concertId="1" />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /The Cure/i })).toBeInTheDocument();
        expect(screen.getByText(/Wembley Arena, London, United Kingdom/)).toBeInTheDocument();
        expect(screen.getByText("Pictures of You")).toBeInTheDocument();
        expect(screen.getByText("Lovesong")).toBeInTheDocument();
        expect(screen.getByText("Sam")).toBeInTheDocument();
      });
    });
  });

  describe("ProfilePage under Timeline Skin", () => {
    it("renders profile header, stats, actions, and scrobble cards under timeline skin", async () => {
      document.documentElement.dataset.skin = "timeline";
      localStorage.setItem(
        "audio-scrobbler-session",
        JSON.stringify({ userId: 1, accessToken: "test-token", username: "andy" })
      );
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "andy",
      });
      vi.spyOn(api, "fetchUserProfile").mockResolvedValue({
        id: 1,
        username: "andy",
        display_name: "Andy",
        follower_count: 5,
        following_count: 3,
        is_self: true,
        is_following: false,
        can_view_details: true,
        last_scrobble: {
          track_name: "Pictures of You",
          artist_name: "The Cure",
          album_name: "Disintegration",
          source: "spotify",
          played_at: "2026-01-15T12:00:00",
        },
      });
      vi.spyOn(api, "fetchNowPlaying").mockResolvedValue(null);
      vi.spyOn(api, "fetchSpotifyStatus").mockResolvedValue({
        rate_limited: false,
        retry_after: null,
      });

      render(
        <MemoryRouter initialEntries={["/profile"]}>
          <ProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Profile", level: 1 })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "@andy", level: 2 })).toBeInTheDocument();
        expect(screen.getByText("Andy")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
      });
    });
  });

  describe("FollowingPage under Timeline Skin", () => {
    it("renders following list with live status and follow buttons under timeline skin", async () => {
      document.documentElement.dataset.skin = "timeline";
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "andy",
      });
      vi.spyOn(api, "fetchFollowing").mockResolvedValue({
        results: [
          {
            id: 2,
            username: "friend1",
            display_name: "Alice",
            is_following: true,
            last_scrobble: {
              track_name: "Ceremony",
              artist_name: "New Order",
            },
          },
        ],
      });
      vi.spyOn(api, "searchUsers").mockResolvedValue({ results: [] });

      render(
        <MemoryRouter initialEntries={["/following"]}>
          <FollowingPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Friends", level: 1 })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Following" })).toBeInTheDocument();
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "View profile" })).toBeInTheDocument();
      });
    });
  });

  describe("Connect / HomePage under Timeline Skin", () => {
    it("renders connection source cards and actions under timeline skin", async () => {
      document.documentElement.dataset.skin = "timeline";
      localStorage.removeItem("audio-scrobbler-session");
      vi.spyOn(session, "readSession").mockReturnValue(null);
      vi.spyOn(api, "fetchSpotifyStatus").mockResolvedValue({
        rate_limited: false,
        retry_after: null,
      });
      vi.spyOn(api, "fetchRecentScrobbles").mockResolvedValue({ scrobbles: [] });

      render(
        <MemoryRouter initialEntries={["/connect"]}>
          <HomePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Connect & Data Sources", level: 1 })
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Connect Spotify" })).toBeInTheDocument();
      });
    });
  });

  describe("SettingsPage under Timeline Skin", () => {
    it("renders settings tabs, form, and skin selector under timeline skin", async () => {
      document.documentElement.dataset.skin = "timeline";
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "andy",
      });
      vi.spyOn(api, "fetchUserSettings").mockResolvedValue({
        theme: "system",
        accent_color: "blue_monday",
        skin: "timeline",
      });
      vi.spyOn(api, "fetchScrobbleSettings").mockResolvedValue({});
      vi.spyOn(api, "fetchBlocks").mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={["/settings"]}>
          <SkinProvider>
            <SettingsPage />
          </SkinProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Danger Zone" })).toBeInTheDocument();
        expect(screen.getByLabelText("Skin")).toBeInTheDocument();
      });
    });
  });

  describe("ChangelogPage under Timeline Skin", () => {
    it("renders changelog release cards and version tags under timeline skin", async () => {
      document.documentElement.dataset.skin = "timeline";

      render(
        <MemoryRouter initialEntries={["/changelog"]}>
          <ChangelogPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Changelog", level: 1 })).toBeInTheDocument();
      expect(screen.getAllByText(/^v\d+\.\d+\.\d+/).length).toBeGreaterThan(0);
    });

    it("renders footer with version button above bottom dock in Timeline layout", () => {
      document.documentElement.dataset.skin = "timeline";

      render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      );

      expect(screen.getByTestId("app-footer")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /What's new/i })).toBeInTheDocument();
    });
  });
});
