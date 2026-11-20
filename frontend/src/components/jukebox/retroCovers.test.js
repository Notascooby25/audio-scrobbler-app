import { describe, expect, it } from "vitest";
import { buildRackTiles, coverBackground, coverInitials } from "./retroCovers";

const album = (id, extra = {}) => ({
  id,
  album_name: `Album ${id}`,
  artist_name: `Artist ${id}`,
  ...extra,
});
const albums = (count) => Array.from({ length: count }, (_, index) => album(index + 1));

describe("coverBackground", () => {
  it("is stable for the same album and different for another", () => {
    expect(coverBackground(album(1))).toBe(coverBackground(album(1)));
    expect(coverBackground(album(1))).not.toBe(coverBackground(album(2)));
  });

  it("copes with missing names", () => {
    expect(typeof coverBackground({})).toBe("string");
  });
});

describe("coverInitials", () => {
  it("skips small words and uses two letters", () => {
    expect(coverInitials("The Queen Is Dead")).toBe("QI");
    expect(coverInitials("Rumours")).toBe("RU");
  });

  it("falls back to LP for an empty title", () => {
    expect(coverInitials("")).toBe("LP");
    expect(coverInitials(undefined)).toBe("LP");
  });
});

describe("buildRackTiles", () => {
  it("always returns the requested number of tiles, filling spare slots with empties", () => {
    const tiles = buildRackTiles({ filteredAlbums: albums(3), pool: [], currentPick: null });
    expect(tiles).toHaveLength(40);
    expect(tiles.slice(0, 3).every((tile) => tile.state !== "empty")).toBe(true);
    expect(tiles.slice(3).every((tile) => tile.state === "empty" && tile.id === null)).toBe(true);
  });

  it("gives every tile a unique key", () => {
    const tiles = buildRackTiles({ filteredAlbums: albums(5), pool: [], currentPick: null });
    expect(new Set(tiles.map((tile) => tile.key)).size).toBe(40);
  });

  it("shows only the first 40 matches when there are more", () => {
    const tiles = buildRackTiles({ filteredAlbums: albums(100), pool: [], currentPick: null });
    expect(tiles).toHaveLength(40);
    expect(tiles.every((tile) => tile.state !== "empty")).toBe(true);
  });

  it("keeps the current pick in the rack even when it falls beyond the first 40", () => {
    const all = albums(100);
    const pick = all[69];
    const tiles = buildRackTiles({ filteredAlbums: all, pool: [], currentPick: pick });
    expect(tiles).toHaveLength(40);
    expect(tiles[39].id).toBe(pick.id);
    expect(tiles[39].state).toBe("current");
    expect(tiles.filter((tile) => tile.id === pick.id)).toHaveLength(1);
  });

  it("marks the current pick when it is already within the first 40", () => {
    const all = albums(5);
    const tiles = buildRackTiles({ filteredAlbums: all, pool: [], currentPick: all[2] });
    expect(tiles[2].state).toBe("current");
    expect(tiles.filter((tile) => tile.state === "current")).toHaveLength(1);
  });

  it("half-dims matches that are outside the pick pool", () => {
    const all = albums(3);
    const tiles = buildRackTiles({ filteredAlbums: all, pool: [all[0]], currentPick: null });
    expect(tiles[0].state).toBe("in");
    expect(tiles[1].state).toBe("outpool");
    expect(tiles[2].state).toBe("outpool");
  });

  it("does not half-dim anything when no pool is given", () => {
    const tiles = buildRackTiles({ filteredAlbums: albums(3), pool: [], currentPick: null });
    expect(tiles.some((tile) => tile.state === "outpool")).toBe(false);
  });

  it("returns only empty tiles when nothing matches", () => {
    const tiles = buildRackTiles({ filteredAlbums: [], pool: [], currentPick: null });
    expect(tiles).toHaveLength(40);
    expect(tiles.every((tile) => tile.state === "empty")).toBe(true);
  });
});
