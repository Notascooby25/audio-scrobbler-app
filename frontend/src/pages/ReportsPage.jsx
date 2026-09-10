import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import DateRangeSelector from '../components/DateRangeSelector'
import { fetchReportsCharts, fetchReportsSummary } from '../api'
import { createDefaultDateRange, isValidDateRange } from '../dateRange'
import { readSession } from '../session'

const REPORTS = [
  ['Weekly scrobbles', 'Compare this week with the previous period.'],
  ['Listening clock', 'See when your listening habit is most active.'],
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
    ]).then(([summary, charts]) => setReport({ summary, charts }))
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
      <div className="report-grid">
        {REPORTS.map(([title, description]) => (
          <article className="report-card" key={title}>
            <p className="section-kicker">Report</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>
      {report && <div className="report-data-grid"><RankedReport title="Weekly scrobbles" entries={report.charts.weekly_scrobbles} /><RankedReport title="Listening clock" entries={report.charts.listening_clock} /></div>}
    </AnalyticsPage>
  )
}

function RankedReport({ title, entries }) {
  return (
    <section className="report-card">
      <p className="section-kicker">Live data</p>
      <h2>{title}</h2>
      {entries.length === 0 ? <p>No data available for this period.</p> : entries.map((entry) => <p key={entry.label}><strong>{entry.label}</strong> {entry.count} scrobbles</p>)}
    </section>
  )
}