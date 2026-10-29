/**
 * Helper to compute Setlist.fm-style tie-aware ranks.
 * In a sorted list, items with the same count share the same rank.
 * Setlist.fm shows the rank number only on the first item of a tie;
 * subsequent tied items have an empty rank display.
 * The next distinct item takes the 1-based index (e.g. 1, blank, 3, blank, 5).
 */
export function computeTieRanks(items, countKey = "count") {
  let lastCount = null;
  return items.map((item, idx) => {
    const count = item[countKey];
    const isTieWithPrevious = idx > 0 && count === lastCount;
    lastCount = count;
    return {
      item,
      rank: idx + 1,
      showRank: !isTieWithPrevious,
    };
  });
}

/**
 * Helper to generate page numbers with ellipsis matching Setlist.fm (e.g. [1, 2, 3, 4, 5, '...', 14]).
 */
export function getPaginationRange(currentPage, totalPages, maxVisible = 5) {
  if (totalPages <= maxVisible + 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) {
      pages.push("...");
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push("...");
    }
    pages.push(totalPages);
  }

  return pages;
}

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/**
 * Normalises Setlist.fm `sets.set[]` into named sets with continuous song numbers.
 * Tape songs are kept but unnumbered, matching setlist.fm.
 */
export function processSetlistSets(data) {
  const setsList = asArray(data?.sets?.set);
  let songNumber = 1;

  return setsList.map((set, idx) => {
    const songs = asArray(set.song).map((song) => ({
      name: song.name || "Untitled Song",
      number: song.tape ? null : songNumber++,
      tape: Boolean(song.tape),
      guest: song.with?.name || null,
      coverArtist: song.cover?.name || null,
      info: song.info || null,
    }));
    const encoreLabel = set.encore
      ? typeof set.encore === "number" && set.encore > 1
        ? `Encore ${set.encore}`
        : "Encore"
      : null;
    return {
      name: set.name || encoreLabel || (setsList.length > 1 ? `Set ${idx + 1}` : null),
      songs,
    };
  });
}

export function setlistAsText({ artistName, venueName, eventDate, sets }) {
  const lines = [`${artistName} at ${venueName} (${eventDate})`, ""];
  sets.forEach((set) => {
    if (set.name) lines.push(`-- ${set.name} --`);
    set.songs.forEach((song) => {
      let line = song.number ? `${song.number}. ${song.name}` : `[Tape] ${song.name}`;
      if (song.guest) line += ` (with ${song.guest})`;
      if (song.coverArtist) line += ` (${song.coverArtist} cover)`;
      if (song.info) line += ` (${song.info})`;
      lines.push(line);
    });
    lines.push("");
  });
  return lines.join("\n").trim();
}

/** Returns the URL only if it's http(s); stored and imported links are untrusted (e.g. javascript:). */
export function safeExternalUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}
