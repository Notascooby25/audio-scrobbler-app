const CENTER = 50
const INNER_RADIUS = 16
const MAX_BAR = 26

function polar(hour, radius) {
  const angle = ((hour / 24) * 360 - 90) * (Math.PI / 180)
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)]
}

export default function ListeningClockChart({ points = [], emptyMessage = 'No data available for this period.' }) {
  const total = points.reduce((sum, point) => sum + point.count, 0)
  if (points.length === 0 || total === 0) {
    return (
      <section className="chart-panel">
        <p className="section-kicker">Live data</p>
        <h2>Listening clock</h2>
        <p className="notice">{emptyMessage}</p>
      </section>
    )
  }

  const maximum = Math.max(...points.map((point) => point.count), 1)
  const peakHour = points.reduce((best, point) => (point.count > best.count ? point : best), points[0])

  return (
    <section className="chart-panel" aria-label="Listening clock chart">
      <p className="section-kicker">Live data</p>
      <h2>Listening clock</h2>
      <svg className="listening-clock-chart" viewBox="0 0 100 100" role="img" aria-label={`Listening clock: busiest hour ${peakHour.label}:00`}>
        <circle className="clock-ring" cx={CENTER} cy={CENTER} r={INNER_RADIUS - 2} />
        {points.map((point) => {
          const hour = Number(point.label)
          const length = INNER_RADIUS + Math.max((point.count / maximum) * MAX_BAR, point.count > 0 ? 1.5 : 0.4)
          const [x1, y1] = polar(hour, INNER_RADIUS)
          const [x2, y2] = polar(hour, length)
          return (
            <line
              key={point.label}
              className={point.count === maximum ? 'clock-bar clock-bar-peak' : 'clock-bar'}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            >
              <title>{`${point.label}:00 — ${point.count} scrobbles`}</title>
            </line>
          )
        })}
        {[0, 6, 12, 18].map((hour) => {
          const [x, y] = polar(hour, INNER_RADIUS + MAX_BAR + 5)
          return <text key={hour} className="clock-label" x={x} y={y} textAnchor="middle" dominantBaseline="middle">{hour}</text>
        })}
      </svg>
      <p className="chart-caption">Busiest hour: <strong>{peakHour.label}:00</strong> with {peakHour.count} scrobbles</p>
    </section>
  )
}
