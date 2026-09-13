import LikeButton from './LikeButton'
import Artwork from './Artwork'
import EntryMenu from './EntryMenu'
import { Link } from 'react-router-dom'

function countWidth(count, maximum) {
  return { width: `${Math.max(8, (count / maximum) * 100)}%` }
}

const ENTITY_TYPES = { artists: 'artist', albums: 'album', tracks: 'track' }

export default function LibraryRankList({ entries = [], kind, token, page, pageSize, totalCount = 0, view, showArtwork = true, selectedKeys = new Set(), onToggleSelection, onEntryChanged }) {
  const maximum = Math.max(...entries.map((entry) => entry.play_count), 1)
  const heading = kind === 'artists' ? 'Artists scrobbled' : kind === 'albums' ? 'Albums scrobbled' : 'Tracks scrobbled'
  const entityType = ENTITY_TYPES[kind]

  return (
    <section className={`library-rank-panel library-rank-panel-${view}`} aria-labelledby={`${kind}-library-heading`}>
      <div className="library-rank-heading">
        <div>
          <p className="section-kicker">{heading}</p>
          <strong>{totalCount.toLocaleString()}</strong>
        </div>
        <span className="panel-meta">{entries.length} shown</span>
      </div>
      {entries.length === 0 ? <p className="notice">No listening data yet.</p> : (
        <ol className="library-rank-list" id={`${kind}-library-heading`}>
          {entries.map((entry, index) => {
            const selectionKey = `${entityType}:${entry.label}:${entry.secondary || ''}`
            return (
            <li className="library-rank-row" key={`${entry.label}-${entry.secondary || ''}`}>
              {onToggleSelection && entityType && (
                <label className="bulk-select-control">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(selectionKey)}
                    onChange={() => onToggleSelection({ key: selectionKey, entityType, name: entry.label, secondary: entry.secondary })}
                  />
                  <span>Select {entry.label}</span>
                </label>
              )}
              <div className="library-rank-media">
                <span className="library-rank-number">{(page - 1) * pageSize + index + 1}</span>
                {showArtwork && <Artwork className="library-row-artwork" src={entry.artwork_url} label={entry.label} />}
              </div>
              <span className="library-row-copy">
                <strong>{entry.label}</strong>
                {entry.secondary && <small>{entry.secondary}</small>}
              </span>
              <div className="library-rank-actions">
                {kind === 'tracks' && <LikeButton token={token} trackId={entry.spotify_track_id} initialLiked={entry.is_liked} />}
                <Link
                  className="library-count-bar"
                  style={countWidth(entry.play_count, maximum)}
                  to={`/library?filter_entity=${entityType}&filter_name=${encodeURIComponent(entry.label)}${entry.secondary ? `&filter_secondary=${encodeURIComponent(entry.secondary)}` : ''}`}
                  aria-label={`Show ${entry.play_count.toLocaleString()} scrobbles for ${entry.label}`}
                >
                  <span>{entry.play_count.toLocaleString()}{view === 'list' && ' scrobbles'}</span>
                </Link>
                {onEntryChanged && entityType && (
                  <EntryMenu
                    token={token}
                    entityType={entityType}
                    name={entry.label}
                    secondary={entry.secondary}
                    playCount={entry.play_count}
                    onChanged={onEntryChanged}
                  />
                )}
              </div>
            </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
