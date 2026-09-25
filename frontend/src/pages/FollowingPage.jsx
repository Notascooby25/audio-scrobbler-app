import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchFollowing, searchUsers, fetchLeaderboard } from '../api'
import { readSession } from '../session'
import DateRangeSelector from '../components/DateRangeSelector'

export default function FollowingPage() {
  const session = readSession()
  const [activeTab, setActiveTab] = useState('following')
  const [following, setFollowing] = useState([])
  const [discover, setDiscover] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [status, setStatus] = useState(session?.accessToken ? 'loading' : 'idle')
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState({ range: 'last.week', start_date: '', end_date: '', compare_to_previous: false })

  useEffect(() => {
    if (!session?.accessToken) return
    setStatus('loading')

    if (activeTab === 'following') {
      Promise.all([
        fetchFollowing({ token: session.accessToken }),
        searchUsers({ token: session.accessToken, query: '' })
      ])
        .then(([followingData, discoverData]) => {
          setFollowing(followingData.results)
          const followingIds = new Set(followingData.results.map(u => u.id))
          setDiscover(discoverData.results.filter(u => !followingIds.has(u.id) && u.id !== session?.userId))
          setStatus('ready')
        })
        .catch((requestError) => {
          setError(requestError.message)
          setStatus('error')
        })
    } else if (activeTab === 'leaderboard') {
      fetchLeaderboard({ token: session.accessToken, dateRange })
        .then((data) => {
          setLeaderboard(data.results)
          setStatus('ready')
        })
        .catch((requestError) => {
          setError(requestError.message)
          setStatus('error')
        })
    }
  }, [activeTab, dateRange, session?.accessToken, session?.userId])

  const renderUser = (user) => (
    <li key={user.id}>
      <span className="blocked-copy">
        <strong>{user.display_name}</strong>
        <small>@{user.username}</small>
        {user.last_scrobble && (
          <small style={{ marginTop: '0.25rem', color: 'var(--color-text-muted)' }}>
            Last listened to: <em>{user.last_scrobble.track_name}</em> by {user.last_scrobble.artist_name}
          </small>
        )}
      </span>
      <Link className="settings-link" to={`/profile/${user.id}`}>View profile</Link>
    </li>
  )

  return (
    <section className="dashboard" aria-labelledby="following-heading">
      <div className="section-heading" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <p className="section-kicker">Community</p>
          <h2 id="following-heading">Following & Leaderboards</h2>
        </div>
        
        <div className="library-segmented-group">
          <div className="segmented-tabs" role="tablist" aria-label="Following tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'following'}
              className={`segmented-tab ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => setActiveTab('following')}
            >
              Following
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'leaderboard'}
              className={`segmented-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('leaderboard')}
            >
              Leaderboard
            </button>
          </div>
        </div>
      </div>

      {!session?.accessToken && <p className="notice">Sign in to see who you follow.</p>}
      
      {session?.accessToken && activeTab === 'leaderboard' && (
        <div style={{ marginBottom: '2rem' }}>
          <DateRangeSelector value={dateRange} onChange={setDateRange} showCompare={false} />
        </div>
      )}

      {status === 'loading' && <p className="notice">Loading...</p>}
      {status === 'error' && <p className="notice notice-error" role="alert">{error}</p>}
      
      {status === 'ready' && activeTab === 'following' && (
        <>
          {following.length === 0 ? (
            <p className="notice">You're not following anyone yet.</p>
          ) : (
            <ul className="blocked-list">
              {following.map(renderUser)}
            </ul>
          )}

          {discover.length > 0 && (
            <div style={{ marginTop: '3rem' }}>
              <div className="section-heading">
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Discover Users</h3>
              </div>
              <ul className="blocked-list">
                {discover.map(renderUser)}
              </ul>
            </div>
          )}
        </>
      )}

      {status === 'ready' && activeTab === 'leaderboard' && (
        <>
          {leaderboard.length === 0 ? (
            <p className="notice">No listening data for this period.</p>
          ) : (
            <ul className="blocked-list">
              {leaderboard.map((item, index) => (
                <li key={item.user.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '24px', textAlign: 'center', fontWeight: '600', color: 'var(--color-text-muted)' }}>
                      {index + 1}
                    </div>
                    <span className="blocked-copy">
                      <strong>{item.user.display_name} {item.user.id === session?.userId ? '(You)' : ''}</strong>
                      <small>@{item.user.username}</small>
                      <small style={{ marginTop: '0.25rem', color: 'var(--color-text-muted)' }}>
                        {item.scrobble_count.toLocaleString()} scrobbles • {item.unique_artists.toLocaleString()} artists
                      </small>
                    </span>
                  </div>
                  <Link className="settings-link" to={`/profile/${item.user.id}`}>View profile</Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
