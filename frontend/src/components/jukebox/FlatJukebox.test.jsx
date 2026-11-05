import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import FlatJukebox from "./FlatJukebox";

describe("FlatJukebox", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const defaultProps = {
    filteredAlbums: [
      {
        id: 1,
        album_name: "Abbey Road",
        artist_name: "The Beatles",
        release_year: 1969,
        play_count: 42,
      },
    ],
    pool: [
      {
        id: 1,
        album_name: "Abbey Road",
        artist_name: "The Beatles",
        release_year: 1969,
        play_count: 42,
      },
    ],
    currentPick: {
      id: 1,
      album_name: "Abbey Road",
      artist_name: "The Beatles",
      release_year: 1969,
      play_count: 42,
      spotify_url: "https://open.spotify.com/album/1",
    },
    rollsLeft: 2,
    sessionActive: true,
    canRoll: true,
    busy: false,
    mode: "any",
    setMode: vi.fn(),
    onLuckyDip: vi.fn(),
    onReroll: vi.fn(),
    onCommit: vi.fn(),
  };

  it("renders flat vinyl platter, album details, and controls", () => {
    render(<FlatJukebox {...defaultProps} />);
    expect(screen.getByText("Abbey Road")).toBeInTheDocument();
    expect(screen.getByText(/The Beatles/)).toBeInTheDocument();
    expect(screen.getByText(/Re-roll \(2 left\)/)).toBeInTheDocument();
    expect(screen.getByText("Open in Spotify ↗")).toBeInTheDocument();
  });

  it("triggers onReroll when reroll button clicked", () => {
    render(<FlatJukebox {...defaultProps} />);
    const rerollBtn = screen.getByRole("button", { name: /Re-roll/ });
    fireEvent.click(rerollBtn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(defaultProps.onReroll).toHaveBeenCalled();
  });

  it("renders interactive heart for current pick and calls onToggleLike", () => {
    const onToggleLike = vi.fn();
    render(
      <FlatJukebox
        {...defaultProps}
        currentPick={{ ...defaultProps.currentPick, is_liked: false }}
        onToggleLike={onToggleLike}
      />
    );
    const heartBtn = screen.getByRole("button", { name: "Like on Spotify" });
    expect(heartBtn).toBeInTheDocument();
    fireEvent.click(heartBtn);
    expect(onToggleLike).toHaveBeenCalledWith(
      expect.objectContaining({ album_name: "Abbey Road" })
    );
  });

  it("renders 1001 completion toggle button and calls onToggle1001Completed", () => {
    const onToggle1001Completed = vi.fn();
    render(
      <FlatJukebox
        {...defaultProps}
        sourceMode="1001"
        currentPick={{
          ...defaultProps.currentPick,
          id: 42,
          is_completed: false,
          artwork_url: "https://example.com/cover.jpg",
        }}
        onToggle1001Completed={onToggle1001Completed}
      />
    );
    const tickBtn = screen.getByRole("button", { name: /Mark Abbey Road as played/i });
    expect(tickBtn).toBeInTheDocument();
    fireEvent.click(tickBtn);
    expect(onToggle1001Completed).toHaveBeenCalledWith(42, true);

    // Verify artwork img rendered
    const img = screen.getByAltText("Abbey Road");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/cover.jpg");
  });
});
