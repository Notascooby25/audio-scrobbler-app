import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RetroJukebox from "./RetroJukebox";

const album = (id, extra = {}) => ({
  id,
  album_name: `Album ${id}`,
  artist_name: `Artist ${id}`,
  release_year: 1970 + id,
  play_count: id,
  ...extra,
});
const albums = (count) => Array.from({ length: count }, (_, index) => album(index + 1));
const emptyFilters = (extra = {}) => ({
  artist: "",
  decade: new Set(),
  genre: new Set(),
  length: new Set(),
  ...extra,
});
const tiles = () => screen.getAllByTestId("rack-tile");
const tilesInState = (state) => tiles().filter((tile) => tile.getAttribute("data-state") === state);

describe("RetroJukebox", () => {
  afterEach(() => {
    cleanup();
  });

  const abbeyRoad = {
    id: 1,
    album_name: "Abbey Road",
    artist_name: "The Beatles",
    release_year: 1969,
    play_count: 42,
    spotify_url: "https://open.spotify.com/album/1",
  };
  const defaultProps = {
    albums: [abbeyRoad],
    filteredAlbums: [abbeyRoad],
    pool: [abbeyRoad],
    currentPick: abbeyRoad,
    rollsLeft: 3,
    sessionActive: false,
    canRoll: true,
    busy: false,
    mode: "any",
    setMode: vi.fn(),
    filters: emptyFilters(),
    toggleFilter: vi.fn(),
    clearFilters: vi.fn(),
    onLuckyDip: vi.fn(),
    onReroll: vi.fn(),
    onCommit: vi.fn(),
  };

  it("renders marquee, turntable, and lucky dip button", () => {
    render(<RetroJukebox {...defaultProps} />);
    expect(screen.getByText("JUKEBOX")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lucky Dip/i })).toBeInTheDocument();
    expect(screen.getByText("Abbey Road")).toBeInTheDocument();
  });

  it("renders album title, artist and counter with explicit high-contrast retro colors", () => {
    render(<RetroJukebox {...defaultProps} />);
    const titleEl = screen.getByRole("heading", { level: 3, name: "Abbey Road" });
    expect(titleEl).toHaveStyle({ color: "#24212b" });

    const artistEl = screen.getByText(/The Beatles \(1969\)/);
    expect(artistEl).toHaveStyle({ color: "#394651" });

    expect(screen.getByTestId("rack-counter")).toHaveStyle({ color: "#24212b" });
  });

  describe("record rack", () => {
    it("always shows 40 tiles and fills them with the matching records", () => {
      render(
        <RetroJukebox {...defaultProps} filteredAlbums={albums(3)} pool={[]} currentPick={null} />
      );
      expect(tiles()).toHaveLength(40);
      expect(tilesInState("empty")).toHaveLength(37);
    });

    it("outlines the current pick and half-dims records outside the pick pool", () => {
      const all = albums(4);
      render(
        <RetroJukebox
          {...defaultProps}
          filteredAlbums={all}
          pool={[all[0], all[1]]}
          currentPick={all[0]}
        />
      );
      expect(tilesInState("current")).toHaveLength(1);
      expect(tilesInState("outpool")).toHaveLength(2);
    });

    it("does not half-dim anything when the pool is the whole set", () => {
      const all = albums(4);
      render(<RetroJukebox {...defaultProps} filteredAlbums={all} pool={all} currentPick={null} />);
      expect(tilesInState("outpool")).toHaveLength(0);
    });

    it("keeps the pick in the rack when more than 40 records match", () => {
      const all = albums(100);
      render(
        <RetroJukebox {...defaultProps} filteredAlbums={all} pool={all} currentPick={all[80]} />
      );
      expect(tiles()).toHaveLength(40);
      expect(tilesInState("current")).toHaveLength(1);
    });

    it("sets the tone arm down once there is a pick", () => {
      const { rerender } = render(<RetroJukebox {...defaultProps} currentPick={null} />);
      expect(screen.getByTestId("tone-arm")).toHaveAttribute("data-on", "false");
      rerender(<RetroJukebox {...defaultProps} />);
      expect(screen.getByTestId("tone-arm")).toHaveAttribute("data-on", "true");
    });
  });

  describe("counter", () => {
    it("says record for one and records for the rest", () => {
      const { rerender } = render(<RetroJukebox {...defaultProps} />);
      expect(screen.getByTestId("rack-counter")).toHaveTextContent(/^1 record$/);

      rerender(<RetroJukebox {...defaultProps} filteredAlbums={albums(5)} pool={albums(5)} />);
      expect(screen.getByTestId("rack-counter")).toHaveTextContent(/^5 records$/);
    });

    it("shows how many records a Pick from mode is choosing from", () => {
      render(
        <RetroJukebox {...defaultProps} filteredAlbums={albums(8)} pool={albums(2)} mode="least" />
      );
      expect(screen.getByTestId("rack-counter")).toHaveTextContent("picking from 2 least played");
    });

    it("has no pool note for Any", () => {
      render(<RetroJukebox {...defaultProps} filteredAlbums={albums(8)} pool={albums(8)} />);
      expect(screen.getByTestId("rack-counter")).not.toHaveTextContent("picking from");
    });
  });

  describe("filter lamps", () => {
    const lamp = (label, state) =>
      screen.queryByRole("button", { name: `${label} filter ${state}, go to filters` });

    it("lights only the lamps for filters that are active", () => {
      render(
        <RetroJukebox {...defaultProps} filters={emptyFilters({ genre: new Set(["Rock"]) })} />
      );
      expect(lamp("Genre", "on")).toHaveAttribute("data-on", "true");
      expect(lamp("Artist", "off")).toHaveAttribute("data-on", "false");
      expect(lamp("Year", "off")).toBeInTheDocument();
      expect(lamp("Length", "off")).toBeInTheDocument();
    });

    it("lights the Artist lamp for typed text and the Year lamp for a Rough Trade year", () => {
      render(
        <RetroJukebox
          {...defaultProps}
          filters={emptyFilters({ artist: "bea", year: new Set([2024]) })}
        />
      );
      expect(lamp("Artist", "on")).toBeInTheDocument();
      expect(lamp("Year", "on")).toBeInTheDocument();
    });

    it("leaves out the Length lamp outside Library mode", () => {
      render(<RetroJukebox {...defaultProps} sourceMode="1001" />);
      expect(lamp("Length", "off")).not.toBeInTheDocument();
      expect(lamp("Genre", "off")).toBeInTheDocument();
    });

    it("takes keyboard focus to the Filters button when a lamp is pressed", () => {
      render(<RetroJukebox {...defaultProps} />);
      fireEvent.click(lamp("Genre", "off"));
      expect(document.querySelector(".jukebox-filters-toggle")).toHaveFocus();
    });
  });

  describe("Pick from", () => {
    it("offers the four modes in Library mode and reports the choice", () => {
      const setMode = vi.fn();
      render(<RetroJukebox {...defaultProps} setMode={setMode} />);
      expect(screen.getByRole("radio", { name: "Any" })).toBeChecked();
      fireEvent.click(screen.getByRole("radio", { name: "Least played" }));
      expect(setMode).toHaveBeenCalledWith("least");
      expect(screen.getByRole("radio", { name: "Most played" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Recently added" })).toBeInTheDocument();
    });

    it("is left out in 1001 and Rough Trade modes", () => {
      const { rerender } = render(<RetroJukebox {...defaultProps} sourceMode="1001" />);
      expect(screen.queryByRole("radio", { name: "Any" })).not.toBeInTheDocument();
      rerender(<RetroJukebox {...defaultProps} sourceMode="rough_trade" />);
      expect(screen.queryByRole("radio", { name: "Any" })).not.toBeInTheDocument();
    });

    it("is not repeated inside the Filters drawer", () => {
      render(<RetroJukebox {...defaultProps} />);
      fireEvent.click(document.querySelector(".jukebox-filters-toggle"));
      expect(screen.queryByText("POOL SELECTION MODE")).not.toBeInTheDocument();
    });
  });

  describe("when nothing matches", () => {
    const noMatches = {
      ...defaultProps,
      filteredAlbums: [],
      pool: [],
      currentPick: null,
      canRoll: false,
    };

    it("dims the whole rack and says so", () => {
      render(<RetroJukebox {...noMatches} />);
      expect(tilesInState("empty")).toHaveLength(40);
      expect(screen.getByTestId("rack-counter")).toHaveTextContent(/^0 records$/);
      expect(screen.getByText("No records match these filters.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Lucky Dip/i })).toBeDisabled();
    });

    it("clears the filters from the empty box", () => {
      const clearFilters = vi.fn();
      render(<RetroJukebox {...noMatches} clearFilters={clearFilters} />);
      fireEvent.click(screen.getByRole("button", { name: "Clear filters", exact: true }));
      expect(clearFilters).toHaveBeenCalledTimes(1);
    });

    it("does not show the empty box when there are matches", () => {
      render(<RetroJukebox {...defaultProps} />);
      expect(screen.queryByText("No records match these filters.")).not.toBeInTheDocument();
    });
  });
});
