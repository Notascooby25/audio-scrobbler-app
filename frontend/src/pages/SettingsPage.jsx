import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import { deleteImportedScrobbles, fetchBlocks, fetchUserSettings, removeBlock, updateUserSettings, startArtworkBackfill, fetchImportBatches, advancedDeleteImports, syncLikedTracks } from '../api'
import { readSession } from '../session'
import ImportProgressBar from '../components/ImportProgressBar'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

const SETTINGS_TABS = [
  ['general', 'General'],
  ['views', 'Views'],
  ['data', 'Data'],
  ['danger', 'Danger Zone'],
]

const VIEW_OPTIONS = [
  ['default_library_view', 'Default library view'],
  ['scrobbles_view', 'Scrobbles view'],
  ['artists_view', 'Artists view'],
  ['albums_view', 'Albums view'],
  ['tracks_view', 'Tracks view'],
  ['liked_tracks_view', 'Liked tracks view'],
]

export default function SettingsPage() {
  const session = readSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => {
    if (['general', 'views', 'data', 'danger'].includes(tabParam)) {
      return tabParam
    }
    return 'general'
  })
  const [settings, setSettings] = useState(null)
  const [status, setStatus] = useState('idle')
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
  const [likedSyncState, setLikedSyncState] = useState('idle')
  const [likedSyncResult, setLikedSyncResult] = useState(null)
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
  }, [])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const changeSetting = (key, value) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    setStatus('saving')
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

  const triggerLikedTracksSync = async () => {
    setLikedSyncState('running')
    setLikedSyncResult(null)
    try {
      const result = await syncLikedTracks({ token: session.accessToken })
      setLikedSyncState('complete')
      setLikedSyncResult(result)
    } catch {
      setLikedSyncState('error')
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
              Default date range
              <select value={settings.default_date_range} onChange={(event) => changeSetting('default_date_range', event.target.value)}>
                <option value="last.week">Last 7 days</option>
                <option value="last.month">Last month</option>
                <option value="last.year">Last year</option>
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
      {activeTab === 'data' && session?.accessToken && (
        <section
          className="settings-form"
          role="tabpanel"
          id="settings-panel-data"
          aria-labelledby="settings-tab-data"
        >
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Sync Liked Tracks</h3>
            <p className="notice" style={{ marginBottom: '1rem' }}>
              Your Spotify Liked Songs sync automatically in the background. Use this to sync on demand instead of waiting for the next automatic run.
            </p>
            {likedSyncState === 'complete' && likedSyncResult && (
              <p role="status" style={{ color: 'var(--color-primary)', marginBottom: '1rem', fontWeight: 500 }}>
                Synced! {likedSyncResult.inserted} new, {likedSyncResult.updated} updated.
              </p>
            )}
            {likedSyncState === 'error' && (
              <p className="notice notice-error" role="alert" style={{ marginBottom: '1rem' }}>Liked tracks sync failed. Try again.</p>
            )}
            <button type="button" className="secondary-button" disabled={likedSyncState === 'running'} onClick={triggerLikedTracksSync}>
              {likedSyncState === 'running' ? 'Syncing...' : 'Sync Liked Tracks'}
            </button>
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
