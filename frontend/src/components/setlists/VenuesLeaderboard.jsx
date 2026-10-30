import GigRows from "./GigRows";
import RankedBarList from "./RankedBarList";

export default function VenuesLeaderboard({ venues = [], onOpenGig = null }) {
  const items = venues.map((venue) => ({
    key: [venue.venue_name, venue.city, venue.country].join("|"),
    label: venue.venue_name,
    sub: [venue.city, venue.country].filter(Boolean).join(", "),
    count: venue.count,
    detail:
      venue.gigs && venue.gigs.length > 0 ? (
        <GigRows
          rows={venue.gigs.map((gig) => ({
            key: gig.id,
            date: gig.event_date || gig.date,
            title: gig.artist_name,
            meta: gig.date,
            tag: gig.is_support
              ? "Support"
              : gig.is_festival
                ? gig.festival_name || "Festival"
                : null,
            tagMuted: true,
            onOpen: onOpenGig ? () => onOpenGig(gig.id) : null,
          }))}
        />
      ) : null,
  }));

  const festivalGigs = venues
    .flatMap((venue) =>
      (venue.gigs || [])
        .filter((gig) => gig.is_festival)
        .map((gig) => ({
          ...gig,
          venueName: venue.venue_name,
          venueSub: [venue.city, venue.country].filter(Boolean).join(", "),
        }))
    )
    .sort((a, b) => (b.event_date || "").localeCompare(a.event_date || ""));

  return (
    <div>
      <div className="sfm-section-head">
        <h2>Venues</h2>
        <p className="sfm-section-desc">
          This table shows how often you&apos;ve been to a venue, sorted by number of visits.
        </p>
      </div>
      <RankedBarList
        items={items}
        noun="venues"
        idPrefix="venues"
        emptyText="No venues recorded yet."
      />
      {festivalGigs.length > 0 && (
        <div className="sfm-festivals">
          <div className="sfm-section-head">
            <h2>Festivals</h2>
            <p className="sfm-section-desc">Gigs you marked as festivals, newest first.</p>
          </div>
          <GigRows
            rows={festivalGigs.map((gig) => ({
              key: gig.id,
              date: gig.event_date || gig.date,
              title: gig.artist_name,
              meta: [gig.festival_name, gig.venueName, gig.venueSub].filter(Boolean).join(" · "),
              onOpen: onOpenGig ? () => onOpenGig(gig.id) : null,
            }))}
          />
        </div>
      )}
    </div>
  );
}
