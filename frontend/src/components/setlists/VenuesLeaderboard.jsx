import GigRows from "./GigRows";
import RankedBarList from "./RankedBarList";
import FestivalEditions from "./FestivalEditions";
import VenueFestivals from "./VenueFestivals";
import { venueFestivalName } from "./festivalNames";

export default function VenuesLeaderboard({ venues = [], onOpenGig = null }) {
  const items = venues.map((venue) => {
    const address = [venue.city, venue.country].filter(Boolean).join(", ");
    // A venue whose gigs are all festivals is headed by the festival, with the venue beneath
    const festivalName = venueFestivalName(venue.gigs || []);
    return {
      key: [venue.venue_name, venue.city, venue.country].join("|"),
      label: festivalName ? (
        <span className="venue-festival-heading">{festivalName}</span>
      ) : (
        venue.venue_name
      ),
      sub: festivalName ? [venue.venue_name, address].filter(Boolean).join(", ") : address,
      count: venue.count,
      detail:
        venue.gigs && venue.gigs.length > 0 ? (
          <>
            <VenueFestivals gigs={venue.gigs} onOpenGig={onOpenGig} />
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
          </>
        ) : null,
    };
  });

  const festivalGigs = venues.flatMap((venue) =>
    (venue.gigs || [])
      .filter((gig) => gig.is_festival && gig.festival_name)
      .map((gig) => ({
        ...gig,
        venueName: venue.venue_name,
        venueSub: [venue.city, venue.country].filter(Boolean).join(", "),
      }))
  );

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
            <p className="sfm-section-desc">
              Each festival you&apos;ve been to, newest first. Open one to see the acts you saw
              there.
            </p>
          </div>
          <FestivalEditions gigs={festivalGigs} onOpenGig={onOpenGig} />
        </div>
      )}
    </div>
  );
}
