import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SleeveVinylDisc from "./slots/SleeveVinylDisc";
import SleeveTodayPage from "./slots/SleeveTodayPage";
import SleevePlayPage from "./slots/SleevePlayPage";
import LibraryPage from "../../pages/LibraryPage";
import * as api from "../../api";
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
});
