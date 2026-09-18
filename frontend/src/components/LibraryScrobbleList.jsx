import Artwork from './Artwork'
import LikedHeart from './LikedHeart'
import SourceBadge from './SourceBadge'
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

export default function LibraryScrobbleList({
  scrobbles = [],
  token,
  view,
  showSourceBadges = true,
  showArtwork = true,
  timestampMode = 'relative',
  filterLabel = null,
  selectedIds = new Set(),
  onToggleSelection,
  selectMode = false,
}) {
  const groups = scrobbles.reduce((result, scrobble) => {
    const label = dayLabel(scrobble.played_at)
    result[label] = [...(result[label] || []), scrobble]
    return result
  }, {})

  return (
    <section className={`library-scrobble-panel library-scrobble-panel-${view}`} aria-labelledby="scrobble-list-heading">
      <h2 id="scrobble-list-heading">Scrobbles</h2>
      {filterLabel && <p className="library-filter-label">Showing scrobbles for <strong>{filterLabel}</strong></p>}
      {scrobbles.length === 0 ? <p className="notice">No scrobbles found for this range.</p> : Object.entries(groups).map(([label, entries]) => (
        <div className="scrobble-day" key={label}>
          <h3>{label}</h3>
          <ul className="library-scrobble-list">
            {entries.map((scrobble) => (
              <li className="library-scrobble-row" key={scrobble.id}>
                {onToggleSelection && (view !== 'grid' || selectMode) && (
                  <label className="bulk-select-control scrobble-grid-select">
                    <input type="checkbox" checked={selectedIds.has(scrobble.id)} onChange={() => onToggleSelection(scrobble.id)} />
                    <span>Select {scrobble.track_name}</span>
                  </label>
                )}
                {showArtwork && <Artwork className="library-row-artwork scrobble-grid-artwork" src={scrobble.artwork_url} label={scrobble.track_name} />}
                <LikedHeart liked={scrobble.is_liked} className="scrobble-grid-heart" />
                <span className="library-row-copy">
                  <strong>{scrobble.track_name}</strong>
                  <small>{scrobble.artist_name}</small>
                </span>
                {showSourceBadges && <SourceBadge source={scrobble.source} size="sm" className="scrobble-grid-source" />}
                <time className="scrobble-grid-time" dateTime={scrobble.played_at}>{formatScrobbleTime(scrobble.played_at, Date.now(), timestampMode)}</time>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
