import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import DateRangeSelector from '../components/DateRangeSelector'
import LibraryRankList from '../components/LibraryRankList'
import BarTrendChart from '../components/charts/BarTrendChart'
import ListeningClockChart from '../components/charts/ListeningClockChart'
import { fetchReportsCharts, fetchReportsEntity, fetchReportsSummary } from '../api'
import { createDefaultDateRange, isValidDateRange } from '../dateRange'
import { readSession } from '../session'

const REPORTS = [
  ['Music ratio', 'Compare artists, albums, and tracks in your history.'],
  ['Listening fingerprint', 'A richer listening profile will be calculated from your history.'],
  ['Music by decade', 'Release-year metadata will unlock this view.'],
]

export default function ReportsPage() {
  const session = readSession()
  const [dateRange, setDateRange] = useState(createDefaultDateRange())
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.accessToken) return
    if (!isValidDateRange(dateRange)) return
    Promise.all([
      fetchReportsSummary({ token: session.accessToken, dateRange }),
      fetchReportsCharts({ token: session.accessToken, dateRange }),
      fetchReportsEntity({ token: session.accessToken, entity: 'artists', dateRange }),
      fetchReportsEntity({ token: session.accessToken, entity: 'albums', dateRange }),
      fetchReportsEntity({ token: session.accessToken, entity: 'tracks', dateRange }),
    ]).then(([summary, charts, artists, albums, tracks]) => setReport({ summary, charts, artists, albums, tracks }))
      .catch((requestError) => setError(requestError.message))
  }, [dateRange])

  return (
    <AnalyticsPage eyebrow="Listening report" title="Reports">
      {!session?.accessToken && <p className="notice">Connect Spotify from the <Link to="/connect">connection page</Link> to see your listening report.</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <DateRangeSelector value={dateRange} onChange={setDateRange} />
      <div className="report-banner">
        <div>
          <p className="section-kicker">Your listening story</p>
          <h2>Patterns worth returning to.</h2>
          {report && <p>{report.summary.period_scrobbles.toLocaleString()} scrobbles this period, {report.summary.comparison_percent}% versus the previous period.</p>}
        </div>
        <Link to="/library">Browse the source history</Link>
      </div>
      {report && <div className="report-facts">
        <div><strong>{Number(report.summary.listening_minutes || 0).toLocaleString()}</strong><span>Listening minutes</span></div>
        <div><strong>{Number(report.summary.average_per_day || 0)}</strong><span>Average per day</span></div>
        <div><strong>{Number(report.summary.previous_period_scrobbles || 0).toLocaleString()}</strong><span>Previous period</span></div>
      </div>}
      {report && <div className="report-data-grid">
        <BarTrendChart title="Scrobbles over time" points={report.charts.weekly_scrobbles} />
        <ListeningClockChart points={report.charts.listening_clock} />
      </div>}
      {report && <div className="report-category-grid">
        <LibraryRankList entries={report.artists.entries} kind="artists" token={session.accessToken} page={1} pageSize={10} totalCount={report.artists.entries.length} view="list" />
        <LibraryRankList entries={report.albums.entries} kind="albums" token={session.accessToken} page={1} pageSize={10} totalCount={report.albums.entries.length} view="list" />
        <LibraryRankList entries={report.tracks.entries} kind="tracks" token={session.accessToken} page={1} pageSize={10} totalCount={report.tracks.entries.length} view="list" />
      </div>}
      <div className="report-grid">
        {REPORTS.map(([title, description]) => (
          <article className="report-card" key={title}>
            <p className="section-kicker">Coming soon</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </AnalyticsPage>
  )
}