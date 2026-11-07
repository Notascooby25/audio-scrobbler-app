import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SleeveVinylDisc from "./slots/SleeveVinylDisc";
import SleeveTodayPage from "./slots/SleeveTodayPage";
import SleevePlayPage from "./slots/SleevePlayPage";
import LibraryPage from "../../pages/LibraryPage";
import ReportsPage from "../../pages/ReportsPage";
import SetlistsPage from "../../components/setlists/SetlistsPage";
import SetlistGigPage from "../../components/setlists/SetlistGigPage";
import * as api from "../../api";
import * as setlistsApi from "../../api/setlists";
import * as session from "../../session";

describe("Sleeve Skin Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-skin");
  });

  describe("SleeveVinylDisc", () => {
    it("renders SVG with concentric sound grooves and center label", () => {
      const { container } = render(<SleeveVinylDisc isPlaying={false} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg.getAttribute("width")).toBe("232");
      expect(svg.getAttribute("height")).toBe("232");

      const circles = container.querySelectorAll("circle");
      expect(circles.length).toBeGreaterThanOrEqual(8);
    });

    it("applies is-playing class when isPlaying is true", () => {
      const { container } = render(<SleeveVinylDisc isPlaying={true} />);
      const disc = container.querySelector(".sleeve-vinyl-disc");
      expect(disc.classList.contains("is-playing")).toBe(true);
    });
  });

  describe("SleeveTodayPage", () => {
    it("renders signed-out state when no access token", () => {
      vi.spyOn(session, "readSession").mockReturnValue(null);
      render(
        <MemoryRouter>
          <SleeveTodayPage />
        </MemoryRouter>
      );
      expect(screen.getByText(/Welcome to Sleeve/i)).toBeTruthy();
      expect(screen.getByText(/Connect Spotify/i)).toBeTruthy();
    });

    it("renders empty state when user has no listening history", async () => {
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "testuser",
      });
      vi.spyOn(api, "fetchRecentScrobbles").mockResolvedValue({ scrobbles: [], total: 0 });
      vi.spyOn(api, "fetchNowPlaying").mockResolvedValue({ is_playing: false });

      render(
        <MemoryRouter>
          <SleeveTodayPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Nothing played yet/i)).toBeTruthy();
      });
    });

    it("renders now playing stack and earlier crate when scrobbles exist", async () => {
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "testuser",
      });
      vi.spyOn(api, "fetchNowPlaying").mockResolvedValue({
        is_playing: true,
        track_name: "Fool's Gold",
        artist_name: "The Stone Roses",
        album_name: "The Stone Roses",
        artwork_url: "https://example.com/art.jpg",
      });
      vi.spyOn(api, "fetchRecentScrobbles").mockResolvedValue({
        scrobbles: [
          {
            id: 101,
            track_name: "I Wanna Be Adored",
            artist_name: "The Stone Roses",
            album_name: "The Stone Roses",
            artwork_url: "https://example.com/art2.jpg",
            played_at: new Date(Date.now() - 3600000).toISOString(),
            source: "spotify",
          },
        ],
        total: 1,
      });

      render(
        <MemoryRouter>
          <SleeveTodayPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Fool's Gold")).toBeTruthy();
        expect(screen.getAllByText("The Stone Roses").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Playing now/i)).toBeTruthy();
        expect(screen.getByText(/Earlier today/i)).toBeTruthy();
        expect(screen.getByText("I Wanna Be Adored")).toBeTruthy();
      });
    });
  });

  describe("SleevePlayPage", () => {
    it("renders signed-out message when no access token", () => {
      vi.spyOn(session, "readSession").mockReturnValue(null);
      render(
        <MemoryRouter>
          <SleevePlayPage />
        </MemoryRouter>
      );
      expect(screen.getByText(/Connect Spotify from the/i)).toBeTruthy();
    });

    it("renders JukeboxCard and RediscoverCard when signed in", async () => {
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "testuser",
      });
      vi.spyOn(api, "fetchJukeboxAlbums").mockResolvedValue({
        albums: [
          {
            id: 1,
            album_name: "Definitely Maybe",
            artist_name: "Oasis",
            release_year: 1994,
            play_count: 42,
          },
        ],
      });
      vi.spyOn(api, "fetchRediscoverTracks").mockResolvedValue({ tracks: [] });

      render(
        <MemoryRouter>
          <SleevePlayPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Play" })).toBeTruthy();
        expect(screen.getByLabelText("Album Jukebox")).toBeTruthy();
        expect(screen.getByLabelText("Time Capsule")).toBeTruthy();
      });
    });
  });

  describe("Library under Sleeve Skin", () => {
    it("renders Library page with tabs and scrobble list under sleeve skin", async () => {
      document.documentElement.setAttribute("data-skin", "sleeve");
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "testuser",
      });
      vi.spyOn(api, "fetchUserSettings").mockResolvedValue({
        default_date_range: "all.time",
        scrobbles_view: "list",
      });
      vi.spyOn(api, "fetchLibraryScrobbles").mockResolvedValue({
        scrobbles: [
          {
            id: 201,
            track_name: "Love Spreads",
            artist_name: "The Stone Roses",
            album_name: "Second Coming",
            artwork_url: "https://example.com/art.jpg",
            played_at: new Date().toISOString(),
            source: "spotify",
            is_liked: true,
          },
        ],
        total_count: 1,
      });
      vi.spyOn(api, "fetchLibraryTimeline").mockResolvedValue({ entries: [] });

      render(
        <MemoryRouter initialEntries={["/library"]}>
          <LibraryPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Library", level: 1 })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Scrobbles" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Artists" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Albums" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Tracks" })).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByText("Love Spreads")).toBeTruthy();
        expect(screen.getByText("The Stone Roses")).toBeTruthy();
        expect(screen.getByText("Today")).toBeTruthy();
      });
    });
  });

  describe("Reports under Sleeve Skin", () => {
    it("renders Reports page with section tabs and facts under sleeve skin", async () => {
      document.documentElement.setAttribute("data-skin", "sleeve");
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "testuser",
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

      expect(screen.getByRole("heading", { name: "Reports", level: 1 })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Listening" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Gigs" })).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByText("1,420")).toBeTruthy();
        expect(screen.getByText("Scrobbles this period")).toBeTruthy();
        expect(screen.getByText("4,890")).toBeTruthy();
        expect(screen.getByText("Listening minutes")).toBeTruthy();
      });
    });
  });

  describe("SetlistsPage (Gigs Index) in Sleeve Skin", () => {
    it("renders page heading, summary stats line, section tabs and actions under sleeve skin", async () => {
      document.documentElement.dataset.skin = "sleeve";
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "andy",
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

      const { container } = render(
        <MemoryRouter initialEntries={["/setlists"]}>
          <SetlistsPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Gigs", level: 1 })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "My Gigs" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Artists Seen" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Songs Heard" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Venues" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "+ Log a Gig" })).toBeTruthy();

      await waitFor(() => {
        const summarySpan = container.querySelector(".sleeve-summary");
        expect(summarySpan).toBeTruthy();
        expect(summarySpan.textContent).toContain("2 shows, 2 artists, 2 venues");
        expect(screen.getByText("The Cure")).toBeTruthy();
        expect(screen.getByText("Depeche Mode")).toBeTruthy();
      });
    });
  });

  describe("SetlistGigPage (Gig Detail) in Sleeve Skin", () => {
    it("renders gig header card, artist name, date block and actions under sleeve skin", async () => {
      document.documentElement.dataset.skin = "sleeve";
      vi.spyOn(session, "readSession").mockReturnValue({
        accessToken: "test-token",
        userId: 1,
        username: "andy",
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
        companions: [],
        following: [],
      });

      render(
        <MemoryRouter initialEntries={["/gigs/1"]}>
          <Routes>
            <Route path="/gigs/:concertId" element={<SetlistGigPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /The Cure Setlist/i, level: 1 })).toBeTruthy();
        expect(screen.getByText(/at Wembley Arena, London, United Kingdom/i)).toBeTruthy();
        expect(screen.getByText("Pictures of You")).toBeTruthy();
        expect(screen.getByText("Lovesong")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Copy setlist" })).toBeTruthy();
      });
    });
  });
});
