import GigRows from "./GigRows";
import RankedBarList from "./RankedBarList";

function venueLine(gig) {
  return [gig.venue, gig.city].filter(Boolean).join(", ");
}

// A festival gig sits alongside its venue: "Victorious Festival · Castle Stage, Portsmouth"
function gigTitle(gig) {
  return [gig.festival_name, venueLine(gig)].filter(Boolean).join(" · ");
}

export default function ArtistsSeenLeaderboard({ artists = [], onOpenGig = null }) {
  const items = artists.map((artist) => ({
    key: artist.artist_name,
    label: artist.artist_name,
    count: artist.count,
    detail:
      artist.gigs && artist.gigs.length > 0 ? (
        <GigRows
          rows={artist.gigs.map((gig) => ({
            key: gig.id,
            date: gig.event_date || gig.date,
            title: gigTitle(gig),
            meta: [gig.date, gig.song_count > 0 ? `${gig.song_count} songs` : null]
              .filter(Boolean)
              .join(" · "),
            tag: gig.is_support ? "Support" : null,
            tagMuted: true,
            onOpen: onOpenGig ? () => onOpenGig(gig.id) : null,
          }))}
        />
      ) : null,
  }));

  return (
    <div>
      <div className="sfm-section-head">
        <h2>Artists</h2>
        <p className="sfm-section-desc">
          This table shows how often you&apos;ve seen an artist, sorted by times seen followed by
          most recently seen.
        </p>
      </div>
      <RankedBarList
        items={items}
        noun="artists"
        idPrefix="artists"
        emptyText="No artists seen recorded yet."
      />
    </div>
  );
}
