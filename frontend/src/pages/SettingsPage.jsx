import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import { deleteImportedScrobbles, enableLikedTracksSync, fetchBlocks, fetchScrobbleSettings, fetchUserSettings, removeBlock, updateScrobbleSettings, updateUserSettings, startArtworkBackfill, fetchImportBatches, advancedDeleteImports } from '../api'
import { readSession } from '../session'
import ImportProgressBar from '../components/ImportProgressBar'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import ScopeCreepTools from '../components/ScopeCreepTools'
import { CHANGELOG } from '../changelogData'

const SETTINGS_TABS = [
  ['general', 'General'],
  ['views', 'Views'],
  ['scrobble', 'Scrobble'],
  ['data', 'Data'],
  ['changelog', 'Changelog'],
  ['scopecreep', 'Scope Creep'],
  ['danger', 'Danger Zone'],
]

const POLL_INTERVAL_OPTIONS = [5, 10, 15, 30, 60]

const VIEW_OPTIONS = [
  ['default_library_view', 'Default library view'],
  ['scrobbles_view', 'Scrobbles view'],
  ['artists_view', 'Artists view'],
  ['albums_view', 'Albums view'],
  ['tracks_view', 'Tracks view'],
]

export default function SettingsPage() {
  const session = readSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => {
    if (['general', 'views', 'scrobble', 'data', 'changelog', 'scopecreep', 'danger'].includes(tabParam)) {
      return tabParam
    }
    return 'general'
  })
  const [settings, setSettings] = useState(null)
  const [status, setStatus] = useState('idle')
  const [scrobbleSettings, setScrobbleSettings] = useState(null)
  const [scrobbleStatus, setScrobbleStatus] = useState('idle')
  const [likedSyncStatus, setLikedSyncStatus] = useState('idle')
  const [blocks, setBlocks] = useState([])
  const [blocksError, setBlocksError] = useState('')
  const [deleteMode, setDeleteMode] = useState('source')
  const [deleteSource, setDeleteSource] = useState('youtube')
  const [deleteStartDate, setDeleteStartDate] = useState('')
  const [deleteEndDate, setDeleteEndDate] = useState('')
  const [deleteBatch, setDeleteBatch] = useState('')
  const [importBatches, setImportBatches] = useState([])
  const [advancedDeleteState, setAdvancedDeleteState] = useState('idle')
  const [advancedDeleteError, setAdvancedDeleteError] = useState('')
  const [backfillState, setBackfillState] = useState('idle')
  const [backfillProgress, setBackfillProgress] = useState(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!session?.accessToken) return
    setStatus('loading')
    fetchUserSettings({ token: session.accessToken })
      .then((data) => {
        setSettings(data)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
    fetchBlocks({ token: session.accessToken })
      .then((data) => setBlocks(data.blocks))
      .catch(() => setBlocksError('Blocked items could not be loaded.'))
    fetchScrobbleSettings({ token: session.accessToken })
      .then(setScrobbleSettings)
      .catch(() => {})
  }, [])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const changeSetting = (key, value) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    setStatus('saving')

    if (key === 'theme') {
      localStorage.setItem('audio-scrobbler-theme', value)
      document.documentElement.setAttribute('data-theme', value)
    }

    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateUserSettings({ token: session.accessToken, changes: { [key]: value } })
        .then((saved) => {
          setSettings(saved)
          setStatus('saved')
        })
        .catch(() => setStatus('error'))
    }, 350)
  }

  const scrobbleSaveTimer = useRef(null)
  const pendingScrobbleChanges = useRef({})
  useEffect(() => () => clearTimeout(scrobbleSaveTimer.current), [])

  const changeScrobbleSetting = (key, value) => {
    const next = { ...scrobbleSettings, [key]: value }
    setScrobbleSettings(next)
    setScrobbleStatus('saving')
    pendingScrobbleChanges.current = { ...pendingScrobbleChanges.current, [key]: value }
    clearTimeout(scrobbleSaveTimer.current)
    scrobbleSaveTimer.current = setTimeout(() => {
      const changes = pendingScrobbleChanges.current
      pendingScrobbleChanges.current = {}
      updateScrobbleSettings({ token: session.accessToken, changes })
        .then((saved) => {
          setScrobbleSettings(saved)
          setScrobbleStatus('saved')
        })
        .catch(() => setScrobbleStatus('error'))
    }, 350)
  }

  const triggerLikedTracksSync = async () => {
    setLikedSyncStatus('saving')
    try {
      const saved = await enableLikedTracksSync({ token: session.accessToken })
      setScrobbleSettings(saved)
      setLikedSyncStatus('saved')
    } catch {
      setLikedSyncStatus('error')
    }
  }

  const unblock = async (blockId) => {
    setBlocksError('')
    try {
      await removeBlock({ token: session.accessToken, blockId })
      setBlocks((current) => current.filter((block) => block.id !== blockId))
    } catch {
      setBlocksError('Unblock failed. Try again.')
    }
  }

  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [deletePendingParams, setDeletePendingParams] = useState(null)
  const [deletePendingDesc, setDeletePendingDesc] = useState('')

  useEffect(() => {
    if (!session?.accessToken) return
    fetchImportBatches({ token: session.accessToken })
      .then(res => setImportBatches(res.batches || []))
      .catch(err => console.error("Could not fetch batches", err))
  }, [session?.accessToken])

  const promptAdvancedDelete = () => {
    setAdvancedDeleteError('')
    
    let source = null, startDate = null, endDate = null, batchTime = null
    let desc = ''
    
    if (deleteMode === 'source') {
      source = deleteSource
      desc = `You are about to permanently delete all ${deleteSource.toUpperCase()} scrobbles from your library.`
    } else if (deleteMode === 'date') {
      startDate = deleteStartDate ? new Date(deleteStartDate).toISOString() : null
      endDate = deleteEndDate ? new Date(deleteEndDate).toISOString() : null
      if (!startDate && !endDate) {
        setAdvancedDeleteError('Please specify at least one date.')
        return
      }
      desc = `You are about to permanently delete all scrobbles between ${deleteStartDate || 'the beginning'} and ${deleteEndDate || 'today'}.`
    } else if (deleteMode === 'batch') {
      batchTime = deleteBatch
      if (!batchTime) {
        setAdvancedDeleteError('Please select a batch.')
        return
      }
      const matchedBatch = importBatches.find(b => b.batch_time === batchTime)
      desc = `You are about to permanently delete scrobbles from the import batch on ${new Date(batchTime).toLocaleString()}${matchedBatch ? ` (${matchedBatch.count} scrobbles)` : ''}.`
    }

    setDeletePendingParams({ source, startDate, endDate, batchTime })
    setDeletePendingDesc(desc)
    setConfirmModalOpen(true)
  }

  const executeConfirmedDelete = async () => {
    if (!deletePendingParams) return
    setAdvancedDeleteState('deleting')
    setAdvancedDeleteError('')

    try {
      const result = await advancedDeleteImports({
        token: session.accessToken,
        ...deletePendingParams
      })
      setAdvancedDeleteState(`deleted:${result.deleted}`)
      setConfirmModalOpen(false)
      setDeletePendingParams(null)
      
      // Refresh batches
      fetchImportBatches({ token: session.accessToken })
        .then(res => setImportBatches(res.batches || []))
        .catch(err => console.error(err))
    } catch (err) {
      setAdvancedDeleteError(err.message || 'Failed to delete scrobbles.')
      setAdvancedDeleteState('error')
      setConfirmModalOpen(false)
    }
  }

  const abortBackfillRef = useRef(null)

  const triggerArtworkBackfill = async () => {
    setBackfillState('running')
    setBackfillProgress(null)
    abortBackfillRef.current = new AbortController()
    
    try {
      const result = await startArtworkBackfill({
        token: session.accessToken,
        onProgress: (progress) => setBackfillProgress(progress),
        signal: abortBackfillRef.current.signal
      })
      setBackfillState('complete')
      setBackfillProgress(result)
    } catch (err) {
      if (err.name === 'AbortError') {
        setBackfillState('idle')
        setBackfillProgress(null)
      } else {
        setBackfillState('error')
      }
    }
  }

  const cancelBackfill = () => {
    if (abortBackfillRef.current) {
      abortBackfillRef.current.abort()
    }
  }

  return (
    <AnalyticsPage eyebrow="Personal preferences" title="Settings">
      {!session?.accessToken && <p className="notice">Connect Spotify to manage your personal settings.</p>}
      {status === 'loading' && <p className="notice">Loading settings...</p>}
      {status === 'error' && <p className="notice notice-error" role="alert">Settings could not be loaded or saved.</p>}
      {session?.accessToken && (
        <div className="library-tabs settings-tabs" role="tablist" aria-label="Settings sections">
          {SETTINGS_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`settings-tab-${value}`}
              aria-controls={`settings-panel-${value}`}
              aria-selected={activeTab === value}
              className={`settings-tab${activeTab === value ? ' active' : ''}${value === 'danger' ? ' destructive' : ''}`}
              onClick={() => {
                setActiveTab(value)
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('tab', value)
                  return next
                })
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {activeTab === 'general' && settings && (
        <>
          <div
            className="settings-form"
            role="tabpanel"
            id="settings-panel-general"
            aria-labelledby="settings-tab-general"
          >
            <label>
              Theme
              <select value={settings.theme || 'system'} onChange={(event) => changeSetting('theme', event.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System Default</option>
              </select>
            </label>
            <label>
              Default date range
              <select value={settings.default_date_range} onChange={(event) => changeSetting('default_date_range', event.target.value)}>
                <option value="last.week">Last 7 days</option>
                <option value="last.month">Last month</option>
                <option value="last.year">Last year</option>
                <option value="all.time">All time</option>
              </select>
            </label>
            <label>
              Default page size
              <select value={settings.default_page_size} onChange={(event) => changeSetting('default_page_size', Number(event.target.value))}>
                {[10, 25, 50, 100, 150, 200, 250].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <label className="settings-checkbox">
              <input type="checkbox" checked={settings.show_artwork} onChange={(event) => changeSetting('show_artwork', event.target.checked)} />
              Show artwork
            </label>
            <label className="settings-checkbox">
              <input type="checkbox" checked={settings.show_source_badges} onChange={(event) => changeSetting('show_source_badges', event.target.checked)} />
              Show source badges
            </label>
            <label>
              Scrobble timestamp style
              <select value={settings.timestamp_mode} onChange={(event) => changeSetting('timestamp_mode', event.target.value)}>
                <option value="relative">Relative until 24 hours</option>
                <option value="absolute">Always show date and time</option>
              </select>
            </label>
            {status === 'saving' && <p role="status">Saving...</p>}
            {status === 'saved' && <p role="status">Saved</p>}
          </div>

          <section className="settings-form settings-blocks" aria-labelledby="blocked-items-heading">
            <h2 id="blocked-items-heading">Blocked items</h2>
            {blocksError && <p className="notice notice-error" role="alert">{blocksError}</p>}
            {blocks.length === 0 ? <p className="panel-meta">Nothing is blocked. Use the menu on Library entries to block artists, albums, or tracks.</p> : (
              <ul className="blocked-list">
                {blocks.map((block) => (
                  <li key={block.id}>
                    <span className="blocked-copy">
                      <strong>{block.name}</strong>
                      <small>{block.entity_type}</small>
                    </span>
                    <button type="button" className="blocked-unblock" onClick={() => unblock(block.id)}>Unblock</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {activeTab === 'views' && settings && (
        <div
          className="settings-form"
          role="tabpanel"
          id="settings-panel-views"
          aria-labelledby="settings-tab-views"
        >
          {VIEW_OPTIONS.map(([key, label]) => (
            <label key={key}>
              {label}
              <select value={settings[key] || settings.default_library_view} onChange={(event) => changeSetting(key, event.target.value)}>
                <option value="list">List</option>
                <option value="grid">Grid</option>
              </select>
            </label>
          ))}
          {status === 'saving' && <p role="status">Saving...</p>}
          {status === 'saved' && <p role="status">Saved</p>}
        </div>
      )}
      {activeTab === 'scrobble' && scrobbleSettings && (
        <div
          className="settings-form"
          role="tabpanel"
          id="settings-panel-scrobble"
          aria-labelledby="settings-tab-scrobble"
        >
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={scrobbleSettings.strip_remaster_tags}
              onChange={(event) => changeScrobbleSetting('strip_remaster_tags', event.target.checked)}
            />
            Strip remaster tags (e.g. "(Remastered)", "[Live]") from track titles
          </label>
          <label>
            Poll frequency
            <select
              value={scrobbleSettings.poll_interval_minutes}
              onChange={(event) => changeScrobbleSetting('poll_interval_minutes', Number(event.target.value))}
            >
              {POLL_INTERVAL_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>Every {minutes} minutes</option>
              ))}
            </select>
          </label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={scrobbleSettings.realtime_sync_enabled}
              onChange={(event) => changeScrobbleSetting('realtime_sync_enabled', event.target.checked)}
            />
            Enable Real-time Scrobbling (requires Spotify Premium, polls every 10s)
          </label>
          {scrobbleSettings.realtime_sync_enabled && (
            <label style={{ marginLeft: '1.5rem' }}>
              Scrobble completion threshold
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={scrobbleSettings.scrobble_threshold_percent}
                  onChange={(event) => changeScrobbleSetting('scrobble_threshold_percent', Number(event.target.value))}
                />
                <span>{scrobbleSettings.scrobble_threshold_percent}%</span>
              </div>
              <small className="panel-meta">Track will scrobble immediately when this percentage of its duration is played.</small>
            </label>
          )}
          {scrobbleStatus === 'saving' && <p role="status">Saving...</p>}
          {scrobbleStatus === 'saved' && <p role="status">Saved</p>}
        </div>
      )}
      {activeTab === 'data' && session?.accessToken && (
        <section
          className="settings-form"
          role="tabpanel"
          id="settings-panel-data"
          aria-labelledby="settings-tab-data"
        >
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Liked Songs</h3>
            {scrobbleSettings?.liked_tracks_sync_enabled ? (
              <p className="notice">
                Liked songs sync is active
                {scrobbleSettings.liked_tracks_backfill_in_progress ? ' (catching up on your existing library)' : ''}.
              </p>
            ) : (
              <>
                <p className="notice" style={{ marginBottom: '0.5rem' }}>
                  This only needs to be pressed once — your liked songs will keep syncing automatically after that, roughly daily.
                </p>
                <button type="button" className="secondary-button" disabled={likedSyncStatus === 'saving'} onClick={triggerLikedTracksSync}>
                  {likedSyncStatus === 'saving' ? 'Starting...' : 'Sync Liked Songs'}
                </button>
                {likedSyncStatus === 'error' && <p className="notice notice-error" role="alert">Could not start liked-songs sync.</p>}
              </>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Backfill Missing Artwork</h3>
            <p className="notice" style={{ marginBottom: '1rem' }}>Scan your library for missing artwork and attempt to fill it in from Deezer and iTunes.</p>
            {backfillState === 'running' && backfillProgress && (
              <ImportProgressBar progress={backfillProgress} />
            )}
            {backfillState === 'complete' && backfillProgress?.summary && (
              <div style={{ marginBottom: '1rem' }}>
                <p role="status" style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Backfill complete! Updated {backfillProgress.summary.inserted} tracks. (Skipped {backfillProgress.summary.skipped} not found)
                </p>
                {backfillProgress.updated_tracks && backfillProgress.updated_tracks.length > 0 && (
                  <details className="import-errors-details" style={{ marginBottom: '0.5rem' }}>
                    <summary>View {backfillProgress.updated_tracks.length} updated tracks</summary>
                    <ul className="import-errors-list">
                      {backfillProgress.updated_tracks.map((track, i) => (
                        <li key={i}>{track}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {backfillProgress.errors && backfillProgress.errors.length > 0 && (
                  <details className="import-errors-details">
                    <summary>View {backfillProgress.errors.length} skipped tracks</summary>
                    <ul className="import-errors-list">
                      {backfillProgress.errors.map((track, i) => (
                        <li key={i}>{track}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            {backfillState === 'error' && (
              <p className="notice notice-error" role="alert" style={{ marginBottom: '1rem' }}>An error occurred during backfill.</p>
            )}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="secondary-button" disabled={backfillState === 'running'} onClick={triggerArtworkBackfill}>
                {backfillState === 'running' ? 'Backfilling...' : 'Backfill Missing Artwork'}
              </button>
              {backfillState === 'running' && (
                <button type="button" className="danger-button" onClick={cancelBackfill}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>
      )}
      {activeTab === 'changelog' && (
        <section
          className="settings-form"
          role="tabpanel"
          id="settings-panel-changelog"
          aria-labelledby="settings-tab-changelog"
        >
          <div className="changelog-container">
            {CHANGELOG.map(release => (
              <div key={release.version} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>v{release.version}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>{release.date}</span>
                </h3>
                <ul style={{ paddingLeft: '1.25rem', color: 'var(--color-text-muted)' }}>
                  {release.changes.map((change, index) => (
                    <li key={index} style={{ marginBottom: '0.25rem' }}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      {activeTab === 'scopecreep' && session?.accessToken && (
        <section
          className="settings-form"
          role="tabpanel"
          id="settings-panel-scopecreep"
          aria-labelledby="settings-tab-scopecreep"
        >
          <ScopeCreepTools />
        </section>
      )}
      {activeTab === 'danger' && session?.accessToken && (
        <section
          className="settings-form settings-danger-zone"
          role="tabpanel"
          id="settings-panel-danger"
          aria-labelledby="settings-tab-danger"
        >
          <p className="notice notice-warning" style={{ marginBottom: '1rem' }}>Deleting scrobbles removes them permanently from your library. This cannot be undone.</p>

          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Delete Scrobbles</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label>
              <input type="radio" name="deleteMode" value="source" checked={deleteMode === 'source'} onChange={() => setDeleteMode('source')} />
              By Source
            </label>
            <label style={{ marginLeft: '1rem' }}>
              <input type="radio" name="deleteMode" value="date" checked={deleteMode === 'date'} onChange={() => setDeleteMode('date')} />
              By Date Range
            </label>
            <label style={{ marginLeft: '1rem' }}>
              <input type="radio" name="deleteMode" value="batch" checked={deleteMode === 'batch'} onChange={() => setDeleteMode('batch')} />
              By Import Batch
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            {deleteMode === 'source' && (
              <label>
                Select Source:
                <select value={deleteSource} onChange={e => setDeleteSource(e.target.value)} style={{ marginLeft: '0.5rem' }}>
                  <option value="youtube">YouTube</option>
                  <option value="spotify">Spotify</option>
                </select>
              </label>
            )}

            {deleteMode === 'date' && (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label>
                  Start Date:
                  <input type="date" value={deleteStartDate} onChange={e => setDeleteStartDate(e.target.value)} style={{ marginLeft: '0.5rem' }} />
                </label>
                <label>
                  End Date:
                  <input type="date" value={deleteEndDate} onChange={e => setDeleteEndDate(e.target.value)} style={{ marginLeft: '0.5rem' }} />
                </label>
              </div>
            )}

            {deleteMode === 'batch' && (
              <label>
                Select Batch:
                <select value={deleteBatch} onChange={e => setDeleteBatch(e.target.value)} style={{ marginLeft: '0.5rem', width: '100%' }}>
                  <option value="">-- Select a batch --</option>
                  {importBatches.map(b => (
                    <option key={b.batch_time + b.source} value={b.batch_time}>
                      {b.source} - {b.count} scrobbles ({new Date(b.batch_time).toLocaleString()})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {advancedDeleteError && <p className="notice notice-error" role="alert" style={{ marginBottom: '1rem' }}>{advancedDeleteError}</p>}
          {advancedDeleteState.startsWith('deleted:') && <p role="status" style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Deleted {advancedDeleteState.split(':')[1]} scrobbles successfully.</p>}

          <button type="button" className="danger-button" disabled={advancedDeleteState === 'deleting'} onClick={promptAdvancedDelete}>
            {advancedDeleteState === 'deleting' ? 'Deleting...' : 'Delete Scrobbles'}
          </button>
        </section>
      )}
      <ConfirmDeleteModal
        isOpen={confirmModalOpen}
        title="Permanently Delete Scrobbles"
        description={deletePendingDesc}
        warningText="This action is permanent and cannot be undone. All matching scrobbles will be permanently removed from your library."
        confirmWord="DELETE"
        confirmButtonText="Delete Scrobbles"
        isBusy={advancedDeleteState === 'deleting'}
        onConfirm={executeConfirmedDelete}
        onCancel={() => {
          setConfirmModalOpen(false)
          setDeletePendingParams(null)
        }}
      />
      <p className="page-link"><Link to="/profile">Back to profile</Link></p>
    </AnalyticsPage>
  )
}
