import { Chip, CoverList, playsDetail } from "./Pieces";
import { formatNumber, plural } from "./format";

export default function SummarySlide({ snapshot }) {
  const { year, music, gigs } = snapshot;
  return (
    <>
      <Chip>Your {year} in short</Chip>
      {music && (
        <>
          <CoverList items={music.top_artists.slice(0, 3)} detail={playsDetail} />
          {music.top_songs[0] && (
            <p className="wrapped-line">
              Top song: <strong>{music.top_songs[0].name}</strong>
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
