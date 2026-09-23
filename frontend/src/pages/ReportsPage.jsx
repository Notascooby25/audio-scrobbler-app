import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import DateRangeSelector from '../components/DateRangeSelector'
import LibraryRankList from '../components/LibraryRankList'
import BarTrendChart from '../components/charts/BarTrendChart'
import ListeningHeatmap from '../components/charts/ListeningHeatmap'
import ListeningClockChart from '../components/charts/ListeningClockChart'
import GenreBarList from '../components/charts/GenreBarList'
import { fetchReportsCharts, fetchReportsEntity, fetchReportsSummary, fetchUserProfile } from '../api'
import { createDefaultDateRange, DATE_RANGE_PRESETS, isValidDateRange } from '../dateRange'
import { readSession } from '../session'


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
      fetchReportsEntity({ token: session.accessToken, entity: 'genres', dateRange, userId: targetUserId }),
    ]).then(([summary, charts, artists, albums, tracks, genres]) => setReport({ summary, charts, artists, albums, tracks, genres }))
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
      </div>}
            {report && <div className="report-data-grid">
        <BarTrendChart title="Scrobbles over time" points={report.charts.weekly_scrobbles} />
      </div>}
      {report && <div className="report-time-grid">
        <div className="chart-panel">
          <h2>Listening routines</h2>
          <ListeningHeatmap points={report.charts.listening_heatmap} />
          <div className="chart-caption">Your listening activity mapped by hour and day of the week.</div>
        </div>
        <ListeningClockChart points={report.charts.listening_clock} />
      </div>}
      {report && <div className="report-character-grid">
        <div className="chart-panel">
          <h2>Music by decade</h2>
          <BarTrendChart title="Releases by decade" points={report.charts.music_by_decade} />
        </div>
        <div className="chart-panel">
          <h2>Top genres</h2>
          <GenreBarList genres={report.genres?.entries?.map(e => ({ label: e.label, count: e.play_count })) || []} />
        </div>
      </div>}
      {report && <div className="report-category-grid">
        <LibraryRankList entries={report.artists.entries} kind="artists" token={session.accessToken} page={1} pageSize={10} totalCount={report.artists.entries.length} view="list" userId={targetUserId} />
        <LibraryRankList entries={report.albums.entries} kind="albums" token={session.accessToken} page={1} pageSize={10} totalCount={report.albums.entries.length} view="list" userId={targetUserId} />
        <LibraryRankList entries={report.tracks.entries} kind="tracks" token={session.accessToken} page={1} pageSize={10} totalCount={report.tracks.entries.length} view="list" userId={targetUserId} />

      </div>}
      {report && <div className="report-character-grid" style={{ marginBottom: '16px' }}>
        <div className="chart-panel">
          <p className="section-kicker">Music ratio</p>
          <h2>Explorer vs. Repeater</h2>
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text)' }}>
              {(report.summary.period_scrobbles / Math.max(1, report.summary.unique_artists)).toFixed(1)}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px' }}>
              Scrobbles per artist
            </div>
          </div>
          <div className="chart-caption" style={{ textAlign: 'center' }}>
            A lower number means you constantly discover new artists. A higher number means you loop your favorites.
          </div>
        </div>
        <div className="chart-panel">
          <p className="section-kicker">Music ratio</p>
          <h2>Singles vs. Albums</h2>
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text)' }}>
              {(report.summary.unique_tracks / Math.max(1, report.summary.unique_albums)).toFixed(1)}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px' }}>
              Tracks per album
            </div>
          </div>
          <div className="chart-caption" style={{ textAlign: 'center' }}>
            A lower number means you pick and choose singles. A higher number means you listen to full albums.
          </div>
        </div>
      </div>}
      
    </AnalyticsPage>
  )
}