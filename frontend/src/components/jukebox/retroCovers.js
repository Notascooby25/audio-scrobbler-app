// Helpers for the arcade jukebox: generated album covers and the record rack.

const SMALL_WORDS = /^(the|a|an|of|and|in)$/i;

function hashString(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// A stable, colourful stand-in cover for an album with no artwork.
export function coverBackground(album) {
  const hash = hashString(`${album?.album_name || ""}|${album?.artist_name || ""}`);
  const hueA = hash % 360;
  const hueB = (hueA + 60 + ((hash >>> 9) % 180)) % 360;
  const colourA = `hsl(${hueA}, 70%, 62%)`;
  const colourB = `hsl(${hueB}, 60%, 42%)`;
  switch ((hash >>> 4) % 3) {
    case 0:
      return `linear-gradient(135deg, ${colourA}, ${colourB})`;
    case 1:
      return `radial-gradient(circle at 30% 30%, ${colourA} 0 32%, ${colourB} 33%)`;
    default:
      return `repeating-linear-gradient(45deg, ${colourA} 0 10%, ${colourB} 10% 20%)`;
  }
}

export function coverInitials(title) {
  const text = String(title || "");
  const words = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word && !SMALL_WORDS.test(word));
  if (!words.length) return text.trim().slice(0, 2).toUpperCase() || "LP";
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
}

export const RACK_SIZE = 40;

// The rack shows up to `size` of the records that match the filters. Spare slots
// are dimmed empties, so the rack visibly fills up as the filters are loosened.
export function buildRackTiles({
  filteredAlbums = [],
  pool = [],
  currentPick = null,
  size = RACK_SIZE,
}) {
  const shown = filteredAlbums.slice(0, size);
  if (currentPick && !shown.some((album) => album.id === currentPick.id)) {
    const pick = filteredAlbums.find((album) => album.id === currentPick.id);
    // The pick is beyond the first `size` matches, so the rack is full: swap it in last.
    if (pick) shown[size - 1] = pick;
  }
  const poolIds = new Set(pool.map((album) => album.id));

  const tiles = shown.map((album) => {
    let state = "in";
    if (currentPick && album.id === currentPick.id) state = "current";
    else if (poolIds.size > 0 && !poolIds.has(album.id)) state = "outpool";
    return { key: `album-${album.id}`, id: album.id, state, album };
  });

  for (let index = tiles.length; index < size; index += 1) {
    tiles.push({ key: `empty-${index}`, id: null, state: "empty", album: null });
  }
  return tiles;
}
