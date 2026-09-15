import LikeButton from './LikeButton'
import Artwork from './Artwork'
import EntryMenu from './EntryMenu'
import SourceBadge from './SourceBadge'
import { Link } from 'react-router-dom'

function countWidth(count, maximum) {
  return { width: `${Math.max(8, (count / maximum) * 100)}%` }
}

const ENTITY_TYPES = { artists: 'artist', albums: 'album', tracks: 'track' }

export default function LibraryRankList({
  entries = [],
  kind,
  token,
  page,
  pageSize,
  totalCount = 0,
  view,
  showArtwork = true,
  showSourceBadges = true,
  selectedKeys = new Set(),
  onToggleSelection,
  onEntryChanged,
  selectMode = false,
}) {
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
            const rankNumber = (page - 1) * pageSize + index + 1
            const selectionKey = `${entityType}:${entry.label}:${entry.secondary || ''}`
            const entityUrl = `/library?filter_entity=${entityType}&filter_name=${encodeURIComponent(entry.label)}${entry.secondary ? `&filter_secondary=${encodeURIComponent(entry.secondary)}` : ''}`

            if (view === 'grid') {
              const relativePercent = maximum > 0 ? (entry.play_count / maximum) * 100 : 0
              return (
                <li className="library-rank-row library-grid-card" key={`${entry.label}-${entry.secondary || ''}`}>
                  {selectMode && onToggleSelection && entityType && (
                    <label className="bulk-select-control grid-select-scrim">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(selectionKey)}
                        onChange={() => onToggleSelection({ key: selectionKey, entityType, name: entry.label, secondary: entry.secondary })}
                      />
                      <span>Select {entry.label}</span>
                    </label>
                  )}
                  {showArtwork && (
                    <div className="grid-card-artwork-wrap">
                      <Link to={entityUrl} tabIndex={-1} aria-hidden="true" className="grid-card-artwork-link">
                        <Artwork className="grid-card-artwork" src={entry.artwork_url} label={entry.label} />
                      </Link>
                      {showSourceBadges && entry.sources && entry.sources.length > 0 && (
                        <SourceBadge sources={entry.sources} size="grid" />
                      )}
                      {kind === 'tracks' && (
                        <div className="grid-card-like">
                          <LikeButton token={token} trackId={entry.spotify_track_id} initialLiked={entry.is_liked} />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid-card-body">
                    <div className="grid-card-heading">
                      <span className="grid-card-rank">{rankNumber}.</span>
                      <Link
                        className="grid-card-title"
                        to={entityUrl}
                        title={entry.label}
                      >
                        {entry.label}
                      </Link>
                      {!showArtwork && showSourceBadges && entry.sources && entry.sources.length > 0 && (
                        <SourceBadge sources={entry.sources} size="sm" />
                      )}
                    </div>
                    {entry.secondary && (
                      <span className="grid-card-artist" title={entry.secondary}>{entry.secondary}</span>
                    )}
                    <div className="grid-card-footer">
                      <span className="grid-card-count">
                        <svg className="grid-card-count-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                        <span>{entry.play_count.toLocaleString()} scrobbles</span>
                      </span>
                      <div className="grid-card-bar-track" aria-hidden="true">
                        <div
                          className="grid-card-bar-fill"
                          data-testid="grid-card-bar-fill"
                          style={{ width: `${relativePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              )
            }

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
                  <span className="library-rank-number">{rankNumber}</span>
                  {showArtwork && <Artwork className="library-row-artwork" src={entry.artwork_url} label={entry.label} />}
                </div>
                <span className="library-row-copy">
                  <strong>{entry.label}</strong>
                  <span className="library-row-subtitle">
                    {entry.secondary && <small>{entry.secondary}</small>}
                    {showSourceBadges && entry.sources && entry.sources.length > 0 && (
                      <SourceBadge sources={entry.sources} size="sm" />
                    )}
                  </span>
                </span>
                <div className="library-rank-actions">
                  {kind === 'tracks' && <LikeButton token={token} trackId={entry.spotify_track_id} initialLiked={entry.is_liked} />}
                  <Link
                    className="library-count-bar"
                    style={countWidth(entry.play_count, maximum)}
                    to={entityUrl}
                    aria-label={`Show ${entry.play_count.toLocaleString()} scrobbles for ${entry.label}`}
                  >
                    <span>{entry.play_count.toLocaleString()}{view === 'list' && <span className="library-count-suffix"> scrobbles</span>}</span>
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
