import Artwork from './Artwork'

export default function RankedList({ title, entries = [], emptyMessage = 'No listening data yet.' }) {
  return (
    <section className="ranked-panel">
      <div className="section-heading">
        <h2>{title}</h2>
        <span className="panel-meta">{entries.length} shown</span>
      </div>
      {entries.length === 0 ? <p className="notice">{emptyMessage}</p> : (
        <ol className="ranked-list">
          {entries.map((entry, index) => (
            <li key={`${entry.label}-${entry.secondary || ''}`}>
              <span className="rank-number">{index + 1}</span>
              <Artwork className="rank-artwork" src={entry.artwork_url} label={entry.label} />
              <span className="rank-copy">
                <strong>{entry.label}</strong>
                {entry.secondary && <small>{entry.secondary}</small>}
              </span>
              <span className="rank-count">{entry.play_count.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}