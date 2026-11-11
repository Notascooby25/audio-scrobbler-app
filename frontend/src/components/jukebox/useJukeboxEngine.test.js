import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useJukeboxEngine } from "./useJukeboxEngine";

const MOCK_ALBUMS = [
  {
    id: 1,
    album_name: "Abbey Road",
    artist_name: "The Beatles",
    release_year: 1969,
    genres: ["Rock"],
    duration_ms: 2843000,
    added_at: "2026-01-01T00:00:00Z",
    play_count: 50,
    last_picked_at: null,
  },
  {
    id: 2,
    album_name: "Nevermind",
    artist_name: "Nirvana",
    release_year: 1991,
    genres: ["Grunge"],
    duration_ms: 2900000,
    added_at: "2026-02-01T00:00:00Z",
    play_count: 20,
    last_picked_at: null,
  },
  {
    id: 3,
    album_name: "Discovery",
    artist_name: "Daft Punk",
    release_year: 2001,
    genres: ["Electronic"],
    duration_ms: 3660000,
    added_at: "2026-03-01T00:00:00Z",
    play_count: 5,
    last_picked_at: null,
  },
  {
    id: 4,
    album_name: "Currents",
    artist_name: "Tame Impala",
    release_year: 2015,
    genres: ["Alternative"],
    duration_ms: 3060000,
    added_at: "2026-04-01T00:00:00Z",
    play_count: 80,
    last_picked_at: null,
  },
];

describe("useJukeboxEngine", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("initializes with all albums and rolls left as 3", () => {
    const { result } = renderHook(() => useJukeboxEngine(MOCK_ALBUMS));
    expect(result.current.filteredAlbums.length).toBe(4);
    expect(result.current.rollsLeft).toBe(3);
    expect(result.current.sessionActive).toBe(false);
  });

  it("filters by decade correctly", () => {
    const { result } = renderHook(() => useJukeboxEngine(MOCK_ALBUMS));
    act(() => {
      result.current.toggleFilter("decade", "1960");
    });
    expect(result.current.filteredAlbums.length).toBe(1);
    expect(result.current.filteredAlbums[0].album_name).toBe("Abbey Road");
  });

  it("spends rolls on Lucky Dip and Re-roll down to 0 and locks", () => {
    const { result } = renderHook(() => useJukeboxEngine(MOCK_ALBUMS));
    act(() => {
      result.current.luckyDip();
    });
    expect(result.current.sessionActive).toBe(true);
    expect(result.current.rollsLeft).toBe(3);
    expect(result.current.currentPick).not.toBeNull();

    act(() => {
      result.current.reroll();
    });
    expect(result.current.rollsLeft).toBe(2);

    act(() => {
      result.current.reroll();
    });
    expect(result.current.rollsLeft).toBe(1);

    act(() => {
      result.current.reroll();
    });
    expect(result.current.rollsLeft).toBe(0);
    expect(result.current.canRoll).toBe(false);
  });

  it("commits session and resets rolls when commitSession is called", () => {
    const { result } = renderHook(() => useJukeboxEngine(MOCK_ALBUMS));
    act(() => {
      result.current.luckyDip();
      result.current.reroll();
      result.current.commitSession();
    });
    expect(result.current.sessionActive).toBe(false);
    expect(result.current.rollsLeft).toBe(3);
  });

  it("parent genre keyword matching works on library albums with micro-genres", () => {
    const albums = [
      { id: 1, album_name: "Kid A", artist_name: "Radiohead", genres: ["art rock", "electronic"] },
      { id: 2, album_name: "Blue", artist_name: "Joni Mitchell", genres: ["folk"] },
      { id: 3, album_name: "Kind of Blue", artist_name: "Miles Davis", genres: ["modal jazz"] },
    ];
    const { result } = renderHook(() => useJukeboxEngine(albums));

    act(() => {
      result.current.toggleFilter("genre", "Rock");
    });

    expect(result.current.filteredAlbums.map((a) => a.album_name)).toEqual(["Kid A"]);
  });

  it("excludeCompleted filter omits completed albums in 1001 or rough trade mode", () => {
    const albums = [
      { id: 1, album_name: "Album One", is_completed: true },
      { id: 2, album_name: "Album Two", is_completed: false },
    ];
    const { result } = renderHook(() => useJukeboxEngine(albums));

    act(() => {
      result.current.setExcludeCompleted(true);
    });

    expect(result.current.filteredAlbums.map((a) => a.album_name)).toEqual(["Album Two"]);
  });

  it("filters by year correctly for Rough Trade mode", () => {
    const albums = [
      { id: "rt-2020-1", album_name: "Album 2020", year: 2020 },
      { id: "rt-2025-1", album_name: "Album 2025", year: 2025 },
      { id: "rt-2026-1", album_name: "Album 2026", year: 2026 },
    ];
    const { result } = renderHook(() => useJukeboxEngine(albums));

    act(() => {
      result.current.setSourceMode("rough_trade");
      result.current.toggleFilter("year", 2025);
    });

    expect(result.current.filteredAlbums.map((a) => a.album_name)).toEqual(["Album 2025"]);
  });

  it("filters by both year AND genre simultaneously for Rough Trade mode", () => {
    const albums = [
      { id: "rt-2024-1", album_name: "Pop 2024", year: 2024, genres: ["Pop"] },
      { id: "rt-2024-2", album_name: "Rock 2024", year: 2024, genres: ["Rock"] },
      { id: "rt-2023-1", album_name: "Pop 2023", year: 2023, genres: ["Pop"] },
      { id: "rt-2023-2", album_name: "Rock 2023", year: 2023, genres: ["Rock"] },
    ];
    const { result } = renderHook(() => useJukeboxEngine(albums));

    act(() => {
      result.current.setSourceMode("rough_trade");
      result.current.toggleFilter("year", 2024);
      result.current.toggleFilter("genre", "Pop");
    });

    expect(result.current.filteredAlbums.map((a) => a.album_name)).toEqual(["Pop 2024"]);
  });

  it("returns 0 available albums when year and genre have no overlap", () => {
    const albums = [
      { id: "rt-2024-1", album_name: "Rock 2024", year: 2024, genres: ["Rock"] },
      { id: "rt-2023-1", album_name: "Metal 2023", year: 2023, genres: ["Metal"] },
    ];
    const { result } = renderHook(() => useJukeboxEngine(albums));

    act(() => {
      result.current.setSourceMode("rough_trade");
      result.current.toggleFilter("year", 2024);
      result.current.toggleFilter("genre", "Metal");
    });

    expect(result.current.filteredAlbums.length).toBe(0);
    expect(result.current.canRoll).toBe(false);
  });
});
