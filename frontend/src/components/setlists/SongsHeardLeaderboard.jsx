import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import GigRows from "./GigRows";
import RankedBarList from "./RankedBarList";
import { parseDateParts } from "./SetlistDateBadge";

const sortName = (name) => name.replace(/^the\s+/i, "").toLowerCase();

function gigYear(gig) {
  return parseDateParts(gig.event_date || gig.date).year;
}

export default function SongsHeardLeaderboard({ songs = [], onOpenGig = null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const year = searchParams.get("year");
  const artist = searchParams.get("artist");

  const setFilter = (changes) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.delete("page");
    params.delete("open");
    setSearchParams(params, { replace: true });
    setShowFilters(false);
  };

  // Sidebar counts are concerts, as on setlist.fm
  const allGigs = new Map();
  songs.forEach((song) => (song.gigs || []).forEach((gig) => allGigs.set(gig.id, gig)));
  const yearCounts = {};
  const artistCounts = {};
  allGigs.forEach((gig) => {
    const y = gigYear(gig);
    yearCounts[y] = (yearCounts[y] || 0) + 1;
    artistCounts[gig.artist_name] = (artistCounts[gig.artist_name] || 0) + 1;
  });
  const years = Object.keys(yearCounts).sort((a, b) => b.localeCompare(a));
  const artists = Object.keys(artistCounts).sort((a, b) => sortName(a).localeCompare(sortName(b)));

  // With a year filter the count becomes the number of that year's gigs featuring the song
  const filtered = songs
    .filter((song) => !artist || song.artist_name === artist)
    .map((song) => {
      if (!year) return song;
      const gigs = (song.gigs || []).filter((gig) => gigYear(gig) === year);
      return { ...song, gigs, count: gigs.length };
    })
    .filter((song) => song.count > 0)
    .sort((a, b) => b.count - a.count);

  const items = filtered.map((song) => ({
    key: `${song.track_name}|${song.artist_name}`,
    label: song.track_name,
    sub: artist ? null : song.artist_name,
    count: song.count,
    detail:
      song.gigs && song.gigs.length > 0 ? (
        <GigRows
          rows={song.gigs.map((gig) => ({
            key: gig.id,
            date: gig.event_date || gig.date,
            title: [gig.festival_name || gig.venue_name, gig.city].filter(Boolean).join(", "),
            meta: gig.artist_name,
            onOpen: onOpenGig ? () => onOpenGig(gig.id) : null,
          }))}
        />
      ) : null,
  }));

  const heading = artist
    ? `Songs at ${artist} concerts${year ? ` in ${year}` : ""}`
    : year
      ? `Songs heard in ${year}`
      : "Total songs";

  const filterLink = (label, count, isCurrent, onClick) => (
    <li key={label}>
      <button
        type="button"
        className={`sfm-link ${isCurrent ? "is-current" : ""}`}
        aria-pressed={isCurrent}
        onClick={onClick}
      >
        {label}
      </button>{" "}
      ({count})
    </li>
  );

  return (
    <div className="sfm-split">
      <aside className="sfm-sidebar" aria-label="Filter songs">
        <button
          type="button"
          className="sfm-link sfm-sidebar-toggle"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          {showFilters ? "Hide filters" : "Filter by year or artist"}
          {(year || artist) && ` (${[artist, year].filter(Boolean).join(", ")})`}
        </button>
        <div className={`sfm-sidebar-body ${showFilters ? "is-open" : ""}`}>
          <div className="sfm-sidebar-group">
            <h3>All Concerts</h3>
            <ul>
              {filterLink("All setlist songs", allGigs.size, !year && !artist, () =>
                setFilter({ year: null, artist: null })
              )}
            </ul>
          </div>
          {years.length > 0 && (
            <div className="sfm-sidebar-group">
              <h3>Years on Concerts</h3>
              <ul>
                {years.map((y) =>
                  filterLink(y, yearCounts[y], year === y, () =>
                    setFilter({ year: year === y ? null : y })
                  )
                )}
              </ul>
            </div>
          )}
          {artists.length > 0 && (
            <div className="sfm-sidebar-group">
              <h3>Artists</h3>
              <ul>
                {artists.map((a) =>
                  filterLink(a, artistCounts[a], artist === a, () =>
                    setFilter({ artist: artist === a ? null : a })
                  )
                )}
              </ul>
            </div>
          )}
        </div>
      </aside>

      <div className="sfm-split-main">
        <div className="sfm-section-head">
          <h2>{heading}</h2>
          <p className="sfm-section-desc">
            This table lists how often a song was performed. Multiple performances from the same
            setlist are also counted towards the total.
          </p>
        </div>
        <RankedBarList
          items={items}
          noun="songs"
          idPrefix="songs"
          headings={["Song", "Song Performances"]}
          emptyText="No songs heard live recorded yet."
        />
      </div>
    </div>
  );
}
