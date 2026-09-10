import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMonthlySummary, fetchRecentScrobbles, redirectToAuthorization, requestDevelopmentToken, requestSpotifyAuthorization, submitImportScrobbles } from '../api'
import ChartsPanel from '../components/ChartsPanel'
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
  if (callbackError) localStorage.removeItem('audio-scrobbler-session')
  if (callbackSession) localStorage.setItem('audio-scrobbler-session', JSON.stringify(callbackSession))
  const savedSession = callbackSession?.accessToken ? callbackSession : readSavedSession()
  const [userId, setUserId] = useState(savedSession?.userId || '')
  const [token, setToken] = useState(savedSession?.accessToken || '')
  const [fromMonth, setFromMonth] = useState('')
  const [toMonth, setToMonth] = useState('')
  const [summary, setSummary] = useState(null)
  const [scrobbles, setScrobbles] = useState([])
  const [error, setError] = useState(callbackError ? 'Spotify authorization was cancelled.' : '')
  const [status, setStatus] = useState(callbackError ? 'error' : savedSession?.accessToken ? 'loading' : 'idle')
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const importInputRef = useRef(null)

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
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const entries = Array.isArray(parsed) ? parsed : parsed.history || parsed.entries || []
      const firstEntry = entries[0] || {}
      const looksLikeSpotify = 'trackUri' in firstEntry || 'endTime' in firstEntry || 'trackName' in firstEntry || 'spotify_track_uri' in firstEntry || 'master_metadata_track_name' in firstEntry
      const looksLikeYoutube = 'song' in firstEntry || 'subtitles' in firstEntry || 'titleUrl' in firstEntry
      const source = looksLikeSpotify
        ? 'spotify'
        : looksLikeYoutube || file.name.toLowerCase().includes('youtube') || file.name.toLowerCase().includes('watch-history')
          ? 'youtube'
          : 'spotify'
      const result = await submitImportScrobbles({ token, source, entries })
      setImportResult(result)
      await loadSummary(null, token)
    } catch (requestError) {
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
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Audio Scrobbler App</p>
          <h1>Listening, month by month.</h1>
        </div>
        <nav className="topbar-nav">
          {token && <Link to="/profile">Profile</Link>}
          <span className="status-mark" aria-label="Analytics dashboard">Live analytics</span>
        </nav>
      </header>

      <section className="dashboard" aria-labelledby="summary-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Personal archive</p>
            <h2 id="summary-heading">Monthly summary</h2>
          </div>
          {summary && <p className="month-count">{summary.total_months} months found</p>}
        </div>

        <form className="filters" onSubmit={token ? loadSummary : signIn}>
          <label>
            Development user ID
            <input type="number" min="1" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="1" />
          </label>
          <label>
            From
            <input type="month" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} />
          </label>
          <label>
            To
            <input type="month" value={toMonth} onChange={(event) => setToMonth(event.target.value)} />
          </label>
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Loading...' : token ? 'Refresh summary' : 'Sign in'}
          </button>
          {token && <button type="button" onClick={clearSession}>Sign out</button>}
        </form>
        {!token && <button type="button" onClick={connectSpotify}>Connect Spotify</button>}
        {token && (
          <div className="import-panel">
            <label className="import-picker">
              Import history JSON
              <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImport} />
            </label>
            <ImportSummaryPanel
              result={importResult}
              error={importError}
              onDismiss={() => {
                setImportResult(null)
                setImportError('')
              }}
            />
          </div>
        )}

        {status === 'idle' && <p className="notice">Connect your account to see your listening history.</p>}
        {status === 'error' && <p className="notice notice-error" role="alert">{error}</p>}
        {status === 'ready' && summary?.summary.length === 0 && <p className="notice">No listens found for this date range.</p>}
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
      </section>
    </main>
  )
}
