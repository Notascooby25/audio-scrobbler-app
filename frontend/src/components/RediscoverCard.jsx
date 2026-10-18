import { useEffect, useState } from 'react'
import Artwork from './Artwork'
import { createRediscoverPlaylist, fetchRediscoverTracks } from '../api'

export default function RediscoverCard({ token }) {
  const [mode, setMode] = useState('forgotten')
  const [tracks, setTracks] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [saveError, setSaveError] = useState('')

  const loadTracks = (currentMode) => {
    if (!token) return
    setStatus('loading')
    setError('')
    fetchRediscoverTracks({ token, mode: currentMode, limit: 12 })
      .then((data) => {
        setTracks(data?.tracks || [])
        setStatus('ready')
      })
      .catch((err) => {
        setError(err.message || 'Failed to load tracks')
        setStatus('error')
      })
  }

  useEffect(() => {
    loadTracks(mode)
  }, [token, mode])

  const handleModeChange = (newMode) => {
    if (newMode === mode) return
    setSaveResult(null)
    setSaveError('')
    setMode(newMode)
  }

  const handleSavePlaylist = async () => {
    if (!token || tracks.length === 0 || saving) return
    setSaving(true)
    setSaveError('')
    setSaveResult(null)
    try {
      const res = await createRediscoverPlaylist({ token, mode })
      setSaveResult(res)
    } catch (err) {
      setSaveError(err.message || 'Failed to create playlist on Spotify.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rediscover-card" aria-labelledby="rediscover-heading">
      <div className="rediscover-header">
        <div className="rediscover-title-area">
          <h2 id="rediscover-heading">Time Capsule & Rediscover</h2>
          <p className="rediscover-subtitle">
            {mode === 'forgotten'
              ? "Past favorites with multiple plays you haven't listened to in 90+ days."
              : 'Tracks you were listening to around this week in previous years.'}
          </p>
        </div>
        <div className="rediscover-controls">
          <div className="rediscover-tabs" role="tablist" aria-label="Rediscover mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'forgotten'}
              className={`rediscover-tab-btn ${mode === 'forgotten' ? 'active' : ''}`}
              onClick={() => handleModeChange('forgotten')}
            >
              Forgotten Favorites
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'anniversary'}
              className={`rediscover-tab-btn ${mode === 'anniversary' ? 'active' : ''}`}
              onClick={() => handleModeChange('anniversary')}
            >
              On This Day
            </button>
          </div>
          <button
            type="button"
            className="rediscover-save-btn"
            disabled={saving || status === 'loading' || tracks.length === 0}
            onClick={handleSavePlaylist}
          >
            {saving ? 'Creating Playlist...' : 'Save to Spotify'}
          </button>
        </div>
      </div>

      {saveResult && (
        <div className="rediscover-success-banner" role="status">
          <span>
            Created playlist{' '}
            <a href={saveResult.playlist_url} target="_blank" rel="noopener noreferrer">
              <strong>{saveResult.playlist_name}</strong>
            </a>{' '}
            with {saveResult.track_count} tracks.
          </span>
          <button
            type="button"
            className="rediscover-dismiss-btn"
            aria-label="Dismiss message"
            onClick={() => setSaveResult(null)}
          >
            ✕
          </button>
        </div>
      )}

      {saveError && (
        <p className="notice notice-error" role="alert">
          {saveError}
        </p>
      )}

      {status === 'loading' && <p className="notice">Finding tracks in your archive...</p>}

      {status === 'error' && (
        <div className="notice notice-error" role="alert">
          {error}{' '}
          <button type="button" className="retry-btn" onClick={() => loadTracks(mode)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && tracks.length === 0 && (
        <p className="notice">
          {mode === 'forgotten'
            ? "No forgotten favorites yet — keep listening and they'll appear here as your archive grows!"
            : 'No scrobbles found for this calendar week in previous years.'}
        </p>
      )}

      {status === 'ready' && tracks.length > 0 && (
        <ul className="rediscover-list">
          {tracks.map((track) => (
            <li
              key={`${track.artist_name}-${track.track_name}-${track.track_id}`}
              className="rediscover-item"
            >
              <Artwork
                className="rediscover-artwork"
                src={track.artwork_url}
                label={track.track_name}
              />
              <div className="rediscover-item-copy">
                <span className="rediscover-item-title" title={track.track_name}>
                  {track.track_name}
                </span>
                <span className="rediscover-item-artist" title={track.artist_name}>
                  {track.artist_name}
                </span>
              </div>
              {track.context_badge && (
                <span className="rediscover-badge">{track.context_badge}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
