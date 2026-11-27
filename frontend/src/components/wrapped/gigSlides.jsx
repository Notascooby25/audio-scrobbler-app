import { Big, Chip } from "./Pieces";
import {
  MONTH_NAMES,
  MONTH_SHORT,
  distanceComparison,
  formatDay,
  formatNumber,
  formatShortDay,
  plural,
} from "./format";

export const GIGS_PER_PAGE = 6;

// Pages of at most six, with the gigs shared out evenly (13 gigs is 5, 4 and 4, not 6, 6 and 1).
export function gigPages(listed) {
  const pages = Math.ceil(listed / GIGS_PER_PAGE);
  return { pages, size: Math.ceil(listed / pages) };
}

export function GigsGlanceSlide({ gigs }) {
  const details = [
    `${formatNumber(gigs.artists)} different ${gigs.artists === 1 ? "artist" : "artists"}`,
    plural(gigs.venues, "venue"),
  ];
  if (gigs.festival_nights > 0) details.push(plural(gigs.festival_nights, "festival night"));
  return (
    <>
      <Chip>Your year live</Chip>
      <Big>{formatNumber(gigs.nights)}</Big>
      <p className="wrapped-line">
        {gigs.nights === 1 ? "gig" : "gigs"}: {details.join(", ")}.
      </p>
      {gigs.new_venues > 0 && (
        <p className="wrapped-note">{plural(gigs.new_venues, "venue")} new to you</p>
      )}
    </>
  );
}

// The gigs themselves, a page at a time, so nothing has to be cut short.
export function GigsListSlide({ gigs, page, pages, size }) {
  const list = gigs.gig_list.slice(page * size, (page + 1) * size);
  const hidden = gigs.nights - gigs.gig_list.length;
  const last = page === pages - 1;
  return (
    <>
      <Chip>{pages > 1 ? `Your gigs (${page + 1} of ${pages})` : "Your gigs"}</Chip>
      <ol className="wrapped-gigs">
        {list.map((gig) => (
          <li key={`${gig.date}-${gig.venue}`}>
            <span className="wrapped-gig-date">{formatShortDay(gig.date)}</span>
            <span className="wrapped-row-text">
              <span className="wrapped-row-name">{gig.artist}</span>
              <span className="wrapped-row-sub">
                {[gig.festival, gig.venue, gig.city].filter(Boolean).join(", ")}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {last && hidden > 0 && <p className="wrapped-note">and {hidden} more.</p>}
    </>
  );
}

export function GigsMilesSlide({ gigs }) {
  const { miles } = gigs;
  const comparison = distanceComparison(miles.total);
  return (
    <>
      <Chip>Miles travelled</Chip>
      <Big>{formatNumber(miles.total)}</Big>
      <p className="wrapped-line">miles there and back, as the crow flies.</p>
      {miles.furthest && (
        <p className="wrapped-line">
          Furthest: {miles.furthest.venue}, {miles.furthest.city} (
          {formatNumber(miles.furthest.miles)} miles from home).
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
      <Chip>Your gig calendar</Chip>
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
      <Chip>Your gig highlights</Chip>
      <ul className="wrapped-facts">
        {gigs.most_seen && (
          <li>
            Most seen:{" "}
            <strong>
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
