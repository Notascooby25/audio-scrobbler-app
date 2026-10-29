import { useState } from "react";
import SetlistDateBadge from "./SetlistDateBadge";
import SetlistTracklistDrawer from "./SetlistTracklistDrawer";

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
  const [pageSize, setPageSize] = useState(10);
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
  const paginatedArtists = artists.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-3">
      {/* Description & Per Page Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border">
        <div>
          <h3 className="font-bold text-sm text-ink">Artists Seen</h3>
          <p className="text-xs text-muted">Sorted by times seen followed by most recently seen.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="artists-per-page" className="text-muted shrink-0">
            Show per page:
          </label>
          <select
            id="artists-per-page"
            className="input-field text-xs py-1 px-2 rounded"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="space-y-1.5">
        {paginatedArtists.map((item, idx) => {
          const globalIdx = (currentPage - 1) * pageSize + idx;
          const isExpanded = expandedArtist === item.artist_name;
          // Calculate proportional bar width (between 15% and 100%)
          const barWidthPercent = Math.max(18, Math.round((item.count / maxCount) * 100));

          return (
            <div
              key={item.artist_name}
              className="card overflow-hidden transition-colors"
              style={{ border: "0.5px solid var(--color-border)" }}
            >
              {/* Header Row */}
              <div
                className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => handleToggle(item.artist_name)}
              >
                {/* Rank & Artist */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs font-bold text-muted w-6 text-center shrink-0">
                    {globalIdx + 1}
                  </span>
                  <span className="font-semibold text-sm text-ink truncate hover:underline">
                    {item.artist_name}
                  </span>
                </div>

                {/* Proportional Frequency Bar */}
                <div className="flex items-center gap-2 shrink-0 w-36 sm:w-48 justify-end">
                  <div className="w-full bg-surface-hover rounded h-6 flex items-center justify-end p-0.5 overflow-hidden">
                    <div
                      className="bg-primary text-white text-[11px] font-bold h-full rounded flex items-center justify-end px-2 transition-all duration-300"
                      style={{ width: `${barWidthPercent}%` }}
                    >
                      {item.count}
                    </div>
                  </div>
                  <span className="text-muted text-[10px] w-3 text-center">
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
                          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            <SetlistDateBadge date={g.date} size="sm" />
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                className="font-semibold text-ink hover:text-primary transition-colors text-left truncate cursor-pointer bg-transparent border-0 p-0 block text-xs"
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
                                  <span className="ml-1.5 text-primary font-medium">(Support)</span>
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
                              This will remove &ldquo;{item.artist_name} at {g.venue}&rdquo; and its
                              scrobbles from your history.
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

      {/* Numbered Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            &lt; Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
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
          ))}
          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next &gt;
          </button>
        </div>
      )}
    </div>
  );
}
