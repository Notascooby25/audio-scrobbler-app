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
    <div className="space-y-3">
      {/* Setlist.fm Sub-Filters Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">
            {filter === "past"
              ? `Attended Shows (${pastGigs.length})`
              : filter === "future"
                ? `Upcoming Shows (${futureGigs.length})`
                : `All Gigs (${gigs.length})`}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            className={`btn-plain-text text-xs ${
              filter === "all" ? "text-ink font-bold !no-underline" : "text-primary hover:underline"
            }`}
            onClick={() => setFilter("all")}
          >
            All Gigs ({gigs.length})
          </button>
          <span className="text-muted">·</span>
          <button
            type="button"
            className={`btn-plain-text text-xs ${
              filter === "past"
                ? "text-ink font-bold !no-underline"
                : "text-primary hover:underline"
            }`}
            onClick={() => setFilter("past")}
          >
            Attended ({pastGigs.length})
          </button>
          <span className="text-muted">·</span>
          <button
            type="button"
            className={`btn-plain-text text-xs ${
              filter === "future"
                ? "text-ink font-bold !no-underline"
                : "text-primary hover:underline"
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
        <div
          className="rounded border border-border overflow-hidden bg-surface divide-y divide-border"
          style={{ border: "0.5px solid var(--color-border)" }}
        >
          {filteredGigs.map((gig) => {
            const isRefreshing = isRefreshingId === gig.id;
            const isFuture = isFutureDate(gig.event_date);
            const isExpanded = expandedGigId === gig.id;
            const isConfirmingDelete = confirmDeleteId === gig.id;

            return (
              <div
                key={gig.id}
                className={`p-3 sm:p-3.5 transition-colors hover:bg-surface-hover ${
                  isFuture ? "border-l-4" : ""
                }`}
                style={{
                  borderLeft: isFuture ? "4px solid var(--color-primary, #0066FF)" : undefined,
                }}
              >
                {/* Main Row: Stacked Date Badge + Thin Vertical Divider + Clean Concert Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Setlist.fm Stacked Date */}
                    <SetlistDateBadge date={gig.event_date} size="sm" />

                    {/* Subtle vertical hairline divider */}
                    <div
                      className="w-[1px] h-10 bg-border shrink-0 hidden sm:block"
                      style={{ backgroundColor: "var(--color-border)" }}
                    />

                    {/* Concert Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Clean text link for artist (no blue pill box) */}
                        <button
                          type="button"
                          className="btn-text-link font-semibold text-sm text-left truncate"
                          onClick={() => toggleExpand(gig.id)}
                          title="Click to view songs played & notes inline"
                        >
                          {gig.artist_name}
                        </button>
                        {gig.is_support_act && (
                          <span className="text-[10px] text-muted font-normal">(Support Act)</span>
                        )}
                        {isFuture && (
                          <span className="text-[11px] text-primary font-medium">
                            • Upcoming • I&apos;m Going
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted mt-0.5 truncate">
                        <span>{gig.venue_name}</span>
                        {gig.city && <span>, {gig.city}</span>}
                        {gig.country && <span>, {gig.country}</span>}
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
                        <div className="mt-1 text-xs text-ink/80 italic line-clamp-1">
                          &ldquo;{gig.notes}&rdquo;
                        </div>
                      )}

                      {/* Expand / Collapse trigger as plain text link */}
                      <div className="mt-1 flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          className="btn-text-link text-xs font-normal"
                          onClick={() => toggleExpand(gig.id)}
                        >
                          {isExpanded ? "▲ Hide Songs & Notes" : "View Songs & Notes →"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      className="btn btn-secondary text-xs px-2 py-1 font-normal"
                      onClick={() => onRefreshSetlist(gig)}
                      disabled={isRefreshing}
                      title="Refresh setlist tracks from Setlist.fm"
                    >
                      {isRefreshing ? "Refreshing..." : "Refresh"}
                    </button>
                    <button
                      type="button"
                      className={`btn text-xs px-2 py-1 text-danger hover:bg-danger-soft transition-colors font-normal ${
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

                {/* Inline Delete Confirmation Bar */}
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
                        className="btn-plain-text text-xs"
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
                        className="btn text-xs px-2.5 py-1 text-white bg-danger hover:bg-danger-hover font-bold transition-colors"
                        onClick={() => handleConfirmDelete(gig)}
                        disabled={isDeletingId === gig.id}
                      >
                        {isDeletingId === gig.id ? "Deleting..." : "Confirm Delete"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Setlist & Notes Drawer */}
                {isExpanded && (
                  <div className="mt-3 pt-2.5 border-t border-border">
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
