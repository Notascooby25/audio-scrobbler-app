import { useState } from 'react'
import { Link } from 'react-router-dom'
import { readSession } from '../session'

function formatOffset(seconds) {
  if (seconds == null) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getLocalDefaultDateTime() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export default function ScopeCreepTools() {
  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [showData, setShowData] = useState(null)
  const [selectedSegments, setSelectedSegments] = useState(new Set())
  const [listenedAt, setListenedAt] = useState(getLocalDefaultDateTime)
  
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [playlistResult, setPlaylistResult] = useState(null)
  const [scrobbleResult, setScrobbleResult] = useState(null)

  const handleFetch = async (e) => {
    e.preventDefault()
    if (!url.trim()) return

    setFetching(true)
    setError(null)
    setShowData(null)
    setPlaylistResult(null)
    setScrobbleResult(null)

    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(`${API_BASE_URL}/tools/scope-creep/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch BBC show')
      }

      setShowData(data)
      // By default, select all tracks
      setSelectedSegments(new Set(data.tracks.map((t) => t.segment_id)))
    } catch (err) {
      setError(err.message)
    } finally {
      setFetching(false)
    }
  }

  const toggleSelectTrack = (segmentId) => {
    setSelectedSegments((prev) => {
      const next = new Set(prev)
      if (next.has(segmentId)) {
        next.delete(segmentId)
      } else {
        next.add(segmentId)
      }
      return next
    })
  }

  const selectAll = () => {
    if (!showData) return
    setSelectedSegments(new Set(showData.tracks.map((t) => t.segment_id)))
  }

  const deselectAll = () => {
    setSelectedSegments(new Set())
  }

  const handleCreatePlaylist = async () => {
    if (!showData) return
    const selectedTracks = showData.tracks.filter(
      (t) => selectedSegments.has(t.segment_id) && t.spotify_uri
    )
    if (selectedTracks.length === 0) return

    setActionLoading(true)
    setError(null)
    setPlaylistResult(null)

    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(`${API_BASE_URL}/tools/scope-creep/playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          url: url.trim(),
          title: showData.title,
          spotify_uris: selectedTracks.map((t) => t.spotify_uri),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create Spotify playlist')
      }

      setPlaylistResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleScrobble = async () => {
    if (!showData) return
    const selectedTracks = showData.tracks.filter((t) => selectedSegments.has(t.segment_id))
    if (selectedTracks.length === 0) return

    setActionLoading(true)
    setError(null)
    setScrobbleResult(null)

    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(`${API_BASE_URL}/tools/scope-creep/scrobble`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          play_id: showData.play_id,
          listened_at: listenedAt ? new Date(listenedAt).toISOString() : new Date().toISOString(),
          tracks: selectedTracks.map((t) => ({
            segment_id: t.segment_id,
            artist: t.artist,
            title: t.title,
            offset_seconds: t.offset_seconds || 0,
            duration_seconds: t.duration_seconds || null,
            spotify_uri: t.spotify_uri || null,
          })),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to scrobble tracks')
      }

      setScrobbleResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const selectedSpotifyCount = showData
    ? showData.tracks.filter((t) => selectedSegments.has(t.segment_id) && t.spotify_uri).length
    : 0

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">BBC Sounds: Scope Creep</h2>
      </div>
      <div className="card-body">
        <p>Extract radio show tracklists from BBC Sounds to create Spotify playlists or scrobble directly to your music history.</p>
        <p className="help-text">Example: <code>https://www.bbc.co.uk/sounds/play/m0031tc6</code></p>

        {!showData ? (
          <form onSubmit={handleFetch} style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label htmlFor="bbc-url" className="form-label">BBC Sounds URL</label>
              <input
                id="bbc-url"
                type="url"
                className="form-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.bbc.co.uk/sounds/play/..."
                disabled={fetching}
                required
              />
            </div>
            <button type="submit" className="button button-primary" disabled={fetching}>
              {fetching ? 'Fetching Show...' : 'Fetch Show'}
            </button>
          </form>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color, #333)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{showData.title}</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted, #888)' }}>
                  {showData.tracks.length} tracks found ({selectedSegments.size} selected)
                </p>
              </div>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setShowData(null)
                  setPlaylistResult(null)
                  setScrobbleResult(null)
                }}
                disabled={actionLoading}
              >
                Change URL
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button type="button" className="button button-secondary" onClick={selectAll} disabled={actionLoading}>
                Select All
              </button>
              <button type="button" className="button button-secondary" onClick={deselectAll} disabled={actionLoading}>
                Deselect All
              </button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color, #333)', borderRadius: '4px', padding: '0.5rem', marginBottom: '1.25rem' }}>
              {showData.tracks.map((track) => {
                const isSelected = selectedSegments.has(track.segment_id)
                return (
                  <div
                    key={track.segment_id}
                    onClick={() => toggleSelectTrack(track.segment_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem',
                      borderBottom: '1px solid var(--border-color, #222)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent onClick
                      style={{ cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {track.title}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-muted, #aaa)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {track.artist}
                      </div>
                    </div>
                    {track.offset_seconds != null && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-muted, #888)', fontFamily: 'monospace' }}>
                        {formatOffset(track.offset_seconds)}
                      </span>
                    )}
                    {track.spotify_uri ? (
                      <span title="Available on Spotify" style={{ fontSize: '0.75rem', color: '#1db954' }}>● Spotify</span>
                    ) : (
                      <span title="No Spotify track match" style={{ fontSize: '0.75rem', color: 'var(--color-muted, #666)' }}>○ No Spotify URI</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="listened-at" className="form-label">When did you listen?</label>
              <input
                id="listened-at"
                type="datetime-local"
                className="form-input"
                value={listenedAt}
                onChange={(e) => setListenedAt(e.target.value)}
                disabled={actionLoading}
              />
              <p className="help-text" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Tracks will be timestamped starting from this time, spaced out by their broadcast offsets.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button button-primary"
                onClick={handleCreatePlaylist}
                disabled={actionLoading || selectedSpotifyCount === 0}
              >
                {actionLoading ? 'Working...' : `Create Spotify Playlist (${selectedSpotifyCount})`}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={handleScrobble}
                disabled={actionLoading || selectedSegments.size === 0}
              >
                {actionLoading ? 'Working...' : `Scrobble Selected (${selectedSegments.size})`}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message" style={{ marginTop: '1rem', color: 'var(--color-error, #f44336)' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {playlistResult && (
          <div className="success-message" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(29, 185, 84, 0.15)', borderRadius: '4px', border: '1px solid #1db954' }}>
            <p><strong>Success!</strong> {playlistResult.message}</p>
            <a
              href={playlistResult.playlist_url}
              target="_blank"
              rel="noreferrer"
              className="button button-secondary"
              style={{ marginTop: '0.5rem', display: 'inline-block' }}
            >
              Open on Spotify
            </a>
          </div>
        )}

        {scrobbleResult && (
          <div className="success-message" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(29, 185, 84, 0.15)', borderRadius: '4px', border: '1px solid #1db954' }}>
            <p><strong>Success!</strong> {scrobbleResult.message}</p>
            <Link
              to="/library"
              className="button button-secondary"
              style={{ marginTop: '0.5rem', display: 'inline-block' }}
            >
              View in Library
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
