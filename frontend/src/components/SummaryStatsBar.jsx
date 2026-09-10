export default function SummaryStatsBar({ stats }) {
  const values = [
    ['Scrobbles', stats?.total_scrobbles],
    ['Artists', stats?.unique_artists],
    ['Loved tracks', stats?.loved_tracks],
  ]

  return (
    <div className="stats-bar" aria-label="Listening summary">
      {values.map(([label, value]) => (
        <div className="stat-block" key={label}>
          <strong>{Number(value || 0).toLocaleString()}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}