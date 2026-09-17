import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchFollowing, searchUsers } from '../api'
import { readSession } from '../session'

export default function FollowingPage() {
  const session = readSession()
  const [following, setFollowing] = useState([])
  const [discover, setDiscover] = useState([])
  const [status, setStatus] = useState(session?.accessToken ? 'loading' : 'idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.accessToken) return
    Promise.all([
      fetchFollowing({ token: session.accessToken }),
      searchUsers({ token: session.accessToken, query: '' })
    ])
      .then(([followingData, discoverData]) => {
        setFollowing(followingData.results)
        // Filter out users we are already following, and ourselves (we can rely on the fact that following isn't self)
        const followingIds = new Set(followingData.results.map(u => u.id))
        setDiscover(discoverData.results.filter(u => !followingIds.has(u.id) && u.id !== session?.userId))
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(requestError.message)
        setStatus('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      <div className="section-heading">
        <div>
          <p className="section-kicker">Personal archive</p>
          <h2 id="following-heading">Following</h2>
        </div>
      </div>

      {!session?.accessToken && <p className="notice">Sign in to see who you follow.</p>}
      {status === 'loading' && <p className="notice">Loading...</p>}
      {status === 'error' && <p className="notice notice-error" role="alert">{error}</p>}
      
      {status === 'ready' && (
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
    </section>
  )
}
