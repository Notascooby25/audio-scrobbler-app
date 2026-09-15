import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import DateRangeSelector from '../components/DateRangeSelector'
import LibraryRankList from '../components/LibraryRankList'
import LibraryScrobbleList from '../components/LibraryScrobbleList'
import LibraryViewToggle from '../components/LibraryViewToggle'
import PageSizeSelect from '../components/PageSizeSelect'
import Pagination from '../components/Pagination'
import TimelineChart from '../components/TimelineChart'
import { createBlock, deleteLibraryEntries, deleteLibraryScrobbles, fetchLikedTracks, fetchLibraryCollection, fetchLibraryScrobbles, fetchLibraryTimeline, fetchUserSettings } from '../api'
import { createDefaultDateRange, isValidDateRange } from '../dateRange'
import { readSession } from '../session'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

const TABS = [
  ['scrobbles', 'Scrobbles'],
  ['artists', 'Artists'],
  ['albums', 'Albums'],
  ['tracks', 'Tracks'],
  ['liked', 'Liked tracks'],
]

export default function LibraryPage() {
  const session = readSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('filter_name') ? 'scrobbles' : 'scrobbles')
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
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [selectedScrobbleIds, setSelectedScrobbleIds] = useState(new Set())
  const [selectedEntries, setSelectedEntries] = useState(new Map())
  const [scrobbleFilter, setScrobbleFilter] = useState(() => ({
    entity: searchParams.get('filter_entity') || null,
    name: searchParams.get('filter_name') || null,
    secondary: searchParams.get('filter_secondary') || null,
  }))
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearchQuery, setActiveSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const isDateFilterable = tab !== 'liked'
  const filterKeyRef = useRef(null)

  useEffect(() => {
    const filter = {
      entity: searchParams.get('filter_entity') || null,
      name: searchParams.get('filter_name') || null,
      secondary: searchParams.get('filter_secondary') || null,
    }
    setScrobbleFilter(filter)
    if (filter.name) setTab('scrobbles')
  }, [searchParams])

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

    const filterKey = `${tab}|${JSON.stringify(dateRange)}|${pageSize}|${activeSearchQuery}`
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
      ? fetchLibraryScrobbles({ token: session.accessToken, limit: pageSize, offset, dateRange: rangeArg, filterEntity: scrobbleFilter.entity, filterName: scrobbleFilter.name, filterSecondary: scrobbleFilter.secondary, search: activeSearchQuery || undefined })
      : tab === 'liked'
        ? fetchLikedTracks({ token: session.accessToken, limit: pageSize, offset, search: activeSearchQuery || undefined })
      : fetchLibraryCollection({ token: session.accessToken, entity: tab, limit: pageSize, offset, dateRange: rangeArg, search: activeSearchQuery || undefined })
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
  }, [tab, dateRange, pageSize, page, preferencesReady, refreshKey, scrobbleFilter, activeSearchQuery])

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
  const visibleScrobbles = data && loadedTab === tab && tab === 'scrobbles' ? data.scrobbles : []
  const selectedCount = tab === 'scrobbles' ? selectedScrobbleIds.size : selectedEntries.size

  const clearSelection = () => {
    setSelectedScrobbleIds(new Set())
    setSelectedEntries(new Map())
    setBulkError('')
  }

  const handleEntryChanged = (message) => {
    setActionNotice(message)
    setRefreshKey((current) => current + 1)
  }

  const toggleScrobbleSelection = (id) => {
    setSelectedScrobbleIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleEntrySelection = (entry) => {
    setSelectedEntries((current) => {
      const next = new Map(current)
      if (next.has(entry.key)) next.delete(entry.key)
      else next.set(entry.key, entry)
      return next
    })
  }

  const toggleVisibleSelection = () => {
    if (tab === 'scrobbles') {
      const visibleIds = visibleScrobbles.map((scrobble) => scrobble.id)
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedScrobbleIds.has(id))
      setSelectedScrobbleIds(allSelected ? new Set() : new Set(visibleIds))
      return
    }

    const entityType = tab === 'artists' ? 'artist' : tab === 'albums' ? 'album' : tab === 'tracks' ? 'track' : null
    if (!entityType) return
    const visibleEntries = rankedEntries.map((entry) => ({ key: `${entityType}:${entry.label}:${entry.secondary || ''}`, entityType, name: entry.label, secondary: entry.secondary }))
    const allSelected = visibleEntries.length > 0 && visibleEntries.every((entry) => selectedEntries.has(entry.key))
    setSelectedEntries(allSelected ? new Map() : new Map(visibleEntries.map((entry) => [entry.key, entry])))
  }

  const promptBulkDelete = () => {
    setConfirmDeleteOpen(true)
  }

  const executeBulkDelete = async () => {
    setBulkBusy(true)
    setBulkError('')
    try {
      if (tab === 'scrobbles') {
        const result = await deleteLibraryScrobbles({ token: session.accessToken, ids: Array.from(selectedScrobbleIds) })
        handleEntryChanged(`Deleted ${result.deleted} selected scrobbles.`)
      } else {
        const entries = Array.from(selectedEntries.values())
        const results = await Promise.all(entries.map((entry) => deleteLibraryEntries({
          token: session.accessToken,
          entityType: entry.entityType,
          name: entry.name,
          secondary: entry.entityType === 'track' ? entry.secondary : undefined,
        })))
        const deleted = results.reduce((total, result) => total + (result.deleted || 0), 0)
        handleEntryChanged(`Deleted ${deleted} scrobbles for ${entries.length} selected entries.`)
      }
      clearSelection()
      setConfirmDeleteOpen(false)
    } catch (requestError) {
      setBulkError(requestError.message || 'Bulk delete failed')
      setConfirmDeleteOpen(false)
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkBlock = async () => {
    setBulkBusy(true)
    setBulkError('')
    try {
      const entries = Array.from(selectedEntries.values())
      await Promise.all(entries.map((entry) => createBlock({ token: session.accessToken, entityType: entry.entityType, name: entry.name })))
      handleEntryChanged(`Blocked ${entries.length} selected entries.`)
      clearSelection()
    } catch (requestError) {
      setBulkError(requestError.message || 'Bulk block failed')
    } finally {
      setBulkBusy(false)
    }
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
              <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => { setTab(value); setSearchParams({}) }}>{label}</button>
            ))}
          </div>
          <div className="library-controls-bar">
            {isDateFilterable && <DateRangeSelector value={dateRange} onChange={setDateRange} showCompare={false} />}
            <div className="library-toolbar">
              <form onSubmit={(e) => { e.preventDefault(); setActiveSearchQuery(searchQuery); }} className="library-search-form">
                <input
                  type="search"
                  placeholder="Search library..."
                  aria-label="Search library tracks, artists, or albums"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => setActiveSearchQuery(searchQuery)}
                />
              </form>
              <LibraryViewToggle
                view={activeView}
                onChange={changeView}
                selectMode={selectMode}
                onToggleSelectMode={() => setSelectMode((prev) => !prev)}
              />
            </div>
          </div>
          {selectedCount > 0 && (
            <div className="bulk-action-bar" role="status">
              <strong>{selectedCount.toLocaleString()} selected</strong>
              <button type="button" disabled={bulkBusy} onClick={toggleVisibleSelection}>Select visible</button>
              <button type="button" disabled={bulkBusy} onClick={promptBulkDelete}>Delete selected</button>
              {tab !== 'scrobbles' && tab !== 'liked' && <button type="button" disabled={bulkBusy} onClick={bulkBlock}>Block selected</button>}
              <button type="button" className="bulk-action-secondary" disabled={bulkBusy} onClick={clearSelection}>Clear</button>
              {bulkError && <span role="alert">{bulkError}</span>}
            </div>
          )}
          <div className="library-layout">
            {tab === 'scrobbles'
              ? <LibraryScrobbleList scrobbles={visibleScrobbles} token={session.accessToken} view={activeView} showArtwork={settings?.show_artwork !== false} showSourceBadges={settings?.show_source_badges !== false} timestampMode={settings?.timestamp_mode || 'relative'} filterLabel={scrobbleFilter.name} selectedIds={selectedScrobbleIds} onToggleSelection={toggleScrobbleSelection} selectMode={selectMode} />
              : <LibraryRankList entries={rankedEntries} kind={tab === 'liked' ? 'tracks' : tab} token={session.accessToken} page={page} pageSize={pageSize} totalCount={totalCount} view={activeView} showArtwork={settings?.show_artwork !== false} selectedKeys={selectedEntries} onToggleSelection={tab !== 'liked' ? toggleEntrySelection : undefined} onEntryChanged={tab !== 'liked' ? handleEntryChanged : undefined} selectMode={selectMode} />}
            <TimelineChart entries={timeline} />
          </div>
          <div className="library-pagination-bar">
            <PageSizeSelect value={pageSize} onChange={setPageSize} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>

          <ConfirmDeleteModal
            isOpen={confirmDeleteOpen}
            title={tab === 'scrobbles' ? 'Delete Selected Scrobbles' : 'Delete Selected Entries'}
            description={
              tab === 'scrobbles'
                ? `You are about to permanently delete ${selectedScrobbleIds.size.toLocaleString()} selected scrobbles.`
                : `You are about to permanently delete all scrobbles associated with the ${selectedEntries.size.toLocaleString()} selected ${tab}.`
            }
            warningText="This action is permanent and cannot be undone."
            confirmWord="DELETE"
            confirmButtonText="Delete permanently"
            isBusy={bulkBusy}
            onConfirm={executeBulkDelete}
            onCancel={() => setConfirmDeleteOpen(false)}
          />
        </>
      )}
    </AnalyticsPage>
  )
}