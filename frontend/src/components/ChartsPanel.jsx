import { useEffect, useState } from 'react'
import { fetchUserCharts } from '../api'

const RANGES = [
  { value: '7day', label: '7 days' },
  { value: '1month', label: '1 month' },
  { value: '12month', label: '12 months' },
  { value: 'overall', label: 'Overall' },
]

const ENTITIES = [
  { value: 'artists', label: 'Artists' },
  { value: 'tracks', label: 'Tracks' },
  { value: 'albums', label: 'Albums' },
]

export default function ChartsPanel({ token, userId }) {
  const [entity, setEntity] = useState('artists')
  const [range, setRange] = useState('overall')
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !userId) return
    setStatus('loading')
    setError('')
    fetchUserCharts({ token, userId, entity, range, limit: 10 })
      .then((data) => {
        setEntries(data.entries)
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(requestError.message)
        setStatus('error')
      })
  }, [token, userId, entity, range])

  if (!token || !userId) return null

  return (
    <div className="charts-panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Personal archive</p>
          <h2>Top charts</h2>
        </div>
      </div>
      <div className="charts-controls">
        <label>
          Chart
          <select value={entity} onChange={(event) => setEntity(event.target.value)}>
            {ENTITIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Range
          <select value={range} onChange={(event) => setRange(event.target.value)}>
            {RANGES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      {status === 'error' && <p className="notice notice-error" role="alert">{error}</p>}
      {status === 'ready' && entries.length === 0 && <p className="notice">No plays found for this range.</p>}
      {status === 'ready' && entries.length > 0 && (
        <ol className="charts-list">
          {entries.map((entry, index) => (
            <li key={`${entry.label}-${entry.secondary || ''}`} className="charts-row">
              <span className="charts-rank">{index + 1}</span>
              <span className="charts-label">{entry.label}</span>
              {entry.secondary && <span className="charts-secondary">{entry.secondary}</span>}
              <span className="charts-count">{entry.play_count.toLocaleString()} plays</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
