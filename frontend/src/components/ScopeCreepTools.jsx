import { useState } from 'react'
import { readSession } from '../session'

export default function ScopeCreepTools() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const session = readSession()
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(`${API_BASE_URL}/tools/scope-creep`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create playlist')
      }
      
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">BBC iPlayer to Spotify Playlist</h2>
      </div>
      <div className="card-body">
        <p>Paste a BBC Sounds or iPlayer URL to automatically extract the tracks and create a Spotify playlist.</p>
        <p className="help-text">Example: <code>https://www.bbc.co.uk/sounds/play/m0031tc6</code></p>
        
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label htmlFor="bbc-url" className="form-label">BBC Sounds URL</label>
            <input
              id="bbc-url"
              type="url"
              className="form-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.bbc.co.uk/sounds/play/..."
              disabled={loading}
              required
            />
          </div>
          <button type="submit" className="button button-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Playlist'}
          </button>
        </form>

        {error && (
          <div className="error-message" style={{ marginTop: '1rem' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="success-message" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-success)', borderRadius: '4px' }}>
            <p><strong>Success!</strong> {result.message}</p>
            <a href={result.playlist_url} target="_blank" rel="noreferrer" className="button button-secondary" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
              Open on Spotify
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
