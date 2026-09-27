import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { redirectToAuthorization, requestSpotifyAuthorization } from '../api'
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

async function parseResponse(response, fallbackMsg) {
  let data
  try {
    data = await response.json()
  } catch {
    // Non-JSON response (e.g. 500 Internal Server Error text from proxy)
    let errText = ''
    try {
      if (typeof response.text === 'function') {
        errText = await response.text()
      }
    } catch {
      // ignore
    }
    throw new Error(errText || `${fallbackMsg} (status ${response.status || 'unknown'})`)
  }

  if (!response.ok) {
    throw new Error(data?.detail || fallbackMsg)
  }
  return data
}

export default function ScopeCreepTools() {
  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [showData, setShowData] = useState(null)
  const [selectedSegments, setSelectedSegments] = useState(new Set())
  const [listenedAt, setListenedAt] = useState(getLocalDefaultDateTime)

  // Playlist options
  const [playlistMode, setPlaylistMode] = useState('create') // 'create' | 'existing'
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  const [customPlaylistInput, setCustomPlaylistInput] = useState('')
  const [playlistSearch, setPlaylistSearch] = useState('')
  const [userPlaylists, setUserPlaylists] = useState(null)
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)
  const [needsPlaylistsScope, setNeedsPlaylistsScope] = useState(false)
  const [recentPlaylists, setRecentPlaylists] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('scope-creep-recent-playlists') || '[]')
    } catch {
      return []
    }
  })
  
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [playlistResult, setPlaylistResult] = useState(null)
  const [scrobbleResult, setScrobbleResult] = useState(null)

  const fetchPlaylists = async () => {
    setLoadingPlaylists(true)
    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(`${API_BASE_URL}/tools/scope-creep/playlists`, {
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
        },
      })
      const data = await parseResponse(response, 'Failed to fetch your Spotify playlists')
      setUserPlaylists(data.playlists || [])
      setNeedsPlaylistsScope(Boolean(data.needs_scope))
    } catch (err) {
      console.error('Error fetching playlists:', err)
      setUserPlaylists([])
    } finally {
      setLoadingPlaylists(false)
    }
  }

  useEffect(() => {
    if (playlistMode === 'existing' && userPlaylists === null && !loadingPlaylists) {
      fetchPlaylists()
    }
  }, [playlistMode, userPlaylists, loadingPlaylists])

  const handleAuthorizePlaylists = async () => {
    try {
      sessionStorage.setItem('spotify_auth_return_to', '/settings?tab=scrobble')
      const { authorization_url: authUrl } = await requestSpotifyAuthorization(true)
      redirectToAuthorization(authUrl)
    } catch (err) {
      setError(err.message || 'Failed to start Spotify authorization')
    }
  }

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
      const data = await parseResponse(response, 'Failed to fetch BBC show')

      setShowData(data)
      setNewPlaylistTitle(data.title || '')
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

    let targetPlaylistId = null
    if (playlistMode === 'existing') {
      if (selectedPlaylistId && selectedPlaylistId !== 'custom') {
        targetPlaylistId = selectedPlaylistId
      } else if (customPlaylistInput.trim()) {
        targetPlaylistId = customPlaylistInput.trim()
      }

      if (!targetPlaylistId) {
        setError('Please select or enter a Spotify playlist to add tracks to.')
        return
      }
    }

    setActionLoading(true)
    setError(null)
    setPlaylistResult(null)

    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const payload = {
        url: url.trim(),
        mode: playlistMode,
        spotify_uris: selectedTracks.map((t) => t.spotify_uri),
      }

      if (playlistMode === 'existing') {
        payload.playlist_id = targetPlaylistId
      } else {
        payload.title = newPlaylistTitle.trim() || showData.title
      }

      const response = await fetch(`${API_BASE_URL}/tools/scope-creep/playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await parseResponse(
        response,
        playlistMode === 'existing' ? 'Failed to add tracks to Spotify playlist' : 'Failed to create Spotify playlist'
      )

      setPlaylistResult(data)

      if (playlistMode === 'existing' && targetPlaylistId) {
        try {
          const currentRecents = JSON.parse(localStorage.getItem('scope-creep-recent-playlists') || '[]')
          const found = userPlaylists?.find((p) => p.id === targetPlaylistId)
          const nameMatch = data.message.match(/playlist '([^']+)'/)
          const nameToSave = found?.name || (nameMatch ? nameMatch[1] : targetPlaylistId)
          const updated = [
            { id: targetPlaylistId, name: nameToSave },
            ...currentRecents.filter((r) => r.id !== targetPlaylistId),
          ].slice(0, 5)
          localStorage.setItem('scope-creep-recent-playlists', JSON.stringify(updated))
          setRecentPlaylists(updated)
        } catch {
          // ignore localStorage error
        }
      }
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
            artwork_url: t.image_url || null,
          })),
        }),
      })
      const data = await parseResponse(response, 'Failed to scrobble tracks')

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
                  setPlaylistMode('create')
                  setSelectedPlaylistId('')
                  setCustomPlaylistInput('')
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
                    {track.image_url ? (
                      <img
                        src={track.image_url}
                        alt=""
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '4px',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '0.85rem',
                          color: 'var(--color-muted, #888)',
                          border: '1px solid var(--border-color, #333)',
                        }}
                      >
                        🎵
                      </div>
                    )}
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

            <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', border: '1px solid var(--border-color, #333)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Spotify Playlist Destination</span>
              </div>
              
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="playlist-mode"
                    value="create"
                    checked={playlistMode === 'create'}
                    onChange={() => setPlaylistMode('create')}
                    disabled={actionLoading}
                  />
                  Create brand new playlist
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="playlist-mode"
                    value="existing"
                    checked={playlistMode === 'existing'}
                    onChange={() => setPlaylistMode('existing')}
                    disabled={actionLoading}
                  />
                  Add to existing playlist
                </label>
              </div>

              {playlistMode === 'create' ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="new-playlist-title" className="form-label" style={{ fontSize: '0.85rem' }}>Playlist Name</label>
                  <input
                    id="new-playlist-title"
                    type="text"
                    className="form-input"
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    disabled={actionLoading}
                    placeholder="Enter playlist name..."
                  />
                </div>
              ) : (
                <div>
                  {loadingPlaylists ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-muted, #888)', margin: 0 }}>Loading your Spotify playlists...</p>
                  ) : (
                    <>
                      {needsPlaylistsScope && (
                        <div style={{ padding: '0.85rem 1rem', backgroundColor: 'rgba(29, 185, 84, 0.12)', border: '1px solid #1db954', borderRadius: '6px', marginBottom: '1rem' }}>
                          <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', fontWeight: 600, color: '#1db954' }}>
                            Authorize Spotify Playlists
                          </p>
                          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted, #ccc)', lineHeight: 1.4 }}>
                            Grant permission to read your Spotify playlists so you can automatically select from your playlist library without having to copy and paste links.
                          </p>
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                            onClick={handleAuthorizePlaylists}
                            disabled={actionLoading}
                          >
                            Connect Spotify Playlists
                          </button>
                        </div>
                      )}

                      {userPlaylists && userPlaylists.length > 0 && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          {userPlaylists.length > 5 && (
                            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                              <label htmlFor="playlist-search" className="form-label" style={{ fontSize: '0.85rem' }}>Search Playlists</label>
                              <input
                                id="playlist-search"
                                type="text"
                                className="form-input"
                                placeholder="Search by playlist name..."
                                value={playlistSearch}
                                onChange={(e) => setPlaylistSearch(e.target.value)}
                                disabled={actionLoading}
                                style={{ width: '100%', fontSize: '0.85rem' }}
                              />
                            </div>
                          )}

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="select-playlist" className="form-label" style={{ fontSize: '0.85rem' }}>Select Playlist</label>
                            <select
                              id="select-playlist"
                              className="form-input"
                              value={selectedPlaylistId}
                              onChange={(e) => setSelectedPlaylistId(e.target.value)}
                              disabled={actionLoading}
                              style={{ width: '100%' }}
                            >
                              <option value="">
                                {playlistSearch
                                  ? `-- ${userPlaylists.filter((p) => p.name.toLowerCase().includes(playlistSearch.toLowerCase())).length} playlists matching "${playlistSearch}" --`
                                  : `-- Choose from your ${userPlaylists.length} playlists --`}
                              </option>
                              {recentPlaylists.length > 0 && !playlistSearch && (
                                <optgroup label="Recently Used">
                                  {recentPlaylists.map((p) => (
                                    <option key={`recent-${p.id}`} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="Your Spotify Playlists">
                                {userPlaylists
                                  .filter((p) => p.name.toLowerCase().includes(playlistSearch.toLowerCase()))
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                              </optgroup>
                              <option value="custom">-- Paste a different playlist link or ID manually --</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {(!userPlaylists || userPlaylists.length === 0 || selectedPlaylistId === 'custom' || (!selectedPlaylistId && needsPlaylistsScope)) && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="custom-playlist-id" className="form-label" style={{ fontSize: '0.85rem' }}>
                            {userPlaylists && userPlaylists.length > 0 ? 'Custom Spotify Playlist Link or ID' : 'Or paste Spotify Playlist Link / ID'}
                          </label>
                          <input
                            id="custom-playlist-id"
                            type="text"
                            className="form-input"
                            value={customPlaylistInput}
                            onChange={(e) => setCustomPlaylistInput(e.target.value)}
                            disabled={actionLoading}
                            placeholder="https://open.spotify.com/playlist/... or spotify:playlist:..."
                          />
                          {recentPlaylists.length > 0 && (!userPlaylists || userPlaylists.length === 0) && (
                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted, #888)' }}>Recent:</span>
                              {recentPlaylists.map((rec) => (
                                <button
                                  key={rec.id}
                                  type="button"
                                  className="button button-secondary"
                                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', height: 'auto' }}
                                  onClick={() => {
                                    setCustomPlaylistInput(rec.id)
                                  }}
                                >
                                  {rec.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button button-primary"
                onClick={handleCreatePlaylist}
                disabled={actionLoading || selectedSpotifyCount === 0}
              >
                {actionLoading
                  ? 'Working...'
                  : playlistMode === 'existing'
                    ? `Add to Existing Playlist (${selectedSpotifyCount})`
                    : `Create Spotify Playlist (${selectedSpotifyCount})`}
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
