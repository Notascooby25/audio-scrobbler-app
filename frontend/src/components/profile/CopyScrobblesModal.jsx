import React, { useState } from 'react'
import { copyScrobbles } from '../../api'
import { readSession } from '../../session'

export default function CopyScrobblesModal({ userId, username, onClose }) {
  const savedSession = readSession()
  const token = savedSession?.accessToken
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, success, error
  const [errorMsg, setErrorMsg] = useState('')
  const [copiedCount, setCopiedCount] = useState(0)

  const handleCopy = async (e) => {
    e.preventDefault()
    if (!startDate || !endDate) return

    setStatus('loading')
    setErrorMsg('')
    try {
      const startIso = new Date(startDate).toISOString()
      const endIso = new Date(endDate).toISOString()
      
      const res = await copyScrobbles({
        token,
        userId,
        startDate: startIso,
        endDate: endIso
      })
      
      if (res.status === 'ok' || res.copied_count !== undefined) {
        setCopiedCount(res.copied_count || 0)
        setStatus('success')
      } else {
        throw new Error(res.error || 'Failed to copy scrobbles')
      }
    } catch (err) {
      console.error(err)
      setStatus('error')
      setErrorMsg(err.message || 'An error occurred')
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'loading') onClose()
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-scrobbles-title"
      >
        <h3 id="copy-scrobbles-title" style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.75rem', color: 'var(--color-ink)' }}>
          Copy Scrobbles
        </h3>
        
        {status === 'success' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, color: 'var(--color-ink)' }}>
              Successfully copied <strong style={{ color: 'var(--color-ink)' }}>{copiedCount}</strong> scrobbles from @{username}.
            </p>
            <div className="modal-actions">
              <button 
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCopy} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-muted)' }}>
              Select a time range to copy scrobbles from @{username}. 
              Any scrobbles you already have in this period will be safely skipped.
            </p>
            
            <label htmlFor="start-date" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--color-ink)' }}>
              Start Time
              <input 
                id="start-date"
                type="datetime-local" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '0.5px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-ink)',
                  fontSize: '0.9rem',
                }}
              />
            </label>
            
            <label htmlFor="end-date" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--color-ink)' }}>
              End Time
              <input 
                id="end-date"
                type="datetime-local" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '0.5px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-ink)',
                  fontSize: '0.9rem',
                }}
              />
            </label>

            {status === 'error' && (
              <div className="notice notice-error" style={{ margin: 0, padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-danger-soft)', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                {errorMsg}
              </div>
            )}

            <div className="modal-actions">
              <button 
                type="button" 
                onClick={onClose}
                disabled={status === 'loading'}
                className="modal-cancel-button"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={status === 'loading' || !startDate || !endDate}
              >
                {status === 'loading' ? 'Copying...' : 'Copy Scrobbles'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
