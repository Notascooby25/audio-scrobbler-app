import { useEffect, useRef, useState } from 'react'
import AnalyticsPage from '../components/AnalyticsPage'
import DateRangeSelector from '../components/DateRangeSelector'
import LibraryRankList from '../components/LibraryRankList'
import LibraryScrobbleList from '../components/LibraryScrobbleList'
import LibraryViewToggle from '../components/LibraryViewToggle'
import PageSizeSelect from '../components/PageSizeSelect'
import Pagination from '../components/Pagination'
import TimelineChart from '../components/TimelineChart'
import { fetchLikedTracks, fetchLibraryCollection, fetchLibraryScrobbles, fetchLibraryTimeline, fetchUserSettings } from '../api'
import { createDefaultDateRange, isValidDateRange } from '../dateRange'
import { readSession } from '../session'

const TABS = [
  ['scrobbles', 'Scrobbles'],
  ['artists', 'Artists'],
  ['albums', 'Albums'],
  ['tracks', 'Tracks'],
  ['liked', 'Liked tracks'],
]

export default function LibraryPage() {
  const session = readSession()
  const [tab, setTab] = useState('scrobbles')
  const [dateRange, setDateRange] = useState(createDefaultDateRange())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [view, setView] = useState(() => localStorage.getItem('audio-scrobbler-library-view') || 'list')
  const [settings, setSettings] = useState(null)
  const [preferencesReady, setPreferencesReady] = useState(!session?.accessToken)
  const [totalCount, setTotalCount] = useState(0)
  const [data, setData] = useState(null)
  const [loadedTab, setLoadedTab] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [status, setStatus] = useState(session?.accessToken ? 'loading' : 'idle')
  const [error, setError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const isDateFilterable = tab !== 'liked'
  const filterKeyRef = useRef(null)

  useEffect(() => {
    if (!session?.accessToken) return
    fetchUserSettings({ token: session.accessToken })
      .then((userSettings) => {
        setSettings(userSettings)
        setDateRange((current) => ({ ...current, range: userSettings.default_date_range }))
        setPageSize(userSettings.default_page_size)
        setView(userSettings.scrobbles_view || userSettings.default_library_view)
        setPreferencesReady(true)
      })
      .catch(() => setPreferencesReady(true))
  }, [])

  useEffect(() => {
    if (!session?.accessToken) return
    if (!preferencesReady) return
    if (isDateFilterable && !isValidDateRange(dateRange)) return

    const filterKey = `${tab}|${JSON.stringify(dateRange)}|${pageSize}`
    if (filterKeyRef.current !== null && filterKeyRef.current !== filterKey && page !== 1) {
      filterKeyRef.current = filterKey
      setPage(1)
      return
    }
    filterKeyRef.current = filterKey

    setStatus('loading')
    setData(null)
    const offset = (page - 1) * pageSize
    const rangeArg = isDateFilterable ? dateRange : undefined
    const request = tab === 'scrobbles'
      ? fetchLibraryScrobbles({ token: session.accessToken, limit: pageSize, offset, dateRange: rangeArg })
      : tab === 'liked'
        ? fetchLikedTracks({ token: session.accessToken, limit: pageSize, offset })
      : fetchLibraryCollection({ token: session.accessToken, entity: tab, limit: pageSize, offset, dateRange: rangeArg })
    Promise.all([request, fetchLibraryTimeline({ token: session.accessToken })])
      .then(([result, chart]) => {
        setData(result)
        setLoadedTab(tab)
        setTotalCount(result.total_count ?? 0)
        setTimeline(chart.entries)
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(requestError.message)
        setStatus('error')
      })
  }, [tab, dateRange, pageSize, page, preferencesReady, refreshKey])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const rankedEntries = data && loadedTab === tab && tab !== 'scrobbles'
    ? (tab === 'liked'
      ? data.tracks.map((track) => ({
        label: track.track_name,
        secondary: track.artist_name,
        play_count: 1,
        artwork_url: track.artwork_url,
        spotify_track_id: track.spotify_track_id,
        is_liked: true,
      }))
      : data.entries)
    : []

  const changeView = (nextView) => {
    setView(nextView)
    setSettings((current) => current ? { ...current, [`${tab}_view`]: nextView } : current)
    localStorage.setItem('audio-scrobbler-library-view', nextView)
  }

  const activeView = settings?.[`${tab}_view`] || view

  const handleEntryChanged = (message) => {
    setActionNotice(message)
    setRefreshKey((current) => current + 1)
  }

  return (
    <AnalyticsPage eyebrow="Personal archive" title="Library">
      {!session?.accessToken && <p className="notice">Connect Spotify from the <a href="/connect">connection page</a> to browse your library.</p>}
      {status === 'loading' && <p className="notice">Loading your library...</p>}
      {status === 'error' && <p className="notice notice-error" role="alert">{error}</p>}
      {actionNotice && <p className="notice" role="status">{actionNotice}</p>}
      {session?.accessToken && (
        <>
          <div className="library-tabs" role="tablist" aria-label="Library sections">
            {TABS.map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>
            ))}
          </div>
          {isDateFilterable && <DateRangeSelector value={dateRange} onChange={setDateRange} />}
          <div className="library-toolbar">
            <LibraryViewToggle view={activeView} onChange={changeView} />
          </div>
          <div className="library-layout">
            {tab === 'scrobbles'
              ? <LibraryScrobbleList scrobbles={data && loadedTab === tab ? data.scrobbles : []} token={session.accessToken} view={activeView} showArtwork={settings?.show_artwork !== false} showSourceBadges={settings?.show_source_badges !== false} timestampMode={settings?.timestamp_mode || 'relative'} />
              : <LibraryRankList entries={rankedEntries} kind={tab === 'liked' ? 'tracks' : tab} token={session.accessToken} page={page} pageSize={pageSize} totalCount={totalCount} view={activeView} showArtwork={settings?.show_artwork !== false} onEntryChanged={tab !== 'liked' ? handleEntryChanged : undefined} />}
            <TimelineChart entries={timeline} />
          </div>
          <div className="library-pagination-bar">
            <PageSizeSelect value={pageSize} onChange={setPageSize} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </AnalyticsPage>
  )
}