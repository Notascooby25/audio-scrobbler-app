import { useState } from "react";
import SetlistDateBadge from "./SetlistDateBadge";
import SetlistTracklistDrawer from "./SetlistTracklistDrawer";
import { computeTieRanks, getPaginationRange } from "./setlistUiUtils";

export default function ArtistsSeenLeaderboard({
  artists = [],
  token,
  onRefreshSetlist,
  onDeleteGig,
  onNotesSaved,
  onOpenSetlist,
  isRefreshingId = null,
}) {
  const [expandedArtist, setExpandedArtist] = useState(null);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedGigId, setExpandedGigId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [includeSupportActs, setIncludeSupportActs] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState(null);

  const handleToggle = (artistName) => {
    setExpandedArtist((prev) => (prev === artistName ? null : artistName));
  };

  const toggleGigExpand = (gigId) => {
    setExpandedGigId((prev) => (prev === gigId ? null : gigId));
  };

  const handleDeleteClick = async (gig) => {
    if (!onDeleteGig) return;
    setIsDeletingId(gig.id);
    try {
      await onDeleteGig(gig, includeSupportActs);
      setConfirmDeleteId(null);
      if (expandedGigId === gig.id) {
        setExpandedGigId(null);
      }
    } finally {
      setIsDeletingId(null);
    }
  };

  if (artists.length === 0) {
    return <div className="card p-8 text-center text-muted">No artists seen recorded yet.</div>;
  }

  const maxCount = Math.max(...artists.map((a) => a.count || 1), 1);
  const totalPages = Math.ceil(artists.length / pageSize);

  // Compute tie-aware ranks across the entire dataset
  const rankedArtists = computeTieRanks(artists, "count");
  const paginatedRanked = rankedArtists.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const paginationPages = getPaginationRange(currentPage, totalPages);

  return (
    <div className="space-y-3">
      {/* Setlist.fm Header & Page Size Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Artists</h2>
          <p className="text-xs text-muted">
            This table shows how often you&apos;ve seen an artist, sorted by times seen followed by
            most recently seen.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0">
          <label htmlFor="artists-per-page" className="text-muted shrink-0">
            Artists shown per page:
          </label>
          <select
            id="artists-per-page"
            className="input-field text-xs py-1 px-2 rounded bg-surface border border-border"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Striped Dense Table */}
      <div
        className="rounded border border-border overflow-hidden bg-surface"
        style={{ border: "0.5px solid var(--color-border)" }}
      >
        <div className="divide-y divide-border">
          {paginatedRanked.map(({ item, rank, showRank }) => {
            const isExpanded = expandedArtist === item.artist_name;
            // Proportional bar width (between 12% and 100%)
            const barWidthPercent = Math.max(12, Math.round((item.count / maxCount) * 100));

            return (
              <div key={item.artist_name} className="transition-colors">
                {/* Main Row */}
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-hover transition-colors"
                  onClick={() => handleToggle(item.artist_name)}
                >
                  {/* Left: Tie-aware Rank & Artist Name */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-xs font-bold text-muted w-7 text-right shrink-0">
                      {showRank ? `${rank}.` : ""}
                    </span>
                    <button
                      type="button"
                      className="btn-text-link font-semibold text-sm text-left truncate"
                    >
                      {item.artist_name}
                    </button>
                  </div>

                  {/* Right: Setlist.fm Proportional Bar with Number on the Left */}
                  <div className="flex items-center gap-2 shrink-0 w-32 sm:w-48 justify-end">
                    <div className="w-full bg-surface-hover rounded h-5 flex items-center justify-start overflow-hidden">
                      <div
                        className="bg-primary text-white text-[11px] font-bold h-full rounded flex items-center justify-start pl-2 transition-all duration-300"
                        style={{ width: `${barWidthPercent}%` }}
                      >
                        {item.count}
                      </div>
                    </div>
                    <span className="text-muted text-[10px] w-3 text-center shrink-0">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Nested Gigs Accordion */}
                {isExpanded && item.gigs && item.gigs.length > 0 && (
                  <div
                    className="px-4 py-3 border-t divide-y divide-border space-y-3"
                    style={{
                      backgroundColor: "var(--color-surface-hover)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                      Attended Concerts ({item.gigs.length})
                    </span>
                    {item.gigs.map((g, gIdx) => {
                      const gigKey = g.id || gIdx;
                      const isGigExpanded = expandedGigId === g.id;
                      const isConfirmingDelete = confirmDeleteId === g.id;
                      const isRefreshing = isRefreshingId === g.id;
                      const drawerGig = {
                        ...g,
                        artist_name: item.artist_name,
                        venue_name: g.venue,
                        event_date: g.date,
                      };

                      return (
                        <div key={gigKey} className="pt-2.5 text-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            {/* Setlist.fm Stacked Date + Vertical Line + Venue */}
                            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                              <SetlistDateBadge date={g.date} size="sm" />
                              <div
                                className="w-[1px] h-9 bg-border shrink-0 hidden sm:block"
                                style={{ backgroundColor: "var(--color-border)" }}
                              />
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  className="btn-text-link font-semibold text-xs text-left truncate block"
                                  onClick={() => toggleGigExpand(g.id)}
                                  title="Click to view songs played & notes in-place"
                                >
                                  {g.venue}
                                  {g.city && (
                                    <span className="text-muted font-normal">, {g.city}</span>
                                  )}
                                </button>
                                <div className="text-muted text-[11px] mt-0.5">
                                  <span>{g.date}</span>
                                  {g.song_count > 0 && <span> &bull; {g.song_count} songs</span>}
                                  {g.is_support && (
                                    <span className="ml-1.5 text-primary font-medium">
                                      (Support)
                                    </span>
                                  )}
                                </div>
                                {!isGigExpanded && g.notes && (
                                  <p className="text-[11px] text-ink/80 italic mt-0.5 line-clamp-1">
                                    &ldquo;{g.notes}&rdquo;
                                  </p>
                                )}
                                <div className="mt-1 flex items-center gap-3">
                                  <button
                                    type="button"
                                    className="text-primary hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0 text-[11px]"
                                    onClick={() => toggleGigExpand(g.id)}
                                  >
                                    {isGigExpanded
                                      ? "▲ Hide Songs & Notes"
                                      : "View Songs & Notes \u2192"}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                              {onRefreshSetlist && (
                                <button
                                  type="button"
                                  className="btn btn-secondary text-[11px] px-2 py-1 shrink-0 font-medium"
                                  onClick={() => onRefreshSetlist(drawerGig)}
                                  disabled={isRefreshing}
                                  title="Refresh setlist from Setlist.fm"
                                >
                                  {isRefreshing ? "Refreshing..." : "Refresh"}
                                </button>
                              )}
                              {onDeleteGig && (
                                <button
                                  type="button"
                                  className={`btn text-[11px] px-2 py-1 shrink-0 text-danger hover:bg-danger-soft transition-colors ${
                                    isConfirmingDelete ? "bg-danger-soft font-bold" : ""
                                  }`}
                                  style={{ border: "0.5px solid var(--color-border)" }}
                                  onClick={() =>
                                    setConfirmDeleteId((prev) => (prev === g.id ? null : g.id))
                                  }
                                  title="Remove this concert"
                                >
                                  {isConfirmingDelete ? "Cancel" : "Delete"}
                                </button>
                              )}
                              {onOpenSetlist && !onDeleteGig && (
                                <button
                                  type="button"
                                  className="btn btn-secondary text-[11px] px-2 py-1 shrink-0 font-medium"
                                  onClick={() => onOpenSetlist(g)}
                                >
                                  View Setlist
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inline Delete Confirmation Bar */}
                          {isConfirmingDelete && (
                            <div
                              className="mt-2.5 pt-2 border-t border-border bg-danger-soft/40 p-2.5 rounded text-xs space-y-2 animate-fadeIn"
                              style={{ border: "0.5px solid var(--color-danger, #ef4444)" }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-danger flex items-center gap-1.5 text-xs">
                                  <span>⚠️</span> Remove this concert from your gigs?
                                </span>
                                <button
                                  type="button"
                                  className="text-muted hover:text-ink text-xs cursor-pointer bg-transparent border-0"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  &times;
                                </button>
                              </div>
                              <p className="text-muted text-[11px] leading-relaxed">
                                This will remove &ldquo;{item.artist_name} at {g.venue}&rdquo; and
                                its scrobbles from your history.
                              </p>
                              <label className="flex items-center gap-2 cursor-pointer text-ink font-medium select-none pt-0.5">
                                <input
                                  type="checkbox"
                                  checked={includeSupportActs}
                                  onChange={(e) => setIncludeSupportActs(e.target.checked)}
                                  className="rounded"
                                />
                                <span>Also delete logged support acts for this night</span>
                              </label>
                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  className="btn btn-secondary text-xs px-2.5 py-1"
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={isDeletingId === g.id}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn text-xs px-2.5 py-1 text-white bg-danger hover:bg-danger-hover font-bold transition-colors"
                                  onClick={() => handleDeleteClick(drawerGig)}
                                  disabled={isDeletingId === g.id}
                                >
                                  {isDeletingId === g.id ? "Deleting..." : "Confirm Delete"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Inline Tracklist & Notes Drawer */}
                          {isGigExpanded && (
                            <div className="mt-3 pt-2.5 border-t border-border">
                              <SetlistTracklistDrawer
                                setlistId={g.setlist_id}
                                initialData={g.raw_data}
                                token={token}
                                loggedConcertId={g.id}
                                initialNotes={g.notes || ""}
                                showNotesEditor={true}
                                onNotesSaved={onNotesSaved}
                                onCollapse={() => setExpandedGigId(null)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Setlist.fm Numbered Pagination with Ellipsis */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            title="Previous page"
          >
            &lsaquo;
          </button>
          {paginationPages.map((pg, pIdx) => {
            if (pg === "...") {
              return (
                <span key={`ellipsis-${pIdx}`} className="text-xs px-1 text-muted">
                  &hellip;
                </span>
              );
            }
            return (
              <button
                key={pg}
                type="button"
                className={`text-xs px-2.5 py-1 rounded font-semibold cursor-pointer transition-colors ${
                  currentPage === pg
                    ? "bg-primary text-white"
                    : "bg-surface hover:bg-surface-hover text-ink border border-border"
                }`}
                onClick={() => setCurrentPage(pg)}
              >
                {pg}
              </button>
            );
          })}
          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            title="Next page"
          >
            &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
}
