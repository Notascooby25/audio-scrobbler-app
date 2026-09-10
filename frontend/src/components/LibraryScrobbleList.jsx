import LikeButton from './LikeButton'
import { formatScrobbleTime } from '../timeFormatting'

function dayLabel(value) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LibraryScrobbleList({ scrobbles = [], token, view, showSourceBadges = true, showArtwork = true, timestampMode = 'relative' }) {
  const groups = scrobbles.reduce((result, scrobble) => {
    const label = dayLabel(scrobble.played_at)
    result[label] = [...(result[label] || []), scrobble]
    return result
  }, {})

  return (
    <section className={`library-scrobble-panel library-scrobble-panel-${view}`} aria-labelledby="scrobble-list-heading">
      <h2 id="scrobble-list-heading">Scrobbles</h2>
      {scrobbles.length === 0 ? <p className="notice">No scrobbles found for this range.</p> : Object.entries(groups).map(([label, entries]) => (
        <div className="scrobble-day" key={label}>
          <h3>{label}</h3>
          <ul className="library-scrobble-list">
            {entries.map((scrobble) => (
              <li className="library-scrobble-row" key={scrobble.id}>
                {showArtwork && (scrobble.artwork_url ? <img className="library-row-artwork scrobble-grid-artwork" src={scrobble.artwork_url} alt="" /> : <span className="library-row-artwork library-row-artwork-empty scrobble-grid-artwork" aria-hidden="true" />)}
                <LikeButton token={token} trackId={scrobble.spotify_track_id} initialLiked={scrobble.is_liked} />
                <span className="library-row-copy">
                  <strong>{scrobble.track_name}</strong>
                  <small>{scrobble.artist_name}</small>
                </span>
                {showSourceBadges && <span className={`source-badge source-badge-${scrobble.source} scrobble-grid-source`}>{scrobble.source}</span>}
                <time className="scrobble-grid-time" dateTime={scrobble.played_at}>{formatScrobbleTime(scrobble.played_at, Date.now(), timestampMode)}</time>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
