import { useEffect, useRef, useState } from 'react'
import { createBlock, deleteLibraryEntries } from '../api'

export default function EntryMenu({ token, entityType, name, secondary, playCount, onChanged }) {
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
        setConfirmingDelete(false)
      }
    }
    const escape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setConfirmingDelete(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const blockEntry = async () => {
    setBusy(true)
    setNotice('')
    try {
      await createBlock({ token, entityType, name })
      setOpen(false)
      onChanged?.(`Blocked "${name}" — manage blocks in Settings.`)
    } catch {
      setNotice('Block failed')
    } finally {
      setBusy(false)
    }
  }

  const deleteEntry = async () => {
    setBusy(true)
    setNotice('')
    try {
      const result = await deleteLibraryEntries({
        token,
        entityType,
        name,
        secondary: entityType === 'track' ? secondary : undefined,
      })
      setOpen(false)
      setConfirmingDelete(false)
      onChanged?.(`Deleted ${result.deleted} scrobbles for "${name}".`)
    } catch {
      setNotice('Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="entry-menu" ref={containerRef}>
      <button
        type="button"
        className="entry-menu-toggle"
        aria-label={`Options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current)
          setConfirmingDelete(false)
        }}
      >
        &#8942;
      </button>
      {open && (
        <div className="entry-menu-panel" role="menu" aria-label={`${name} options`}>
          {!confirmingDelete ? (
            <>
              <button type="button" role="menuitem" disabled={busy} onClick={() => setConfirmingDelete(true)}>Delete…</button>
              <button type="button" role="menuitem" disabled={busy} onClick={blockEntry}>Block</button>
            </>
          ) : (
            <div className="entry-menu-confirm">
              <p>Delete {playCount ? `${playCount.toLocaleString()} scrobbles` : 'all scrobbles'} for "{name}"? This cannot be undone.</p>
              <div className="entry-menu-confirm-actions">
                <button type="button" disabled={busy} onClick={deleteEntry}>Delete</button>
                <button type="button" className="entry-menu-cancel" disabled={busy} onClick={() => setConfirmingDelete(false)}>Cancel</button>
              </div>
            </div>
          )}
          {notice && <p className="entry-menu-notice" role="alert">{notice}</p>}
        </div>
      )}
    </div>
  )
}
