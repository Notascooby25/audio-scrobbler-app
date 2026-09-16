import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import DateRangeSelector from '../components/DateRangeSelector'
import RankedList from '../components/RankedList'
import SummaryStatsBar from '../components/SummaryStatsBar'
import { fetchStatsChart, fetchStatsSummary } from '../api'
import { createDefaultDateRange, isValidDateRange } from '../dateRange'
import { readSession } from '../session'

export default function OverviewPage() {
  const session = readSession()
  const [dateRange, setDateRange] = useState(createDefaultDateRange())
  const [summary, setSummary] = useState(null)
  const [charts, setCharts] = useState(null)
  const [status, setStatus] = useState(session?.accessToken ? 'loading' : 'idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.accessToken) return
    fetchStatsSummary({ token: session.accessToken }).then(setSummary).catch((requestError) => {
      setError(requestError.message)
      setStatus('error')
    })
  }, [])

  useEffect(() => {
    if (!session?.accessToken) return
    if (!isValidDateRange(dateRange)) return
    setStatus('loading')
    Promise.all([
      fetchStatsChart({ token: session.accessToken, entity: 'artists', limit: 10, dateRange }),
      fetchStatsChart({ token: session.accessToken, entity: 'albums', limit: 10, dateRange }),
      fetchStatsChart({ token: session.accessToken, entity: 'tracks', limit: 10, dateRange }),
    ]).then(([artists, albums, tracks]) => {
      setCharts({ artists: artists.entries, albums: albums.entries, tracks: tracks.entries })
      setStatus('ready')
    }).catch((requestError) => {
      setError(requestError.message)
      setStatus('error')
    })
  }, [dateRange])

  return (
    <AnalyticsPage eyebrow="Personal archive" title="Overview">
      {!session?.accessToken && <p className="notice">Connect Spotify from the <Link to="/connect">connection page</Link> to see your listening overview.</p>}
      {status === 'loading' && <p className="notice">Loading your listening overview...</p>}
      {status === 'error' && <p className="notice notice-error" role="alert">{error}</p>}
      {summary && (
        <>
          <SummaryStatsBar stats={summary} />
          <DateRangeSelector value={dateRange} onChange={setDateRange} showCompare={false} />
          {charts && (
            <div className="overview-grid">
              <RankedList title="Top artists" entries={charts.artists} />
              <RankedList title="Top albums" entries={charts.albums} />
              <RankedList title="Top tracks" entries={charts.tracks} />
            </div>
          )}
          <p className="page-link"><Link to="/library">Explore the full library</Link></p>
        </>
      )}
    </AnalyticsPage>
  )
}
