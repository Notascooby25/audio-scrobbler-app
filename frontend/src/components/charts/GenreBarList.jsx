import React from 'react'

export default function GenreBarList({ genres }) {
  if (!genres || genres.length === 0) return <p className="notice">No genre data available for this period. Background syncing may still be processing your recent listening.</p>
  const maxCount = Math.max(...genres.map(g => g.count))
  return (
    <ul className="genre-list">
      {genres.map(g => {
        const pct = maxCount > 0 ? (g.count / maxCount) * 100 : 0
        return (
          <li className="genre-row" key={g.label}>
            <div className="genre-label">{g.label}</div>
            <div className="genre-bar-container">
              <div className="genre-bar" style={{ width: `${pct}%` }}></div>
            </div>
            <div className="genre-count">{g.count.toLocaleString()}</div>
          </li>
        )
      })}
    </ul>
  )
}
