import { formatNumber, plural } from "./format";

export default function SummarySlide({ snapshot }) {
  const { year, music, gigs } = snapshot;
  return (
    <>
      <p className="wrapped-kicker">Your {year} in short</p>
      {music && (
        <>
          <ol className="wrapped-list">
            {music.top_artists.slice(0, 3).map((artist) => (
              <li key={artist.name}>
                <span className="wrapped-truncate">{artist.name}</span>
                <span className="wrapped-list-detail">{formatNumber(artist.plays)} plays</span>
              </li>
            ))}
          </ol>
          {music.top_songs[0] && (
            <p className="wrapped-line">
              Top song: <span className="wrapped-truncate">{music.top_songs[0].name}</span>
            </p>
          )}
          <p className="wrapped-line">
            About {formatNumber(music.estimated_minutes)} minutes of music.
          </p>
        </>
      )}
      {gigs && (
        <p className="wrapped-line">
          {plural(gigs.nights, "gig")}
          {gigs.miles && gigs.miles.total > 0 ? `, ${formatNumber(gigs.miles.total)} miles` : ""}.
        </p>
      )}
    </>
  );
}
