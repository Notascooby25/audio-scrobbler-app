import { useSearchParams } from "react-router-dom";
import GigRows from "./GigRows";
import { isFutureDate } from "./SetlistDateBadge";

export default function MyGigsTimeline({ gigs = [], onOpenGig = null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get("filter");
  const filter = filterParam === "past" || filterParam === "future" ? filterParam : "all";
  const setFilter = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("filter");
    else params.set("filter", next);
    setSearchParams(params, { replace: true });
  };

  if (gigs.length === 0) {
    return (
      <p className="sfm-empty">
        You haven&apos;t logged any gigs yet. Use <strong>+ Log a Gig</strong> to get started.
      </p>
    );
  }

  const pastGigs = gigs.filter((g) => !isFutureDate(g.event_date));
  const futureGigs = gigs.filter((g) => isFutureDate(g.event_date));
  const filteredGigs = filter === "past" ? pastGigs : filter === "future" ? futureGigs : gigs;

  return (
    <div>
      <div className="sfm-section-head">
        <h2>
          {filter === "past"
            ? `Attended Shows (${pastGigs.length})`
            : filter === "future"
              ? `Upcoming Shows (${futureGigs.length})`
              : `All Gigs (${gigs.length})`}
        </h2>
        <div className="sfm-filter">
          {[
            ["all", `All (${gigs.length})`],
            ["past", `Attended (${pastGigs.length})`],
            ["future", `Upcoming (${futureGigs.length})`],
          ].map(([key, label], idx) => (
            <span key={key}>
              {idx > 0 && (
                <span className="sfm-filter-sep" aria-hidden="true">
                  &middot;
                </span>
              )}
              <button
                type="button"
                className={`sfm-link ${filter === key ? "is-current" : ""}`}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {filteredGigs.length === 0 ? (
        <p className="sfm-empty">No {filter === "future" ? "upcoming" : "attended"} gigs found.</p>
      ) : (
        <GigRows
          rows={filteredGigs.map((gig) => {
            const isFuture = isFutureDate(gig.event_date);
            return {
              key: gig.id,
              date: gig.event_date,
              title: gig.artist_name,
              meta: [gig.venue_name, gig.city, gig.country].filter(Boolean).join(", "),
              tag: isFuture ? "Upcoming" : gig.is_support_act ? "Support" : null,
              tagMuted: !isFuture,
              onOpen: onOpenGig ? () => onOpenGig(gig.id) : null,
            };
          })}
        />
      )}
    </div>
  );
}
