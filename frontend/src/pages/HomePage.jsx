import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMonthlySummary, fetchRecentScrobbles, fetchSpotifyStatus, redirectToAuthorization, requestDevelopmentToken, requestSpotifyAuthorization, submitImportScrobbles, submitUnifiedImport } from '../api'
import ChartsPanel from '../components/ChartsPanel'
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
  const [scrobbles, setScrobbles] = useState([])
  const [error, setError] = useState(callbackError ? callbackErrorMessage : '')
  const [status, setStatus] = useState(callbackError ? 'error' : savedSession?.accessToken ? 'loading' : 'idle')
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const [importProgress, setImportProgress] = useState('')
  const [liveProgress, setLiveProgress] = useState(null)
  const [spotifyRetryAfter, setSpotifyRetryAfter] = useState(null)
  const importInputRef = useRef(null)

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
          <h2 id="summary-heading">Connect & Data Sources</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Manage streaming connections and import listening history files.
          </p>
        </div>
        {token && (
          <button type="button" className="btn-secondary" onClick={clearSession}>
            Sign out
          </button>
        )}
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
              <h3>Monthly listening summary</h3>
            </div>
            {summary && <p className="month-count">{summary.total_months} months found</p>}
          </div>

          <form className="filters" onSubmit={loadSummary}>
            <label>
              From
              <CustomDateField
                id="connect-from-month"
                type="month"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                placeholder="Any date"
              />
            </label>
            <label>
              To
              <CustomDateField
                id="connect-to-month"
                type="month"
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                placeholder="Any date"
              />
            </label>
            <button type="submit" className="btn-secondary" disabled={status === 'loading'}>
              {status === 'loading' ? 'Loading...' : 'Refresh summary'}
            </button>
          </form>
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
      {status === 'ready' && summary?.summary.length > 0 && (
        <div className="summary-grid">
          {summary.summary.map((month) => (
            <article className="month-card" key={month.month}>
              <p className="month-label">{month.month}</p>
              <strong>{month.total_plays.toLocaleString()}</strong>
              <span>plays</span>
              <dl>
                <div><dt>Tracks</dt><dd>{month.unique_tracks.toLocaleString()}</dd></div>
                <div><dt>Listening</dt><dd>{month.total_listening_minutes.toLocaleString()} min</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}
      {status === 'ready' && <ChartsPanel token={token} userId={savedSession?.userId} />}
      {status === 'ready' && <ScrobbleList scrobbles={scrobbles} />}

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
