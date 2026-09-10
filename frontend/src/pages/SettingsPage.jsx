import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import { fetchUserSettings, updateUserSettings } from '../api'
import { readSession } from '../session'

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
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
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
      <p className="page-link"><Link to="/profile">Back to profile</Link></p>
    </AnalyticsPage>
  )
}
