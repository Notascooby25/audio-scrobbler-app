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

  // Followed shows state
  const [followedShows, setFollowedShows] = useState([])
  const [loadingFollowed, setLoadingFollowed] = useState(false)
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [episodes, setEpisodes] = useState([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  const [selectedEpisodePlayId, setSelectedEpisodePlayId] = useState('')
  const [showAddShow, setShowAddShow] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [manualShowInput, setManualShowInput] = useState('')

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

  const fetchFollowedShows = async () => {
    setLoadingFollowed(true)
    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(`${API_BASE_URL}/tools/scope-creep/followed-shows`, {
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
        },
      })
      const data = await parseResponse(response, 'Failed to fetch followed shows')
      setFollowedShows(data.shows || [])
    } catch (err) {
      console.error('Error fetching followed shows:', err)
      setFollowedShows([])
    } finally {
      setLoadingFollowed(false)
    }
  }

  useEffect(() => {
    fetchFollowedShows()
  }, [])

  useEffect(() => {
    if (!selectedBrandId) {
      setEpisodes([])
      setSelectedEpisodePlayId('')
      return
    }

    const fetchEpisodes = async () => {
      setLoadingEpisodes(true)
      try {
        const session = readSession()
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
        const response = await fetch(`${API_BASE_URL}/tools/scope-creep/followed-shows/${selectedBrandId}/episodes`, {
          headers: {
            'Authorization': `Bearer ${session?.accessToken}`,
          },
        })
        const data = await parseResponse(response, 'Failed to fetch episodes')
        const eps = data.episodes || []
        setEpisodes(eps)
        if (eps.length > 0) {
          setSelectedEpisodePlayId(eps[0].play_id)
        } else {
          setSelectedEpisodePlayId('')
        }
      } catch (err) {
        console.error('Error fetching episodes:', err)
        setEpisodes([])
        setSelectedEpisodePlayId('')
      } finally {
        setLoadingEpisodes(false)
      }
    }

    fetchEpisodes()
  }, [selectedBrandId])

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

  const handleFetch = async (e, overrideUrl = null) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }
    const targetUrl = (overrideUrl || url).trim()
    if (!targetUrl) return
    if (overrideUrl) {
      setUrl(overrideUrl)
    }

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
        body: JSON.stringify({ url: targetUrl }),
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

  const handleFollowShow = async (urlOrId) => {
    setActionLoading(true)
    setError(null)
    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(`${API_BASE_URL}/tools/scope-creep/followed-shows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ url_or_id: urlOrId }),
      })
      const newShow = await parseResponse(response, 'Failed to follow show')
      await fetchFollowedShows()
      setSelectedBrandId(newShow.brand_id)
      setShowAddShow(false)
      setSearchQuery('')
      setSearchResults([])
      setManualShowInput('')

      if (showData?.brand_info && showData.brand_info.brand_id === newShow.brand_id) {
        setShowData((prev) => ({
          ...prev,
          brand_info: { ...prev.brand_info, is_followed: true },
        }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnfollowShow = async (brandId) => {
    setActionLoading(true)
    setError(null)
    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(`${API_BASE_URL}/tools/scope-creep/followed-shows/${brandId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
        },
      })
      await parseResponse(response, 'Failed to unfollow show')
      if (selectedBrandId === brandId) {
        setSelectedBrandId('')
        setEpisodes([])
        setSelectedEpisodePlayId('')
      }
      await fetchFollowedShows()

      if (showData?.brand_info && showData.brand_info.brand_id === brandId) {
        setShowData((prev) => ({
          ...prev,
          brand_info: { ...prev.brand_info, is_followed: false },
        }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSearchShows = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    setError(null)
    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(
        `${API_BASE_URL}/tools/scope-creep/search-shows?q=${encodeURIComponent(q)}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.accessToken}`,
          },
        }
      )
      const data = await parseResponse(response, 'Failed to search BBC shows')
      setSearchResults(data.results || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
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
      const data = await parseResponse(response, 'Failed to save Spotify playlist')

      if (playlistMode === 'existing') {
        try {
          const matched = userPlaylists?.find((p) => p.id === targetPlaylistId)
          const playlistName = matched ? matched.name : targetPlaylistId
          const updatedRecent = [
            { id: targetPlaylistId, name: playlistName },
            ...recentPlaylists.filter((p) => p.id !== targetPlaylistId),
          ].slice(0, 5)
          setRecentPlaylists(updatedRecent)
          localStorage.setItem('scope-creep-recent-playlists', JSON.stringify(updatedRecent))
        } catch {
          // ignore
        }
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
        <h2 className="card-title">BBC Sounds - Scope Creep</h2>
      </div>
      <div className="card-body">
        <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-muted)' }}>
          Extract radio show tracklists from BBC Sounds to create Spotify playlists or scrobble directly to your music history.
        </p>

        {/* ─── SECTION 1: Followed shows ─── */}
        <section className="scope-creep-section" style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Followed shows</h3>
            <button
              type="button"
              className="button button-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              onClick={() => setShowAddShow((v) => !v)}
              disabled={actionLoading}
            >
              {showAddShow ? 'Close Search' : '+ Follow a Show'}
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Select from your saved BBC shows to load the latest broadcast episodes without copying URLs.
          </p>

          {/* Add / Search show drawer */}
          {showAddShow && (
            <div style={{ padding: '1rem', marginBottom: '1.25rem', backgroundColor: 'var(--color-surface-hover, rgba(255,255,255,0.03))', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>Search BBC Shows</h4>
              <form onSubmit={handleSearchShows} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search BBC shows (e.g. Gilles Peterson, Mary Anne Hobbs, Indie Chill)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={searching || actionLoading}
                  style={{ flex: '1 1 240px', fontSize: '0.85rem' }}
                />
                <button
                  type="submit"
                  className="button button-primary"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                  disabled={searching || !searchQuery.trim() || actionLoading}
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '0.5rem' }}>
                  {searchResults.map((res) => (
                    <div
                      key={res.brand_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.4rem 0.5rem',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                        {res.image_url && (
                          <img
                            src={res.image_url}
                            alt=""
                            style={{ width: 36, height: 36, borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: '0.85rem', display: 'block' }}>{res.title}</strong>
                          {res.synopsis && (
                            <small style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {res.synopsis}
                            </small>
                          )}
                        </div>
                      </div>
                      <div>
                        {res.is_followed ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-primary, #1db954)', fontWeight: 500 }}>
                            Followed
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                            onClick={() => handleFollowShow(res.brand_id)}
                            disabled={actionLoading}
                          >
                            + Follow
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                <label htmlFor="manual-show-url" className="form-label" style={{ fontSize: '0.8rem' }}>
                  Or follow via BBC show link / episode URL:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    id="manual-show-url"
                    type="text"
                    className="form-input"
                    placeholder="https://www.bbc.co.uk/sounds/brand/... or /play/..."
                    value={manualShowInput}
                    onChange={(e) => setManualShowInput(e.target.value)}
                    disabled={actionLoading}
                    style={{ flex: '1 1 240px', fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                    onClick={() => {
                      if (manualShowInput.trim()) {
                        handleFollowShow(manualShowInput.trim())
                      }
                    }}
                    disabled={actionLoading || !manualShowInput.trim()}
                  >
                    Follow Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Followed shows list with inline unfollow */}
          {loadingFollowed ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Loading saved shows...</p>
          ) : followedShows.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No followed shows yet — click "+ Follow a Show" to get started.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: selectedBrandId ? '0.75rem' : 0 }}>
              {followedShows.map((s) => {
                const isActive = selectedBrandId === s.brand_id
                return (
                  <div
                    key={s.brand_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '6px',
                      border: isActive
                        ? '1px solid var(--color-primary, #1db954)'
                        : '1px solid var(--color-border, rgba(255,255,255,0.1))',
                      backgroundColor: isActive
                        ? 'rgba(29, 185, 84, 0.08)'
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s, border-color 0.15s',
                    }}
                    onClick={() => setSelectedBrandId(isActive ? '' : s.brand_id)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedBrandId(isActive ? '' : s.brand_id)
                      }
                    }}
                  >
                    {s.image_url && (
                      <img
                        src={s.image_url}
                        alt=""
                        style={{ width: 32, height: 32, borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                    <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: isActive ? 600 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </span>
                    <button
                      type="button"
                      className="button button-secondary"
                      title={`Unfollow ${s.title}`}
                      aria-label={`Unfollow ${s.title}`}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        color: 'var(--color-error, #f44336)',
                        flexShrink: 0,
                        lineHeight: 1,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnfollowShow(s.brand_id)
                      }}
                      disabled={actionLoading}
                    >
                      ✕ Unfollow
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Episode picker — shown when a show is selected */}
          {selectedBrandId && (
            <div style={{ marginTop: '0.5rem' }}>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label htmlFor="select-show-episode" className="form-label" style={{ fontSize: '0.85rem' }}>
                  Select Broadcast Episode
                </label>
                <select
                  id="select-show-episode"
                  className="form-input"
                  value={selectedEpisodePlayId}
                  onChange={(e) => setSelectedEpisodePlayId(e.target.value)}
                  disabled={loadingEpisodes || actionLoading}
                  style={{ width: '100%' }}
                >
                  {loadingEpisodes ? (
                    <option value="">Loading latest broadcast episodes...</option>
                  ) : episodes.length === 0 ? (
                    <option value="">No playable episodes available right now</option>
                  ) : (
                    episodes.map((ep) => (
                      <option key={ep.play_id} value={ep.play_id}>
                        {ep.release_date ? `${ep.release_date}: ` : ''}{ep.title}{ep.duration ? ` (${ep.duration})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                type="button"
                className="button button-primary"
                style={{ fontSize: '0.85rem', padding: '0.45rem 1.1rem' }}
                onClick={() => {
                  if (selectedEpisodePlayId) {
                    handleFetch(null, `https://www.bbc.co.uk/sounds/play/${selectedEpisodePlayId}`)
                  }
                }}
                disabled={!selectedEpisodePlayId || fetching || actionLoading}
              >
                {fetching ? 'Loading Tracklist...' : 'Load Tracklist'}
              </button>
            </div>
          )}
        </section>

        {/* ─── SECTION 2: Track listing extraction ─── */}
        <section className="scope-creep-section">
          <div style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Track listing extraction</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Extract tracks from any BBC Sounds episode URL directly.
            </p>
          </div>

          {!showData ? (
            <form onSubmit={handleFetch} style={{ marginTop: '0.75rem' }}>
              <div className="form-group">
                <label htmlFor="bbc-url" className="form-label" style={{ fontSize: '0.85rem' }}>BBC Sounds URL</label>
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
              <p className="help-text" style={{ marginTop: '-0.25rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                Example: <code>https://www.bbc.co.uk/sounds/play/m0031tc6</code>
              </p>
              <button type="submit" className="button button-primary" disabled={fetching}>
                {fetching ? 'Fetching Show...' : 'Fetch Show'}
              </button>
            </form>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color, #333)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{showData.title}</h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-muted, #888)' }}>
                    {showData.tracks.length} tracks found ({selectedSegments.size} selected)
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {showData.brand_info && (
                    showData.brand_info.is_followed ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-primary, #1db954)', fontWeight: 500 }}>
                        ✓ Following Show
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                        onClick={() => handleFollowShow(showData.brand_info.brand_id)}
                        disabled={actionLoading}
                      >
                        + Follow "{showData.brand_info.title}"
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
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
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(29, 185, 84, 0.05)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      {track.image_url ? (
                        <img
                          src={track.image_url}
                          alt=""
                          style={{ width: 40, height: 40, borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            color: 'var(--color-muted, #888)',
                            flexShrink: 0,
                          }}
                        >
                          🎵
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span>{track.artist}</span> - <span>{track.title}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted, #888)' }}>
                          {formatOffset(track.offset_seconds)}
                          {track.duration_seconds ? ` (${formatOffset(track.duration_seconds)})` : ''}
                        </div>
                      </div>
                      <div>
                        {track.spotify_uri ? (
                          <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#1db954', color: '#000', borderRadius: '3px', fontWeight: 'bold' }}>
                            Spotify Match
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#444', color: '#ccc', borderRadius: '3px' }}>
                            No Match
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Scrobble timestamp config */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="listened-at" className="form-label">Mark Listened At</label>
                <input
                  id="listened-at"
                  type="datetime-local"
                  className="form-input"
                  value={listenedAt}
                  onChange={(e) => setListenedAt(e.target.value)}
                  disabled={actionLoading}
                />
                <small className="help-text">
                  Tracks will be scrobbled starting at this time, preserving original broadcast spacing.
                </small>
              </div>

              {/* Spotify Playlist Destination Selection */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--border-color, #333)', borderRadius: '4px', backgroundColor: 'var(--color-surface, rgba(255,255,255,0.02))' }}>
                <label className="form-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                  Spotify Playlist Destination
                </label>
                
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="playlist-mode"
                      value="create"
                      checked={playlistMode === 'create'}
                      onChange={() => setPlaylistMode('create')}
                      disabled={actionLoading}
                    />
                    <span>Create brand new playlist</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="playlist-mode"
                      value="existing"
                      checked={playlistMode === 'existing'}
                      onChange={() => setPlaylistMode('existing')}
                      disabled={actionLoading}
                    />
                    <span>Add to existing playlist</span>
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
                      placeholder={showData.title}
                    />
                  </div>
                ) : (
                  <div>
                    {loadingPlaylists && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted, #888)', margin: '0.5rem 0' }}>
                        Loading your Spotify playlists...
                      </p>
                    )}

                    {!loadingPlaylists && (
                      <>
                        {needsPlaylistsScope && (
                          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.4)', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>
                              Spotify requires additional permissions to list your existing playlists. Click below to authorize:
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
        </section>
      </div>
    </div>
  )
}
