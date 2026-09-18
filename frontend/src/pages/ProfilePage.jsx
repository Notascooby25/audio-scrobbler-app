import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { fetchSpotifyStatus, fetchUserProfile, fetchNowPlaying, followUser, redirectToAuthorization, requestSpotifyAuthorization, unfollowUser } from '../api'
import FollowButton from '../components/FollowButton'

function readSavedSession() {
  try {
    return JSON.parse(localStorage.getItem('audio-scrobbler-session') || 'null')
  } catch {
    return null
  }
}

export default function ProfilePage() {
  const { userId: routeUserId } = useParams()
  const savedSession = readSavedSession()
  const token = savedSession?.accessToken
  const targetUserId = routeUserId ? Number(routeUserId) : savedSession?.userId

  const [profile, setProfile] = useState(null)
  const [nowPlaying, setNowPlaying] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [connectError, setConnectError] = useState('')
  const [spotifyRetryAfter, setSpotifyRetryAfter] = useState(null)

  useEffect(() => {
    fetchSpotifyStatus()
      .then((result) => setSpotifyRetryAfter(result.rate_limited ? result.retry_after : null))
      .catch(() => {})
  }, [])

  const loadProfile = async () => {
    if (!token || !targetUserId) {
      setStatus('idle')
      return
    }
    setStatus('loading')
    setError('')
    try {
      const data = await fetchUserProfile({ token, userId: targetUserId })
      setProfile(data)
      try {
        const npData = await fetchNowPlaying({ token, userId: targetUserId })
        setNowPlaying(npData)
      } catch (npError) {
        // Ignore now playing errors silently
        console.error("Failed to load now playing", npError)
      }
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

  // Poll now playing every 10 seconds
  useEffect(() => {
    if (!token || !targetUserId || status !== 'ready') return
    const interval = setInterval(async () => {
      try {
        const npData = await fetchNowPlaying({ token, userId: targetUserId })
        setNowPlaying(npData)
      } catch (npError) {
        // ignore
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [token, targetUserId, status])

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, targetUserId])

  const connectSpotify = async () => {
    setConnectError('')
    try {
      const { authorization_url: authorizationUrl } = await requestSpotifyAuthorization()
      redirectToAuthorization(authorizationUrl)
    } catch (requestError) {
      setConnectError(requestError.message)
    }
  }

  const toggleFollow = async () => {
    if (!profile) return
    setStatus('loading')
    try {
      const action = profile.is_following ? unfollowUser : followUser
      const result = await action({ token, userId: targetUserId })
      setProfile({ ...profile, is_following: result.following, follower_count: result.follower_count })
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

  return (
    <section className="dashboard" aria-labelledby="profile-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Personal archive</p>
          <h2 id="profile-heading">Profile</h2>
        </div>
      </div>

        {!token && (
          <div className="profile-connect">
            <p className="notice">Sign in from the dashboard, or connect Spotify to create your profile.</p>
            <button type="button" onClick={connectSpotify} disabled={Boolean(spotifyRetryAfter)}>Connect Spotify</button>
            {spotifyRetryAfter && (
              <p className="notice">Spotify is rate-limiting this app. Try again after {new Date(spotifyRetryAfter).toLocaleTimeString()}.</p>
            )}
            {connectError && <p className="notice notice-error" role="alert">{connectError}</p>}
          </div>
        )}

        {token && !targetUserId && <p className="notice">Sign in from the dashboard to view your profile.</p>}

        {token && targetUserId && status === 'loading' && <p className="notice">Loading profile...</p>}
        {token && targetUserId && status === 'error' && <p className="notice notice-error" role="alert">{error}</p>}

        {token && targetUserId && profile && (
          <div className="profile-card">
            <h3 className="profile-username">@{profile.username}</h3>
            <p className="profile-display-name">{profile.display_name}</p>
            
            {nowPlaying && nowPlaying.is_playing && (
              <div className="now-playing-banner" style={{ background: 'var(--green-900)', color: '#fff', padding: '1rem', borderRadius: '8px', margin: '1rem 0' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--green-300)' }}>Now Playing</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem' }}>
                  <strong>{nowPlaying.track_name}</strong> by {nowPlaying.artist_name}
                </p>
              </div>
            )}
            
            <dl className="profile-stats">
              <div><dt>Followers</dt><dd>{profile.follower_count}</dd></div>
              <div><dt>Following</dt><dd>{profile.following_count}</dd></div>
            </dl>
            {!profile.is_self && (
              <FollowButton isFollowing={profile.is_following} onToggle={toggleFollow} disabled={status === 'loading'} />
            )}
            {profile.is_self && (
              <>
                <button type="button" onClick={connectSpotify} disabled={Boolean(spotifyRetryAfter)}>Connect Spotify</button>
                {spotifyRetryAfter && (
                  <p className="notice">Spotify is rate-limiting this app. Try again after {new Date(spotifyRetryAfter).toLocaleTimeString()}.</p>
                )}
                <Link className="settings-link" to="/settings">Settings</Link>
              </>
            )}
            {profile.can_view_details && profile.last_scrobble && (
              <div className="last-scrobble">
                <p className="section-kicker">Last scrobbled</p>
                <p><strong>{profile.last_scrobble.track_name}</strong> by {profile.last_scrobble.artist_name}</p>
              </div>
            )}
            {profile.can_view_details && (
              <nav className="profile-actions" aria-label={`${profile.username}'s listening history`}>
                <Link to={profile.is_self ? '/library' : `/library?userId=${profile.id}`}>View Library</Link>
                <Link to={profile.is_self ? '/reports?range=last.week' : `/reports?userId=${profile.id}&range=last.week`}>View Last 7 Days</Link>
                <Link to={profile.is_self ? '/reports?range=last.month' : `/reports?userId=${profile.id}&range=last.month`}>View Last Month</Link>
                <Link to={profile.is_self ? '/reports?range=last.year' : `/reports?userId=${profile.id}&range=last.year`}>View Last Year</Link>
              </nav>
            )}
          {!profile.can_view_details && <p className="notice">Follow this user to see their last scrobbled track.</p>}
        </div>
      )}
    </section>
  )
}
