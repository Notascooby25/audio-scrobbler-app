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
