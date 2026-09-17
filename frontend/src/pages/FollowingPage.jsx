import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchFollowing } from '../api'
import { readSession } from '../session'

export default function FollowingPage() {
  const session = readSession()
  const [results, setResults] = useState([])
  const [status, setStatus] = useState(session?.accessToken ? 'loading' : 'idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.accessToken) return
    fetchFollowing({ token: session.accessToken })
      .then((data) => {
        setResults(data.results)
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(requestError.message)
        setStatus('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      {status === 'ready' && results.length === 0 && (
        <p className="notice">You're not following anyone yet. Find a user's profile and follow them to see their listening history here.</p>
      )}
      {status === 'ready' && results.length > 0 && (
        <ul className="blocked-list">
          {results.map((user) => (
            <li key={user.id}>
              <span className="blocked-copy">
                <strong>{user.display_name}</strong>
                <small>@{user.username}</small>
              </span>
              <Link className="settings-link" to={`/profile/${user.id}`}>View profile</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
