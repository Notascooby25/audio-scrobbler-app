import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { fetchUserProfile, followUser, redirectToAuthorization, requestSpotifyAuthorization, unfollowUser } from '../api'
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
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [connectError, setConnectError] = useState('')

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
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

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
            <button type="button" onClick={connectSpotify}>Connect Spotify</button>
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
            <dl className="profile-stats">
              <div><dt>Followers</dt><dd>{profile.follower_count}</dd></div>
              <div><dt>Following</dt><dd>{profile.following_count}</dd></div>
            </dl>
            {!profile.is_self && (
              <FollowButton isFollowing={profile.is_following} onToggle={toggleFollow} disabled={status === 'loading'} />
            )}
            {profile.is_self && (
              <>
                <button type="button" onClick={connectSpotify}>Connect Spotify</button>
                <Link className="settings-link" to="/settings">Settings</Link>
              </>
            )}
            {profile.can_view_details && profile.last_scrobble && (
              <div className="last-scrobble">
                <p className="section-kicker">Last scrobbled</p>
                <p><strong>{profile.last_scrobble.track_name}</strong> by {profile.last_scrobble.artist_name}</p>
              </div>
            )}
          {!profile.can_view_details && <p className="notice">Follow this user to see their last scrobbled track.</p>}
        </div>
      )}
    </section>
  )
}
