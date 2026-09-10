export default function TimelineChart({ entries = [] }) {
  const max = Math.max(...entries.map((entry) => entry.count), 1)
  return (
    <section className="timeline-panel">
      <div className="section-heading">
        <h2>Scrobbles by year</h2>
      </div>
      {entries.length === 0 ? <p className="notice">No timeline data yet.</p> : (
        <div className="timeline-chart" aria-label="Scrobbles by year">
          {entries.map((entry) => (
            <div className="timeline-column" key={entry.period}>
              <div className="timeline-bar" style={{ height: `${Math.max((entry.count / max) * 100, 4)}%` }} title={`${entry.period}: ${entry.count}`} />
              <span>{entry.period}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}