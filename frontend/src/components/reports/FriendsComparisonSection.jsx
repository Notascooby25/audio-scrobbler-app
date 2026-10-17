import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { fetchFriendsComparison } from '../../api'

export default function FriendsComparisonSection({ token, dateRange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError('')

    fetchFriendsComparison({ token, dateRange })
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load friends comparison.')
        setLoading(false)
      })
  }, [token, dateRange])

  if (loading) {
    return (
      <div className="friends-comparison-container" aria-busy="true">
        <p className="notice">Loading friends comparison...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="friends-comparison-container">
        <p className="notice notice-error" role="alert">{error}</p>
      </div>
    )
  }

  if (!data?.has_friends) {
    return (
      <div className="friends-comparison-container">
        <div className="friends-card friends-card-empty">
          <h3>No followed friends yet.</h3>
          <p className="secondary-text">
            Compare your listening habits, shared artists, and weekly minutes with friends.
          </p>
          <Link to="/following" className="button button-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
            Find and follow friends
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="friends-comparison-container">
      <div className="friends-comparison-header">
        <h2 className="friends-comparison-title">With Friends</h2>
        <span className="friends-comparison-subtitle">Shared music and circle activity</span>
      </div>

      <div className="friends-comparison-grid">
        {/* Card 1: Top Artists */}
        <div className="friends-card">
          <div className="friends-card-header">
            <h3>Top Artists with Friends</h3>
          </div>
          {data.top_artists.length === 0 ? (
            <p className="secondary-text empty-message">No shared artists played this period.</p>
          ) : (
            <div className="friends-list">
              {data.top_artists.map((artist, idx) => (
                <div key={artist.name} className="friends-list-row">
                  <div className="friends-item-main">
                    <span className="friends-rank">{idx + 1}</span>
                    <div className="friends-item-details">
                      <span className="friends-item-title">{artist.name}</span>
                      <span className="friends-item-breakdown">
                        {artist.contributions.map((c) => `${c.username} (${c.scrobbles})`).join(' · ')}
                      </span>
                    </div>
                  </div>
                  <span className="friends-item-total">{artist.total_scrobbles} scrobbles</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Top Songs */}
        <div className="friends-card">
          <div className="friends-card-header">
            <h3>Top Songs with Friends</h3>
          </div>
          {data.top_tracks.length === 0 ? (
            <p className="secondary-text empty-message">No shared songs played this period.</p>
          ) : (
            <div className="friends-list">
              {data.top_tracks.map((track, idx) => (
                <div key={`${track.name}-${track.artist_name || ''}`} className="friends-list-row">
                  <div className="friends-item-main">
                    <span className="friends-rank">{idx + 1}</span>
                    <div className="friends-item-details">
                      <span className="friends-item-title">{track.name}</span>
                      {track.artist_name && <span className="friends-item-subtitle">{track.artist_name}</span>}
                      <span className="friends-item-breakdown">
                        {track.contributions.map((c) => `${c.username} (${c.scrobbles})`).join(' · ')}
                      </span>
                    </div>
                  </div>
                  <span className="friends-item-total">{track.total_scrobbles} plays</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: Leaderboard */}
        <div className="friends-card">
          <div className="friends-card-header">
            <h3>Minutes Listened</h3>
          </div>
          <div className="friends-list">
            {data.leaderboard.map((entry) => (
              <div
                key={entry.user_id}
                className={`friends-list-row leaderboard-row ${entry.is_current_user ? 'leaderboard-current-user' : ''}`}
              >
                <div className="friends-item-main">
                  <span className="friends-rank">{entry.rank}</span>
                  <div className="friends-item-details">
                    <span className="friends-item-title">
                      {entry.username} {entry.is_current_user && <span className="badge-you">(You)</span>}
                    </span>
                    <span className="friends-item-breakdown">{entry.scrobbles} scrobbles</span>
                  </div>
                </div>
                <span className="friends-item-total leaderboard-minutes">{entry.minutes_listened} min</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

FriendsComparisonSection.propTypes = {
  token: PropTypes.string.isRequired,
  dateRange: PropTypes.object.isRequired,
}
