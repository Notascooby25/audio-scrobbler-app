import { useState } from "react";
import SetlistDateBadge, { isFutureDate } from "./SetlistDateBadge";
import SetlistTracklistDrawer from "./SetlistTracklistDrawer";

export default function MyGigsTimeline({
  gigs = [],
  token,
  onRefreshSetlist,
  onDeleteGig,
  onNotesSaved,
  isRefreshingId,
}) {
  const [filter, setFilter] = useState("all"); // 'all' | 'past' | 'future'
  const [expandedGigId, setExpandedGigId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [includeSupportActs, setIncludeSupportActs] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState(null);

  if (gigs.length === 0) {
    return (
      <div className="card p-8 text-center text-muted">
        You haven&apos;t logged any gigs yet. Tap <strong>+ Log a Gig</strong> to get started!
      </div>
    );
  }

  const pastGigs = gigs.filter((g) => !isFutureDate(g.event_date));
  const futureGigs = gigs.filter((g) => isFutureDate(g.event_date));

  const filteredGigs = filter === "past" ? pastGigs : filter === "future" ? futureGigs : gigs;

  const toggleExpand = (gigId) => {
    setExpandedGigId((prev) => (prev === gigId ? null : gigId));
  };

  const handleConfirmDelete = async (gig) => {
    setIsDeletingId(gig.id);
    try {
      if (onDeleteGig) {
        await onDeleteGig(gig, includeSupportActs);
      }
      setConfirmDeleteId(null);
      if (expandedGigId === gig.id) {
        setExpandedGigId(null);
      }
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-Filters */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-surface-hover text-ink font-bold border border-border"
                : "text-muted hover:text-ink bg-transparent border-0"
            }`}
            onClick={() => setFilter("all")}
          >
            All Gigs ({gigs.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              filter === "past"
                ? "bg-surface-hover text-ink font-bold border border-border"
                : "text-muted hover:text-ink bg-transparent border-0"
            }`}
            onClick={() => setFilter("past")}
          >
            Attended ({pastGigs.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              filter === "future"
                ? "bg-primary/10 text-primary font-bold border border-primary/20"
                : "text-muted hover:text-ink bg-transparent border-0"
            }`}
            onClick={() => setFilter("future")}
          >
            Upcoming ({futureGigs.length})
          </button>
        </div>
      </div>

      {filteredGigs.length === 0 ? (
        <div className="card p-8 text-center text-muted text-xs">
          No {filter === "future" ? "upcoming" : "attended"} gigs found.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGigs.map((gig) => {
            const isRefreshing = isRefreshingId === gig.id;
            const isFuture = isFutureDate(gig.event_date);
            const isExpanded = expandedGigId === gig.id;
            const isConfirmingDelete = confirmDeleteId === gig.id;

            return (
              <div
                key={gig.id}
                className={`card p-4 transition-colors hover:border-border-subtle ${
                  isFuture ? "border-l-4" : ""
                }`}
                style={{
                  border: "0.5px solid var(--color-border)",
                  borderLeft: isFuture ? "4px solid var(--color-primary, #0066FF)" : undefined,
                }}
              >
                {/* Main Card Row */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start md:items-center gap-3.5 min-w-0 flex-1">
                    {/* Date Badge */}
                    <SetlistDateBadge date={gig.event_date} />

                    {/* Gig Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <button
                          type="button"
                          className="font-bold text-base text-ink hover:text-primary transition-colors text-left truncate cursor-pointer bg-transparent border-0 p-0"
                          onClick={() => toggleExpand(gig.id)}
                          title="Click to view songs played & notes inline"
                        >
                          {gig.artist_name} at {gig.venue_name}
                        </button>
                        {gig.is_support_act && (
                          <span className="text-[10px] text-primary font-semibold px-2 py-0.5 rounded bg-surface-hover border border-border">
                            Support Act
                          </span>
                        )}
                        {isFuture && (
                          <span className="badge font-bold px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                            Upcoming • I&apos;m Going
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted mb-1 truncate">
                        {gig.city}
                        {gig.country ? `, ${gig.country}` : ""}
                        {gig.song_count > 0 && <span> &bull; {gig.song_count} songs</span>}
                        {gig.tour_name && (
                          <span>
                            {" "}
                            &bull; Tour: <em>{gig.tour_name}</em>
                          </span>
                        )}
                      </div>

                      {/* Personal Notes Snippet if present and not expanded */}
                      {!isExpanded && gig.notes && (
                        <div className="mt-1.5 p-2 rounded bg-surface-hover border border-border text-xs text-ink/90 flex items-start gap-1.5 italic">
                          <span className="not-italic shrink-0">📝</span>
                          <span className="line-clamp-2 leading-relaxed">
                            &ldquo;{gig.notes}&rdquo;
                          </span>
                        </div>
                      )}

                      {/* Expand / Collapse trigger */}
                      <div className="mt-1 flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          className="text-primary hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0 text-xs"
                          onClick={() => toggleExpand(gig.id)}
                        >
                          {isExpanded ? "▲ Hide Songs & Notes" : "View Songs & Notes \u2192"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    <button
                      type="button"
                      className="btn btn-secondary text-xs px-2.5 py-1"
                      onClick={() => onRefreshSetlist(gig)}
                      disabled={isRefreshing}
                      title="Refresh setlist tracks from Setlist.fm"
                    >
                      {isRefreshing ? "Refreshing..." : "Refresh"}
                    </button>
                    <button
                      type="button"
                      className={`btn text-xs px-2.5 py-1 text-danger hover:bg-danger-soft transition-colors ${
                        isConfirmingDelete ? "bg-danger-soft font-bold" : ""
                      }`}
                      style={{ border: "0.5px solid var(--color-border)" }}
                      onClick={() => {
                        setConfirmDeleteId((prev) => (prev === gig.id ? null : gig.id));
                      }}
                      title="Remove this gig"
                    >
                      {isConfirmingDelete ? "Cancel" : "Delete"}
                    </button>
                  </div>
                </div>

                {/* Inline Delete Confirmation Bar - appears right here at the button pressed */}
                {isConfirmingDelete && (
                  <div
                    className="mt-3 pt-3 border-t border-border bg-danger-soft/40 p-3 rounded text-xs space-y-2 animate-fadeIn"
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
                      This will remove &ldquo;{gig.artist_name} at {gig.venue_name}&rdquo; and its
                      scrobbles from your live history.
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
                        disabled={isDeletingId === gig.id}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn text-xs px-3.5 py-1 font-bold text-white bg-danger hover:bg-danger/90"
                        style={{ backgroundColor: "var(--color-danger, #ef4444)" }}
                        onClick={() => handleConfirmDelete(gig)}
                        disabled={isDeletingId === gig.id}
                      >
                        {isDeletingId === gig.id ? "Deleting..." : "Confirm Delete"}
                      </button>
                    </div>
                  </div>
                )}

                {/* In-Place Setlist & Notes Drawer - expands right inside the card */}
                {isExpanded && (
                  <SetlistTracklistDrawer
                    setlistId={gig.setlist_id}
                    initialData={gig.raw_data}
                    token={token}
                    loggedConcertId={gig.id}
                    initialNotes={gig.notes || ""}
                    showNotesEditor={true}
                    onNotesSaved={onNotesSaved}
                    onCollapse={() => setExpandedGigId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
