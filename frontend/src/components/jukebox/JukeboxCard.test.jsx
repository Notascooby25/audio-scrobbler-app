import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import JukeboxCard from "./JukeboxCard";

vi.mock("../../api", () => ({
  fetchJukeboxAlbums: vi.fn().mockResolvedValue({
    albums: [
      {
        id: 1,
        album_name: "Abbey Road",
        artist_name: "The Beatles",
        release_year: 1969,
        play_count: 50,
        added_at: "2026-01-01T00:00:00Z",
      },
    ],
    source: "spotify_saved",
  }),
  recordJukeboxPick: vi.fn().mockResolvedValue({ status: "ok" }),
  fetch1001Albums: vi.fn().mockResolvedValue({
    albums: [
      {
        id: 1,
        album_name: "In The Wee Small Hours",
        artist_name: "Frank Sinatra",
        release_year: 1955,
        decade: 1950,
        is_completed: false,
      },
      {
        id: 2,
        album_name: "Ellington at Newport",
        artist_name: "Duke Ellington",
        release_year: 1956,
        decade: 1950,
        is_completed: true,
      },
    ],
    completed_count: 1,
    total_albums: 1001,
    decade_stats: { "1950s": { completed: 1, total: 2, pct: 50.0 } },
    pending_confirmation: {
      album_id: 1,
      album_name: "In The Wee Small Hours",
      artist_name: "Frank Sinatra",
      artwork_url: "",
      opened_at: "2026-11-05T00:00:00Z",
    },
  }),
  toggle1001AlbumCompleted: vi
    .fn()
    .mockResolvedValue({ album_id: 1, is_completed: true, completed_count: 2 }),
  dismiss1001PendingPlay: vi.fn().mockResolvedValue({ status: "ok" }),
  record1001PendingPlay: vi.fn().mockResolvedValue({ status: "ok" }),
}));

describe("JukeboxCard", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(cleanup);

  it("renders Jukebox card and allows toggling between Flat and Arcade mode", async () => {
    render(<JukeboxCard token="mock-token" />);
    expect(await screen.findByText(/Album Jukebox/i)).toBeInTheDocument();

    const toggleBtn = screen.getByRole("button", { name: /Arcade View/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByText("JUKEBOX")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Flat View/i })).toBeInTheDocument();
  });

  it("switches between My Library and 1001 Albums modes, showing progress and confirmation prompt", async () => {
    render(<JukeboxCard token="mock-token" />);
    expect(await screen.findByText(/Album Jukebox/i)).toBeInTheDocument();

    // Find mode toggle button
    const mode1001Btn = screen.getByRole("button", { name: /1001 Albums/i });
    expect(mode1001Btn).toBeInTheDocument();

    // Switch to 1001 mode
    fireEvent.click(mode1001Btn);

    // Verify progress button is displayed
    expect(await screen.findByText(/Progress:/i)).toBeInTheDocument();

    // Verify confirmation prompt banner
    expect(screen.getByText(/DID YOU LISTEN TO THIS ALBUM\?/i)).toBeInTheDocument();
    expect(screen.getByText(/In The Wee Small Hours/i)).toBeInTheDocument();

    // Click confirm button
    const confirmBtn = screen.getByRole("button", { name: /Yes, mark played/i });
    fireEvent.click(confirmBtn);
  });

  it("renders 1001 completion controls in Arcade View when in 1001 mode", async () => {
    render(<JukeboxCard token="mock-token" />);
    expect(await screen.findByText(/Album Jukebox/i)).toBeInTheDocument();

    // Switch to 1001 mode
    const mode1001Btn = screen.getByRole("button", { name: /1001 Albums/i });
    fireEvent.click(mode1001Btn);
    expect(await screen.findByText(/Progress:/i)).toBeInTheDocument();

    // Switch to Arcade view
    const toggleArcadeBtn = screen.getByRole("button", { name: /Arcade View/i });
    fireEvent.click(toggleArcadeBtn);

    // Verify Arcade marquee is present
    expect(screen.getByText("JUKEBOX")).toBeInTheDocument();

    // Click Lucky Dip in Arcade view
    const luckyDipBtn = screen.getByRole("button", { name: /Lucky Dip/i });
    fireEvent.click(luckyDipBtn);

    // Verify Mark Played / Played button exists in Arcade view
    expect(
      await screen.findByRole("button", { name: /Mark .* as (?:played|unplayed)|✓ Played/i })
    ).toBeInTheDocument();
  });
});


