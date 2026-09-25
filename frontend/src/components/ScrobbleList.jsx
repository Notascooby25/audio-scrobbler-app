import Artwork from './Artwork'
import SourceBadge from './SourceBadge'

export default function ScrobbleList({ scrobbles }) {
  if (!scrobbles || scrobbles.length === 0) return null

  return (
    <section className="scrobble-list" aria-labelledby="scrobble-list-heading">
      <h3 id="scrobble-list-heading">Recent scrobbles</h3>
      <ul>
        {scrobbles.map((scrobble) => (
          <li className="scrobble-row" key={scrobble.id}>
            <Artwork className="scrobble-artwork" src={scrobble.artwork_url} label={scrobble.track_name} />
            <SourceBadge source={scrobble.source} size="sm" />
            <span className="scrobble-copy">
              <strong className="scrobble-track">{scrobble.track_name}</strong>
              <small className="scrobble-artist">{scrobble.artist_name}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
