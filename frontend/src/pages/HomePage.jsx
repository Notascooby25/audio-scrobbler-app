import { useEffect, useRef, useState } from 'react'
import { fetchMonthlySummary, fetchRecentScrobbles, redirectToAuthorization, requestDevelopmentToken, requestSpotifyAuthorization, submitImportScrobbles, submitUnifiedImport } from '../api'
import ChartsPanel from '../components/ChartsPanel'
import CustomDateField from '../components/CustomDateField'
import ImportProgressBar from '../components/ImportProgressBar'
import ImportSummaryPanel from '../components/ImportSummaryPanel'
import ScrobbleList from '../components/ScrobbleList'

const IMPORT_BATCH_SIZE = 250

function mergeImportResult(current, next) {
  return {
    source: next.source,
    status: next.status,
    summary: {
      inserted: (current?.summary?.inserted || 0) + (next.summary?.inserted || 0),
      skipped: (current?.summary?.skipped || 0) + (next.summary?.skipped || 0),
      duplicate: (current?.summary?.duplicate || 0) + (next.summary?.duplicate || 0),
    },
  }
}

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
  const [importProgress, setImportProgress] = useState('')
  const [liveProgress, setLiveProgress] = useState(null)
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
    setImportProgress('')
    setLiveProgress(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const entries = Array.isArray(parsed) ? parsed : parsed.history || parsed.entries || []
      if (!entries.length) throw new Error('No history entries found in this JSON file.')
      const firstEntry = entries[0] || {}
      const looksLikeSpotify = 'trackUri' in firstEntry || 'endTime' in firstEntry || 'trackName' in firstEntry || 'spotify_track_uri' in firstEntry || 'master_metadata_track_name' in firstEntry
      const looksLikeYoutube = 'song' in firstEntry || 'subtitles' in firstEntry || 'titleUrl' in firstEntry
      const source = looksLikeSpotify
        ? 'spotify'
        : looksLikeYoutube || file.name.toLowerCase().includes('youtube') || file.name.toLowerCase().includes('watch-history')
          ? 'youtube'
          : 'spotify'

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
  )
}
