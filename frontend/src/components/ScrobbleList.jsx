import Artwork from "./Artwork";
import LikedHeart from "./LikedHeart";
import SourceBadge from "./SourceBadge";

export default function ScrobbleList({
  scrobbles,
  title = "Recent scrobbles",
  interactive = false,
  onToggleLike,
  likingKeys = new Set(),
}) {
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
            <LikedHeart
              liked={scrobble.is_liked}
              interactive={interactive}
              label={scrobble.track_name}
              busy={likingKeys.has(scrobble.id)}
              onToggle={onToggleLike ? () => onToggleLike(scrobble) : undefined}
            />
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
