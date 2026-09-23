import Artwork from './Artwork'

const KIND_LABELS = { artists: 'Artists', albums: 'Albums', tracks: 'Tracks' }

function countWidth(count, maximum) {
  return { width: `${Math.max(8, (count / maximum) * 100)}%` }
}

export default function ShareCard({ entries = [], kind, layout, dateRangeLabel }) {
  const maximum = Math.max(...entries.map((entry) => entry.play_count), 1)
  const kindLabel = KIND_LABELS[kind] || 'Entries'

  return (
    <div className={`share-card share-card-${layout}`}>
      <div className="share-card-header">
        <span className="share-card-title">Top {kindLabel}</span>
        <span className="share-card-subtitle">{dateRangeLabel}</span>
      </div>

      {layout === 'grid' ? (
        <div className="library-rank-panel library-rank-panel-grid">
          <ol className="library-rank-list">
            {entries.map((entry, index) => {
              const relativePercent = maximum > 0 ? (entry.play_count / maximum) * 100 : 0
              return (
                <li className="library-rank-row library-grid-card" key={`${entry.label}-${entry.secondary || ''}`}>
                  <div className="grid-card-artwork-wrap">
                    <Artwork className="grid-card-artwork" src={entry.artwork_url} label={entry.label} crossOrigin="anonymous" />
                  </div>
                  <div className="grid-card-body">
                    <div className="grid-card-heading">
                      <span className="grid-card-rank">{index + 1}.</span>
                      <span className="grid-card-title">{entry.label}</span>
                    </div>
                    {entry.secondary && <span className="grid-card-artist">{entry.secondary}</span>}
                    <div className="grid-card-footer">
                      <span className="grid-card-count">{entry.play_count.toLocaleString()} scrobbles</span>
                      <div className="grid-card-bar-track" aria-hidden="true">
                        <div className="grid-card-bar-fill" style={{ width: `${relativePercent}%` }} />
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ) : (
        <ol className="library-rank-list share-card-list">
          {entries.map((entry, index) => (
            <li className="library-rank-row" key={`${entry.label}-${entry.secondary || ''}`}>
              <div className="library-rank-media">
                <span className="library-rank-number">{index + 1}</span>
                <Artwork className="library-row-artwork" src={entry.artwork_url} label={entry.label} crossOrigin="anonymous" />
              </div>
              <span className="library-row-copy">
                <strong>{entry.label}</strong>
                {entry.secondary && <span className="library-row-subtitle"><small>{entry.secondary}</small></span>}
              </span>
              <div className="library-rank-actions">
                <div className="library-count-bar" style={countWidth(entry.play_count, maximum)}>
                  <span>{entry.play_count.toLocaleString()}<span className="library-count-suffix"> scrobbles</span></span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="share-card-footer">Audio Scrobbler</div>
    </div>
  )
}
