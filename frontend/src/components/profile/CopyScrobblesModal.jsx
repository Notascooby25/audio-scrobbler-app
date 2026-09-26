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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700 shadow-xl">
        <h3 className="text-xl font-bold mb-2">Copy Scrobbles</h3>
        
        {status === 'success' ? (
          <div className="space-y-4">
            <p className="text-gray-300">
              Successfully copied <span className="font-bold text-white">{copiedCount}</span> scrobbles from @{username}.
            </p>
            <div className="flex justify-end pt-2">
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCopy} className="space-y-4">
            <p className="text-gray-400 text-sm mb-4">
              Select a time range to copy scrobbles from @{username}. 
              Any scrobbles you already have in this period will be safely skipped.
            </p>
            
            <div>
              <label htmlFor="start-date" className="block text-sm text-gray-400 mb-1">Start Time</label>
              <input 
                id="start-date"
                type="datetime-local" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-green-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label htmlFor="end-date" className="block text-sm text-gray-400 mb-1">End Time</label>
              <input 
                id="end-date"
                type="datetime-local" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-green-500 focus:outline-none"
              />
            </div>

            {status === 'error' && (
              <div className="p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button 
                type="button" 
                onClick={onClose}
                disabled={status === 'loading'}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={status === 'loading' || !startDate || !endDate}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded transition disabled:opacity-50"
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
