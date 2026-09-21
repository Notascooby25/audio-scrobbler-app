import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import DateRangeSelector from '../components/DateRangeSelector'
import LibraryRankList from '../components/LibraryRankList'
import BarTrendChart from '../components/charts/BarTrendChart'
import ListeningClockChart from '../components/charts/ListeningClockChart'
import { fetchReportsCharts, fetchReportsEntity, fetchReportsSummary, fetchUserProfile } from '../api'
import { createDefaultDateRange, DATE_RANGE_PRESETS, isValidDateRange } from '../dateRange'
import { readSession } from '../session'

const REPORTS = [
  ['Music ratio', 'Compare artists, albums, and tracks in your history.'],
  ['Listening fingerprint', 'A richer listening profile will be calculated from your history.'],
  ['Music by decade', 'Release-year metadata will unlock this view.'],
]

function dateRangeFromParams(searchParams) {
  const range = searchParams.get('range')
  if (range && range !== 'custom' && DATE_RANGE_PRESETS.includes(range)) {
    return { range, start_date: null, end_date: null, compare_to_previous: false }
  }
  return createDefaultDateRange()
}

export default function ReportsPage() {
  const session = readSession()
  const [searchParams] = useSearchParams()
  const routeUserId = searchParams.get('userId')
  const targetUserId = routeUserId ? Number(routeUserId) : undefined
  const isOwnReport = !routeUserId || Number(routeUserId) === session?.userId
  const [targetProfile, setTargetProfile] = useState(null)
  const [dateRange, setDateRange] = useState(() => dateRangeFromParams(searchParams))
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.accessToken || isOwnReport) {
      setTargetProfile(null)
      return
    }
    fetchUserProfile({ token: session.accessToken, userId: targetUserId })
      .then(setTargetProfile)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeUserId])

  useEffect(() => {
    if (!session?.accessToken) return
    if (!isValidDateRange(dateRange)) return
    setError('')
    Promise.all([
      fetchReportsSummary({ token: session.accessToken, dateRange, userId: targetUserId }),
      fetchReportsCharts({ token: session.accessToken, dateRange, userId: targetUserId }),
      fetchReportsEntity({ token: session.accessToken, entity: 'artists', dateRange, userId: targetUserId }),
      fetchReportsEntity({ token: session.accessToken, entity: 'albums', dateRange, userId: targetUserId }),
      fetchReportsEntity({ token: session.accessToken, entity: 'tracks', dateRange, userId: targetUserId }),
      fetchReportsEntity({ token: session.accessToken, entity: 'playlists', dateRange, userId: targetUserId }),
    ]).then(([summary, charts, artists, albums, tracks, playlists]) => setReport({ summary, charts, artists, albums, tracks, playlists }))
      .catch((requestError) => setError(requestError.status === 403 ? "Follow this user to see their reports." : requestError.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, routeUserId])

  return (
    <AnalyticsPage eyebrow="Listening report" title={isOwnReport ? 'Reports' : `@${targetProfile?.username || '...'}'s Reports`}>
      {!session?.accessToken && <p className="notice">Connect Spotify from the <Link to="/connect">connection page</Link> to see your listening report.</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <DateRangeSelector value={dateRange} onChange={setDateRange} />
      <div className="report-banner">
        <div>
          <p className="section-kicker">Your listening story</p>
          <h2>Patterns worth returning to.</h2>
          {report && (
            <p>
              {report.summary.period_scrobbles.toLocaleString()} scrobbles this period
              {dateRange.compare_to_previous && `, ${report.summary.comparison_percent}% versus the previous period`}.
            </p>
          )}
        </div>
        <Link to={isOwnReport ? '/library' : `/library?userId=${targetUserId}`}>Browse the source history</Link>
      </div>
      {report && <div className="report-facts">
        <div><strong>{Number(report.summary.listening_minutes || 0).toLocaleString()}</strong><span>Listening minutes</span></div>
        <div><strong>{Number(report.summary.average_per_day || 0)}</strong><span>Average per day</span></div>
        {dateRange.compare_to_previous && (
          <div><strong>{Number(report.summary.previous_period_scrobbles || 0).toLocaleString()}</strong><span>Previous period</span></div>
        )}
        {report.summary.following_average_scrobbles !== null && report.summary.following_average_scrobbles !== undefined && (
          <div><strong>{Number(report.summary.following_average_scrobbles).toLocaleString()}</strong><span>Friends' average</span></div>
        )}
      </div>}
      {report && <div className="report-data-grid">
        <BarTrendChart title="Scrobbles over time" points={report.charts.weekly_scrobbles} />
        <ListeningClockChart points={report.charts.listening_clock} />
      </div>}
      {report && <div className="report-category-grid">
        <LibraryRankList entries={report.artists.entries} kind="artists" token={session.accessToken} page={1} pageSize={10} totalCount={report.artists.entries.length} view="list" userId={targetUserId} />
        <LibraryRankList entries={report.albums.entries} kind="albums" token={session.accessToken} page={1} pageSize={10} totalCount={report.albums.entries.length} view="list" userId={targetUserId} />
        <LibraryRankList entries={report.tracks.entries} kind="tracks" token={session.accessToken} page={1} pageSize={10} totalCount={report.tracks.entries.length} view="list" userId={targetUserId} />
        <LibraryRankList entries={report.playlists.entries} kind="playlists" token={session.accessToken} page={1} pageSize={10} totalCount={report.playlists.entries.length} view="list" userId={targetUserId} />
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
      {report && report.charts.music_by_decade && report.charts.music_by_decade.length > 0 && (
        <div className="report-decade-chart">
          <h2>Music by decade</h2>
          <BarTrendChart title="Releases by decade" points={report.charts.music_by_decade} />
        </div>
      )}
    </AnalyticsPage>
  )
}