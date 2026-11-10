import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

export default function Report1001Milestone({ challenge1001 }) {
  const completedInPeriod = challenge1001?.completed_in_period || 0
  const totalCompleted = challenge1001?.total_completed || 0
  const recentAlbums = challenge1001?.recent_albums || []
  const pct = ((totalCompleted / 1001) * 100).toFixed(1)

  return (
    <div className="report-crossover-card crossover-1001" aria-label="1001 Albums Challenge Milestone">
      <div className="crossover-header">
        <span className="crossover-badge badge-1001">1001 Albums Challenge</span>
        <span className="crossover-meta">{totalCompleted} / 1001 ({pct}%)</span>
      </div>
      <div className="crossover-title">
        {completedInPeriod} Completed This Period
      </div>
      <p className="crossover-desc">
        {completedInPeriod > 0
          ? `${completedInPeriod} albums from 1001 Albums You Must Hear Before You Die tackled:`
          : 'Tackle iconic albums from the 1001 challenge to expand your catalog:'}
      </p>
      <div className="crossover-chips">
        {recentAlbums.length > 0 ? (
          recentAlbums.map((album, idx) => (
            <Link
              key={idx}
              to="/jukebox"
              className="crossover-chip chip-1001"
              title={`View 1001 albums jukebox`}
            >
              💿 {album}
            </Link>
          ))
        ) : (
          <Link to="/jukebox" className="crossover-chip chip-1001">
            Browse 1001 Challenge in Jukebox →
          </Link>
        )}
      </div>
    </div>
  )
}

Report1001Milestone.propTypes = {
  challenge1001: PropTypes.shape({
    completed_in_period: PropTypes.number,
    total_completed: PropTypes.number,
    recent_albums: PropTypes.arrayOf(PropTypes.string),
  }),
}
