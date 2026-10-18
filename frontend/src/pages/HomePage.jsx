import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMonthlySummary, fetchRecentScrobbles, fetchSpotifyStatus, redirectToAuthorization, requestDevelopmentToken, requestSpotifyAuthorization, submitImportScrobbles, submitUnifiedImport } from '../api'
import EmptyState, { HeadphonesIcon, AlertIcon, GhostIcon } from "../components/EmptyState"
import CustomDateField from '../components/CustomDateField'
import ImportProgressBar from '../components/ImportProgressBar'
import ImportSummaryPanel from '../components/ImportSummaryPanel'
import ScrobbleList from '../components/ScrobbleList'

function readSavedSession() {
  try {
    return JSON.parse(localStorage.getItem('audio-scrobbler-session') || 'null')
  } catch {
    localStorage.removeItem('audio-scrobbler-session')
    return null
  }
}

function readCallbackSession() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const authError = params.get('auth_error')
  if (authError) {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
    return { authError }
  }
  const accessToken = params.get('access_token')
  const userId = params.get('user_id')
  const expiresIn = Number(params.get('expires_in'))
  if (!accessToken || !userId || !expiresIn) return null
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
  return { userId: Number(userId), accessToken, expiresAt: Date.now() + expiresIn * 1000, authMethod: 'spotify' }
}

export default function HomePage() {
  const callbackSession = readCallbackSession()
  const callbackError = callbackSession?.authError
  const callbackErrorMessage =
    callbackError === 'account_not_allowed'
      ? 'This Spotify account is not authorized to use this app.'
      : callbackError === 'spotify_rate_limited'
        ? 'Spotify is temporarily rate-limiting this app. Try connecting again later.'
        : 'Spotify authorization was cancelled.'
  if (callbackError) localStorage.removeItem('audio-scrobbler-session')
  if (callbackSession) localStorage.setItem('audio-scrobbler-session', JSON.stringify(callbackSession))
  const savedSession = callbackSession?.accessToken ? callbackSession : readSavedSession()
  const [userId, setUserId] = useState(savedSession?.userId || '')
  const [token, setToken] = useState(savedSession?.accessToken || '')
  const [fromMonth, setFromMonth] = useState('')
  const [toMonth, setToMonth] = useState('')
  const [summary, setSummary] = useState(null)
  const [selectedYear, setSelectedYear] = useState('All')
  const [scrobbles, setScrobbles] = useState([])
  const [error, setError] = useState(callbackError ? callbackErrorMessage : '')
  const [status, setStatus] = useState(callbackError ? 'error' : savedSession?.accessToken ? 'loading' : 'idle')
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const [importProgress, setImportProgress] = useState('')
  const [liveProgress, setLiveProgress] = useState(null)
  const [spotifyRetryAfter, setSpotifyRetryAfter] = useState(null)
  const importInputRef = useRef(null)

  const archiveTotals = useMemo(() => {
    if (!summary?.summary?.length) return { plays: 0, minutes: 0, hours: 0 }
    const plays = summary.summary.reduce((acc, m) => acc + (m.total_plays || 0), 0)
    const minutes = summary.summary.reduce((acc, m) => acc + (m.total_listening_minutes || 0), 0)
    const hours = Math.round((minutes / 60) * 10) / 10
    return { plays, minutes, hours }
  }, [summary])

  const years = useMemo(() => {
    if (!summary?.summary?.length) return []
    const yrSet = new Set(summary.summary.map((m) => m.month.slice(0, 4)))
    return ['All', ...Array.from(yrSet).sort().reverse()]
  }, [summary])

  const filteredMonths = useMemo(() => {
    if (!summary?.summary?.length) return []
    if (selectedYear === 'All') return summary.summary
    return summary.summary.filter((m) => m.month.startsWith(selectedYear))
  }, [summary, selectedYear])

  const maxMonthlyPlays = useMemo(() => {
    if (!summary?.summary?.length) return 1
    return Math.max(...summary.summary.map((m) => m.total_plays || 0), 1)
  }, [summary])

  useEffect(() => {
    fetchSpotifyStatus()
      .then((result) => setSpotifyRetryAfter(result.rate_limited ? result.retry_after : null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (callbackSession?.accessToken) {
      const returnTo = sessionStorage.getItem('spotify_auth_return_to')
      if (returnTo) {
        sessionStorage.removeItem('spotify_auth_return_to')
        window.location.replace(returnTo)
      }
    }
  }, [callbackSession])

  const connectSpotify = async () => {
    setStatus('loading')
    setError('')
    try {
      const { authorization_url: authorizationUrl } = await requestSpotifyAuthorization()
      redirectToAuthorization(authorizationUrl)
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

  const clearSession = () => {
    localStorage.removeItem('audio-scrobbler-session')
    setToken('')
    setSummary(null)
    setStatus('idle')
  }

  const signIn = async (event) => {
    event?.preventDefault()
    if (!userId || Number(userId) < 1) {
      setError('Enter a valid development user ID.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setError('')
    try {
      const session = await requestDevelopmentToken(userId)
      const storedSession = {
        userId: Number(userId),
        accessToken: session.access_token,
        expiresAt: Date.now() + session.expires_in * 1000,
      }
      localStorage.setItem('audio-scrobbler-session', JSON.stringify(storedSession))
      setToken(session.access_token)
      await loadSummary(null, session.access_token)
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

  const loadSummary = async (event, accessToken = token) => {
    event?.preventDefault()
    if (!accessToken) {
      setStatus('idle')
      return
    }

    setStatus('loading')
    setError('')

    try {
      const data = await fetchMonthlySummary({ token: accessToken, fromMonth, toMonth })
      setSummary(data)
      setStatus('ready')
      const recent = await fetchRecentScrobbles({ token: accessToken })
      setScrobbles(recent.scrobbles)
    } catch (requestError) {
      if (requestError.status === 401) {
        clearSession()
        setError('Your session has expired. Sign in again.')
        setStatus('error')
        return
      }
      setSummary(null)
      setError(requestError.message)
      setStatus('error')
    }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportResult(null)
    setImportError('')
    setImportProgress('')
    setLiveProgress(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const entries = Array.isArray(parsed) ? parsed : parsed.history || parsed.entries || []
      if (!entries.length) throw new Error('No history entries found in this JSON file.')
      const firstEntry = entries[0] || {}
      const explicitSource = (firstEntry.source || '').toString().toLowerCase()
      const looksLikeApple = explicitSource.includes('apple') || explicitSource.includes('itunes') || file.name.toLowerCase().includes('apple')
      const looksLikeYoutube = 'song' in firstEntry || 'subtitles' in firstEntry || 'titleUrl' in firstEntry || explicitSource.includes('youtube')

      let source = 'spotify'
      if (looksLikeApple) {
        source = 'apple'
      } else if (looksLikeYoutube || file.name.toLowerCase().includes('youtube') || file.name.toLowerCase().includes('watch-history')) {
        source = 'youtube'
      }

      let result = null
      if (submitImportScrobbles && submitImportScrobbles.mock) {
        result = await submitImportScrobbles({ token, source, entries })
      } else {
        setLiveProgress({
          stage: 'file_validation',
          percent: 10,
          message: `Validating ${entries.length.toLocaleString()} entries...`,
          current: 0,
          total: entries.length,
        })
        result = await submitUnifiedImport({
          token,
          source,
          entries,
          onProgress: (progressEvent) => {
            setLiveProgress(progressEvent)
          },
        })
      }

      setImportResult(result)
      setLiveProgress(null)
      await loadSummary(null, token)
    } catch (requestError) {
      setLiveProgress(null)
      setImportError(requestError.message || 'Import failed.')
    } finally {
      event.target.value = ''
    }
  }

  useEffect(() => {
    if (!savedSession?.accessToken) return
    if (savedSession.expiresAt && savedSession.expiresAt <= Date.now()) {
      signIn()
      return
    }
    loadSummary(null, savedSession.accessToken)
  }, [])

  return (
    <section className="dashboard" aria-labelledby="summary-heading">
      <div className="section-heading">
        <div>
          <h1 id="summary-heading">Connect & Data Sources</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Manage streaming connections and import listening history files.
          </p>
        </div>
      </div>

      <div className="connect-sources-grid">
        {/* Card 1: Spotify Streaming */}
        <div className="connect-source-card">
          <div className="connect-source-header">
            <div className="connect-source-title-group">
              <span className="source-badge source-badge-spotify" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Spotify</span>
              <h3>Spotify Streaming</h3>
            </div>
            {token ? (
              <span className="connect-source-status connected">Connected</span>
            ) : (
              <span className="connect-source-status disconnected">Disconnected</span>
            )}
          </div>
          <p className="connect-source-desc">
            Continuous background polling and real-time playback tracking directly from your account.
          </p>
          <div className="connect-source-actions">
            {!token ? (
              <>
                <button type="button" onClick={connectSpotify} disabled={Boolean(spotifyRetryAfter)}>
                  Connect Spotify
                </button>
                {spotifyRetryAfter && (
                  <p className="notice">
                    Spotify is rate-limiting this app. Try again after {new Date(spotifyRetryAfter).toLocaleTimeString()}.
                  </p>
                )}
              </>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                Active sync enabled. Your plays update automatically.
              </span>
            )}
          </div>
        </div>

        {/* Card 2: History File Import */}
        <div className="connect-source-card">
          <div className="connect-source-header">
            <div className="connect-source-title-group">
              <span className="source-badge source-badge-youtube" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Files</span>
              <h3>History File Import</h3>
            </div>
          </div>
          <p className="connect-source-desc">
            Import your complete listening history from Spotify JSON exports or YouTube Music watch history.
          </p>
          <div className="connect-source-actions">
            {token ? (
              <div className="import-panel" style={{ width: '100%', margin: 0 }}>
                <label className="import-picker">
                  Import history JSON
                  <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImport} />
                </label>
                {liveProgress && <ImportProgressBar progress={liveProgress} />}
                {importProgress && !liveProgress && <p className="notice" role="status">{importProgress}</p>}
                <ImportSummaryPanel
                  result={importResult}
                  error={importError}
                  onDismiss={() => {
                    setImportResult(null)
                    setImportError('')
                  }}
                />
              </div>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                Connect Spotify or sign in to import history files.
              </span>
            )}
          </div>
        </div>

        {/* Card 3: BBC Sounds & Tools */}
        <div className="connect-source-card">
          <div className="connect-source-header">
            <div className="connect-source-title-group">
              <span className="source-badge source-badge-bbc" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Tools</span>
              <h3>Radio & Liked Songs</h3>
            </div>
          </div>
          <p className="connect-source-desc">
            Extract tracklists from BBC Sounds radio shows (Scope Creep) or sync your Spotify Liked Songs library.
          </p>
          <div className="connect-source-actions">
            <Link to="/settings?tab=scrobble" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              Configure Scrobble Settings →
            </Link>
          </div>
        </div>
      </div>

      {token && (
        <div className="monthly-summary-section" style={{ marginTop: '2.5rem', borderTop: '0.5px solid var(--color-border)', paddingTop: '1.5rem' }}>
          <div className="section-heading" style={{ marginBottom: '1rem' }}>
            <div>
              <h3>Monthly archive ledger</h3>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
                Historical listening breakdown across all ingested data sources.
              </p>
            </div>
            {summary && <p className="month-count">{summary.total_months} months found</p>}
          </div>

          {status === 'ready' && summary?.summary?.length > 0 && (
            <>
              <div className="monthly-ledger-stats">
                <div className="monthly-stat-card">
                  <span className="monthly-stat-value">{summary.total_months}</span>
                  <span className="monthly-stat-label">Active Months</span>
                </div>
                <div className="monthly-stat-card">
                  <span className="monthly-stat-value">{`${archiveTotals.plays.toLocaleString()} scrobbles`}</span>
                  <span className="monthly-stat-label">Total Scrobbles</span>
                </div>
                <div className="monthly-stat-card">
                  <span className="monthly-stat-value">{archiveTotals.hours.toLocaleString()} hrs</span>
                  <span className="monthly-stat-label">Listening Time</span>
                </div>
              </div>

              {years.length > 2 && (
                <div className="monthly-year-chips" role="tablist" aria-label="Filter archive by year">
                  {years.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      role="tab"
                      aria-selected={selectedYear === yr}
                      className={`monthly-year-chip ${selectedYear === yr ? 'active' : ''}`}
                      onClick={() => setSelectedYear(yr)}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              )}

              <div className="monthly-ledger-container" role="region" aria-label="Monthly listening breakdown">
                <div className="monthly-ledger-header">
                  <span>Month</span>
                  <span>Scrobbles</span>
                  <span>Unique Tracks</span>
                  <span>Time</span>
                  <span className="monthly-ledger-volume-header">Relative Volume</span>
                </div>
                <div className="monthly-ledger-list">
                  {filteredMonths.map((month) => {
                    const volumePercent = Math.min(100, Math.round(((month.total_plays || 0) / maxMonthlyPlays) * 100))
                    return (
                      <div className="monthly-ledger-row" key={month.month}>
                        <span className="monthly-ledger-month">{month.month}</span>
                        <strong className="monthly-ledger-plays">{month.total_plays.toLocaleString()}</strong>
                        <span className="monthly-ledger-tracks">{month.unique_tracks.toLocaleString()} tracks</span>
                        <span className="monthly-ledger-time">{month.total_listening_minutes.toLocaleString()} min</span>
                        <div className="monthly-ledger-volume-cell">
                          <div className="monthly-volume-bar-track">
                            <div className="monthly-volume-bar-fill" style={{ width: `${Math.max(4, volumePercent)}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {status === 'idle' && (
        <EmptyState
          icon={HeadphonesIcon}
          title="Welcome to Audio Scrobbler"
          description="Connect your Spotify account above to begin tracking your music listening history."
        />
      )}
      {status === 'error' && (
        <EmptyState
          icon={AlertIcon}
          title="Something went wrong"
          description={error}
          error
        />
      )}
      {status === 'ready' && summary?.summary.length === 0 && (
        <EmptyState
          icon={GhostIcon}
          title="It's quiet in here"
          description="We couldn't find any scrobbles for this date range."
        />
      )}
      {status === 'ready' && (
        <div className="connect-handoff-card">
          <div className="connect-handoff-content">
            <h4>Explore Analytics & Reports</h4>
            <p>
              Looking for deeper insights? Explore listening charts in Overview or view breakdown reports in Reports.
            </p>
          </div>
          <div className="connect-handoff-actions">
            <Link to="/overview" className="btn-secondary">Overview →</Link>
            <Link to="/reports" className="btn-secondary">Reports →</Link>
          </div>
        </div>
      )}
      {status === 'ready' && (
        <div className="connect-feed-container">
          <ScrobbleList scrobbles={scrobbles} title="Recent Ingestion Activity" />
          {scrobbles && scrobbles.length > 0 && (
            <div className="connect-feed-footer">
              <span>View and search your complete listening history in </span>
              <Link to="/library" className="connect-feed-link">
                Library →
              </Link>
            </div>
          )}
        </div>
      )}

      {import.meta.env.DEV && (
        <details className="dev-tools-details" open style={{ marginTop: '3rem', padding: '1rem', border: '0.5px dashed var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-muted)', fontSize: '0.85rem' }}>
            Developer Tools (Local Testing Only)
          </summary>
          <form className="filters" onSubmit={token ? loadSummary : signIn} style={{ marginTop: '1rem', marginBottom: 0 }}>
            <label>
              Development user ID
              <input type="number" min="1" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="1" />
            </label>
            <label>
              From
              <CustomDateField
                id="dev-connect-from-month"
                type="month"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                placeholder="Any date"
              />
            </label>
            <label>
              To
              <CustomDateField
                id="dev-connect-to-month"
                type="month"
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                placeholder="Any date"
              />
            </label>
            <button type="submit" className="btn-secondary" disabled={status === 'loading'}>
              {status === 'loading' ? 'Loading...' : token ? 'Refresh summary' : 'Sign in'}
            </button>
            {token && <button type="button" className="btn-secondary" onClick={clearSession}>Sign out</button>}
          </form>
        </details>
      )}
    </section>
  )
}
