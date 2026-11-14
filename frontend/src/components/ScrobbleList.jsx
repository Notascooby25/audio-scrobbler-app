import Artwork from "./Artwork";
import LikedHeart from "./LikedHeart";
import RecommendButton from "./recommend/RecommendButton";
import SourceBadge from "./SourceBadge";
import { readSession } from "../session";

export default function ScrobbleList({
  scrobbles,
  title = "Recent scrobbles",
  interactive = false,
  onToggleLike,
  likingKeys = new Set(),
}) {
  const session = readSession();
  if (!scrobbles || scrobbles.length === 0) return null;

  return (
    <section className="scrobble-list" aria-labelledby="scrobble-list-heading">
      <h3 id="scrobble-list-heading">{title}</h3>
      <ul>
        {scrobbles.map((scrobble) => (
          <li className="scrobble-row" key={scrobble.id}>
            <Artwork
              className="scrobble-artwork"
              src={scrobble.artwork_url}
              label={scrobble.track_name}
            />
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              {session?.accessToken && (
                <RecommendButton
                  token={session.accessToken}
                  item={{
                    itemType: "track",
                    title: scrobble.track_name,
                    artist: scrobble.artist_name,
                    album: scrobble.album_name,
                    imageUrl: scrobble.artwork_url,
                    spotifyUri: scrobble.spotify_uri,
                    spotifyTrackId: scrobble.spotify_track_id,
                  }}
                />
              )}
              <LikedHeart
                liked={scrobble.is_liked}
                interactive={interactive}
                label={scrobble.track_name}
                busy={likingKeys.has(scrobble.id)}
                onToggle={onToggleLike ? () => onToggleLike(scrobble) : undefined}
              />
            </div>
            <SourceBadge source={scrobble.source} size="sm" />
            <span className="scrobble-copy">
              <strong className="scrobble-track">{scrobble.track_name}</strong>
              <small className="scrobble-artist">{scrobble.artist_name}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
