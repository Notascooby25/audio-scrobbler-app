import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import { deleteImportedScrobbles, fetchBlocks, fetchUserSettings, removeBlock, updateUserSettings, startArtworkBackfill } from '../api'
import { readSession } from '../session'
import ImportProgressBar from '../components/ImportProgressBar'

const VIEW_OPTIONS = [
  ['default_library_view', 'Default Library view'],
  ['scrobbles_view', 'Scrobbles view'],
  ['artists_view', 'Artists view'],
  ['albums_view', 'Albums view'],
  ['tracks_view', 'Tracks view'],
  ['liked_tracks_view', 'Liked tracks view'],
]

export default function SettingsPage() {
  const session = readSession()
  const [settings, setSettings] = useState(null)
  const [status, setStatus] = useState('idle')
  const [blocks, setBlocks] = useState([])
  const [blocksError, setBlocksError] = useState('')
  const [youtubeDeleteState, setYoutubeDeleteState] = useState('idle')
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

  const deleteYouTubeHistory = async () => {
    setYoutubeDeleteState('deleting')
    try {
      const result = await deleteImportedScrobbles({ token: session.accessToken, source: 'youtube' })
      setYoutubeDeleteState(`deleted:${result.deleted}`)
    } catch {
      setYoutubeDeleteState('error')
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
      {settings && (
        <div className="settings-form">
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
          {VIEW_OPTIONS.map(([key, label]) => (
            <label key={key}>
              {label}
              <select value={settings[key] || settings.default_library_view} onChange={(event) => changeSetting(key, event.target.value)}>
                <option value="list">List</option>
                <option value="grid">Grid</option>
              </select>
            </label>
          ))}
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
      )}
      {session?.accessToken && (
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
      )}
      {session?.accessToken && (
        <section className="settings-form settings-danger-zone" aria-labelledby="data-management-heading">
          <h2 id="data-management-heading">Data management</h2>
          
          <div style={{ marginBottom: '2rem' }}>
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

          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Delete YouTube History</h3>
          <p className="notice notice-warning" style={{ marginBottom: '1rem' }}>Deleting YouTube history removes every YouTube scrobble in this account. This cannot be undone and does not affect Spotify history.</p>
          {youtubeDeleteState === 'deleted:0' && <p role="status" style={{ marginBottom: '1rem' }}>No YouTube history was found.</p>}
          {youtubeDeleteState.startsWith('deleted:') && youtubeDeleteState !== 'deleted:0' && <p role="status" style={{ marginBottom: '1rem' }}>YouTube history deleted.</p>}
          {youtubeDeleteState === 'error' && <p className="notice notice-error" role="alert" style={{ marginBottom: '1rem' }}>YouTube history could not be deleted.</p>}
          <button type="button" className="danger-button" disabled={youtubeDeleteState === 'deleting'} onClick={() => {
            if (window.confirm('Delete all YouTube scrobbles from this account? This cannot be undone.')) deleteYouTubeHistory()
          }}>
            {youtubeDeleteState === 'deleting' ? 'Deleting...' : 'Delete all YouTube history'}
          </button>
        </section>
      )}
      <p className="page-link"><Link to="/profile">Back to profile</Link></p>
    </AnalyticsPage>
  )
}
