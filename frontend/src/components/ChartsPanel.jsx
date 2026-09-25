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
          <h2>Top charts</h2>
        </div>
      </div>
      <div className="charts-controls">
        <div className="charts-control-group">
          <label htmlFor="charts-entity-select" className="charts-control-label">
            Chart
          </label>
          <div className="segmented-tabs" role="tablist" aria-label="Chart options">
            {ENTITIES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={entity === option.value}
                className={`segmented-tab ${entity === option.value ? 'active' : ''}`}
                onClick={() => setEntity(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <select
            id="charts-entity-select"
            aria-label="Chart"
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            className="visually-hidden-accessible"
          >
            {ENTITIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="charts-control-group">
          <label htmlFor="charts-range-select" className="charts-control-label">
            Range
          </label>
          <div className="segmented-tabs" role="tablist" aria-label="Range options">
            {RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={range === option.value}
                className={`segmented-tab ${range === option.value ? 'active' : ''}`}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <select
            id="charts-range-select"
            aria-label="Range"
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="visually-hidden-accessible"
          >
            {RANGES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
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
