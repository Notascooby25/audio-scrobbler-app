import {
  MONTH_NAMES,
  MONTH_SHORT,
  distanceComparison,
  formatDay,
  formatNumber,
  plural,
} from "./format";

export function GigsGlanceSlide({ gigs }) {
  const details = [
    `${formatNumber(gigs.artists)} different ${gigs.artists === 1 ? "artist" : "artists"}`,
    plural(gigs.venues, "venue"),
  ];
  if (gigs.festival_nights > 0) details.push(plural(gigs.festival_nights, "festival night"));
  return (
    <>
      <p className="wrapped-kicker">Your year live</p>
      <p className="wrapped-big">{formatNumber(gigs.nights)}</p>
      <p className="wrapped-line">
        {gigs.nights === 1 ? "gig" : "gigs"}: {details.join(", ")}.
      </p>
      {gigs.new_venues > 0 && (
        <p className="wrapped-note">{plural(gigs.new_venues, "venue")} new to you</p>
      )}
    </>
  );
}

export function GigsMilesSlide({ gigs }) {
  const { miles } = gigs;
  const comparison = distanceComparison(miles.total);
  return (
    <>
      <p className="wrapped-kicker">Miles travelled</p>
      <p className="wrapped-big">{formatNumber(miles.total)}</p>
      <p className="wrapped-line">miles there and back, as the crow flies.</p>
      {miles.furthest && (
        <p className="wrapped-line">
          Furthest: <span className="wrapped-truncate">{miles.furthest.venue}</span>,{" "}
          {miles.furthest.city} ({formatNumber(miles.furthest.miles)} miles from home).
        </p>
      )}
      {comparison && <p className="wrapped-note">{comparison}</p>}
      {miles.left_out > 0 && (
        <p className="wrapped-note">
          {plural(miles.left_out, "gig")} left out, as the map doesn&apos;t know the venue.
        </p>
      )}
      {miles.by_city > 0 && (
        <p className="wrapped-note">Includes {miles.by_city} placed by city.</p>
      )}
    </>
  );
}

export function GigsCalendarSlide({ gigs }) {
  const active = new Set(gigs.months_with_gigs);
  const busiest = gigs.busiest_month;
  return (
    <>
      <p className="wrapped-kicker">Your gig calendar</p>
      <div className="wrapped-months">
        {MONTH_SHORT.map((label, index) => (
          <div
            key={label}
            className="wrapped-month"
            data-active={active.has(index + 1) ? "true" : "false"}
          >
            {label}
          </div>
        ))}
      </div>
      <p className="wrapped-line">
        Gigs in <strong>{active.size} of 12</strong> months. Busiest:{" "}
        {MONTH_NAMES[busiest.month - 1]} ({busiest.nights}).
      </p>
    </>
  );
}

export function GigsHighlightsSlide({ gigs }) {
  return (
    <>
      <p className="wrapped-kicker">Your gig highlights</p>
      <ul className="wrapped-facts">
        {gigs.most_seen && (
          <li>
            Most seen:{" "}
            <strong className="wrapped-truncate">
              {gigs.most_seen.artist} ({gigs.most_seen.times}x)
            </strong>
          </li>
        )}
        <li>First gig: {formatDay(gigs.first_night)}</li>
        <li>Last gig: {formatDay(gigs.last_night)}</li>
        {gigs.longest_gap_days != null && (
          <li>Longest gap: {plural(gigs.longest_gap_days, "day")}</li>
        )}
        {gigs.songs_heard_live > 0 && (
          <li>Songs heard live: {formatNumber(gigs.songs_heard_live)}</li>
        )}
      </ul>
    </>
  );
}
