import React from 'react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ListeningHeatmap({ points }) {
  if (!points || points.length === 0) return null

  // Map points to a 7x24 grid
  const dataMap = {}
  let maxCount = 0
  points.forEach(p => {
    dataMap[`${p.day}-${p.hour}`] = p.count
    if (p.count > maxCount) maxCount = p.count
  })

  const getLevel = (count) => {
    if (count === 0) return 0
    if (maxCount === 0) return 0
    const pct = count / maxCount
    if (pct <= 0.25) return 1
    if (pct <= 0.5) return 2
    if (pct <= 0.75) return 3
    return 4
  }

  const isPeak = (count) => count > 0 && count === maxCount

  return (
    <div className="heatmap-container">
      <div className="heatmap-body">
        <div className="heatmap-y-axis">
          {DAYS.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="heatmap-grid">
          {Array.from({ length: 7 }).map((_, d) => (
            Array.from({ length: 24 }).map((_, h) => {
              const count = dataMap[`${d}-${h}`] || 0
              const level = getLevel(count)
              const peakClass = isPeak(count) ? 'peak' : ''
              return (
                <div 
                  key={`${d}-${h}`} 
                  className={`heatmap-cell ${peakClass}`} 
                  data-level={level}
                  title={`${DAYS[d]} ${h}:00 - ${count} scrobbles`}
                ></div>
              )
            })
          ))}
        </div>
      </div>
      <div className="heatmap-x-axis">
        <div className="heatmap-x-label">12am</div>
        <div className="heatmap-x-label">6am</div>
        <div className="heatmap-x-label">12pm</div>
        <div className="heatmap-x-label">6pm</div>
      </div>
    </div>
  )
}
