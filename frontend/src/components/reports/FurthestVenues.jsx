import { useState } from "react";
import { Link } from "react-router-dom";

/** Venues furthest from home. Each opens to every band you saw there. */
export default function FurthestVenues({ venues = [] }) {
  const [openKey, setOpenKey] = useState(null);

  return (
    <ol className="ranked-list furthest-venues">
      {venues.map((venue, index) => {
        const key = `${venue.venue_name}|${venue.city}|${venue.country}`;
        const isOpen = openKey === key;
        return (
          <li key={key} className="furthest-venue">
            <div className="furthest-venue-row">
              <span className="rank-number">{index + 1}</span>
              <button
                type="button"
                className="sfm-link furthest-venue-toggle"
                aria-expanded={isOpen}
                onClick={() => setOpenKey(isOpen ? null : key)}
              >
                <strong>{venue.venue_name}</strong>
                <small>
                  {venue.city}, {venue.country} · {venue.gig_count}{" "}
                  {venue.gig_count === 1 ? "gig" : "gigs"}
                  {venue.approximate ? " · approximate" : ""}
                </small>
              </button>
              <span className="rank-count">{venue.distance_km.toLocaleString()} km</span>
            </div>
            {isOpen && (
              <ul className="furthest-venue-gigs">
                {venue.gigs.map((gig) => (
                  <li key={gig.id}>
                    <Link to={`/gigs/${gig.id}`}>{gig.artist_name}</Link>
                    <small> · {gig.date}</small>
                  </li>
                ))}
                {venue.gig_count > venue.gigs.length && (
                  <li>
                    <small>and {venue.gig_count - venue.gigs.length} more</small>
                  </li>
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
