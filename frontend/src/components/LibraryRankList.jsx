import LikeButton from './LikeButton'
import Artwork from './Artwork'
import EntryMenu from './EntryMenu'

function countWidth(count, maximum) {
  return { width: `${Math.max(8, (count / maximum) * 100)}%` }
}

const ENTITY_TYPES = { artists: 'artist', albums: 'album', tracks: 'track' }

export default function LibraryRankList({ entries = [], kind, token, page, pageSize, totalCount = 0, view, showArtwork = true, onEntryChanged }) {
  const maximum = Math.max(...entries.map((entry) => entry.play_count), 1)
  const heading = kind === 'artists' ? 'Artists scrobbled' : kind === 'albums' ? 'Albums scrobbled' : 'Tracks scrobbled'

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
          {entries.map((entry, index) => (
            <li className="library-rank-row" key={`${entry.label}-${entry.secondary || ''}`}>
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
                <span className="library-count-bar" style={countWidth(entry.play_count, maximum)}>
                  <span>{entry.play_count.toLocaleString()}{view === 'list' && ' scrobbles'}</span>
                </span>
                {onEntryChanged && ENTITY_TYPES[kind] && (
                  <EntryMenu
                    token={token}
                    entityType={ENTITY_TYPES[kind]}
                    name={entry.label}
                    secondary={entry.secondary}
                    playCount={entry.play_count}
                    onChanged={onEntryChanged}
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
