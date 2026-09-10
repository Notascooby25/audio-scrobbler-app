export default function BarTrendChart({ title, points = [], emptyMessage = 'No data available for this period.' }) {
  if (points.length === 0) {
    return (
      <section className="chart-panel">
        <p className="section-kicker">Live data</p>
        <h2>{title}</h2>
        <p className="notice">{emptyMessage}</p>
      </section>
    )
  }

  const maximum = Math.max(...points.map((point) => point.count), 1)
  const barWidth = 100 / points.length

  return (
    <section className="chart-panel" aria-label={`${title} chart`}>
      <p className="section-kicker">Live data</p>
      <h2>{title}</h2>
      <svg className="bar-trend-chart" viewBox="0 0 100 46" preserveAspectRatio="none" role="img" aria-label={`${title}: ${points.length} data points`}>
        {points.map((point, index) => {
          const height = Math.max((point.count / maximum) * 40, point.count > 0 ? 1.5 : 0.5)
          return (
            <rect
              key={point.label}
              className={point.count === maximum ? 'bar-trend-bar bar-trend-bar-peak' : 'bar-trend-bar'}
              x={index * barWidth + barWidth * 0.15}
              y={42 - height}
              width={barWidth * 0.7}
              height={height}
              rx="0.6"
            >
              <title>{`${point.label}: ${point.count} scrobbles`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="bar-trend-labels">
        <span>{points[0].label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)].label}</span>}
        <span>{points[points.length - 1].label}</span>
      </div>
    </section>
  )
}
