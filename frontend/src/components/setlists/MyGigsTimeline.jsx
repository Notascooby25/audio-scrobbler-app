import { useState } from "react";
import SetlistDateBadge, { isFutureDate } from "./SetlistDateBadge";

export default function MyGigsTimeline({
  gigs = [],
  onRefreshSetlist,
  onDeleteGig,
  onOpenSetlist,
  isRefreshingId,
}) {
  const [filter, setFilter] = useState("all"); // 'all' | 'past' | 'future'

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

            return (
              <div
                key={gig.id}
                className="card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors hover:border-border-subtle"
                style={{ border: "0.5px solid var(--color-border)" }}
              >
                <div className="flex items-start md:items-center gap-3.5 min-w-0 flex-1">
                  {/* Date Badge */}
                  <SetlistDateBadge date={gig.event_date} />

                  {/* Gig Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <button
                        type="button"
                        className="font-bold text-base text-ink hover:text-primary transition-colors text-left truncate cursor-pointer bg-transparent border-0 p-0"
                        onClick={() => onOpenSetlist && onOpenSetlist(gig)}
                        title="Click to view songs played & notes"
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

                    {/* Personal Notes Snippet if present */}
                    {gig.notes ? (
                      <div className="mt-1.5 p-2 rounded bg-surface-hover border border-border text-xs text-ink/90 flex items-start gap-1.5 italic">
                        <span className="not-italic shrink-0">📝</span>
                        <span className="line-clamp-2 leading-relaxed">
                          &ldquo;{gig.notes}&rdquo;
                        </span>
                      </div>
                    ) : null}

                    {/* Songs link */}
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      {onOpenSetlist && (
                        <button
                          type="button"
                          className="text-primary hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0 text-xs"
                          onClick={() => onOpenSetlist(gig)}
                        >
                          View Songs &amp; Notes &rarr;
                        </button>
                      )}
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
                    className="btn text-xs px-2.5 py-1 text-danger hover:bg-danger-soft transition-colors"
                    style={{ border: "0.5px solid var(--color-border)" }}
                    onClick={() => onDeleteGig(gig)}
                    title="Remove this gig"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
