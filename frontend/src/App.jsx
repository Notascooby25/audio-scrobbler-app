import { useEffect, useState } from 'react'
import { fetchMonthlySummary } from './api'

const savedToken = localStorage.getItem('audio-scrobbler-token') || ''

export default function App() {
  const [token, setToken] = useState(savedToken)
  const [fromMonth, setFromMonth] = useState('')
  const [toMonth, setToMonth] = useState('')
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState(savedToken ? 'loading' : 'idle')
  const [error, setError] = useState('')

  const loadSummary = async (event) => {
    event?.preventDefault()
    if (!token.trim()) {
      setError('Enter a bearer token to load your listening history.')
      setStatus('error')
      return
    }

    localStorage.setItem('audio-scrobbler-token', token.trim())
    setStatus('loading')
    setError('')

    try {
      const data = await fetchMonthlySummary({ token: token.trim(), fromMonth, toMonth })
      setSummary(data)
      setStatus('ready')
    } catch (requestError) {
      setSummary(null)
      setError(requestError.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    if (savedToken) loadSummary()
  }, [])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Audio Scrobbler App</p>
          <h1>Listening, month by month.</h1>
        </div>
        <span className="status-mark" aria-label="Analytics dashboard">Live analytics</span>
      </header>

      <section className="dashboard" aria-labelledby="summary-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Personal archive</p>
            <h2 id="summary-heading">Monthly summary</h2>
          </div>
          {summary && <p className="month-count">{summary.total_months} months found</p>}
        </div>

        <form className="filters" onSubmit={loadSummary}>
          <label>
            Bearer token
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste your token" autoComplete="off" />
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
            {status === 'loading' ? 'Loading...' : 'Refresh summary'}
          </button>
        </form>

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
      </section>
    </main>
  )
}
