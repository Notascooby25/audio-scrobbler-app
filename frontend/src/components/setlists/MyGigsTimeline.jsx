export default function MyGigsTimeline({
  gigs = [],
  onRefreshSetlist,
  onDeleteGig,
  isRefreshingId,
}) {
  if (gigs.length === 0) {
    return (
      <div className="card p-8 text-center text-muted">
        You haven't logged any gigs yet. Tap <strong>+ Log a Gig</strong> to get started!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gigs.map((gig) => {
        const isRefreshing = isRefreshingId === gig.id;
        const dateStr = gig.event_date
          ? new Date(gig.event_date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "";

        return (
          <div
            key={gig.id}
            className="card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
            style={{ border: "0.5px solid var(--color-border)" }}
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">
                  {gig.artist_name} at {gig.venue_name}
                </h3>
                {gig.is_support_act && (
                  <span className="text-xs text-primary font-medium px-2 py-0.5 rounded bg-surface-hover">
                    Support Act
                  </span>
                )}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {gig.city}
                {gig.country ? `, ${gig.country}` : ""} &bull; {dateStr} &bull; {gig.song_count}{" "}
                songs
                {gig.tour_name && (
                  <span>
                    {" "}
                    &bull; Tour: <em>{gig.tour_name}</em>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                type="button"
                className="btn btn-secondary text-xs px-2.5 py-1"
                onClick={() => onRefreshSetlist(gig)}
                disabled={isRefreshing}
                title="Refresh setlist tracks from Setlist.fm"
              >
                {isRefreshing ? "Refreshing..." : "Refresh Setlist"}
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
  );
}
