import { useEffect, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import ShareCard from './ShareCard'
import { fetchLibraryCollection } from '../api'
import { DATE_RANGE_LABELS, formatDateDisplay } from '../dateRange'

const MIN_SIZE = 3
const MAX_SIZE = 10
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function dateRangeLabel(dateRange) {
  if (!dateRange) return ''
  if (dateRange.range === 'custom') {
    return `${formatDateDisplay(dateRange.start_date)} – ${formatDateDisplay(dateRange.end_date)}`
  }
  return DATE_RANGE_LABELS[dateRange.range] || dateRange.range
}

export default function ShareDialog({ open, onClose, kind, entries = [], dateRange, token, userId, totalCount = 0 }) {
  const [layout, setLayout] = useState('grid')
  const [size, setSize] = useState(5)
  const [resolvedEntries, setResolvedEntries] = useState([])
  const [fetching, setFetching] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [imageUrl, setImageUrl] = useState(null)
  const [imageBlob, setImageBlob] = useState(null)
  const [error, setError] = useState('')
  const cardRef = useRef(null)
  const generationRef = useRef(0)

  useEffect(() => {
    if (open) {
      setLayout('grid')
      setSize(5)
      setError('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const effectiveSize = totalCount > 0 ? Math.min(size, totalCount) : size

  useEffect(() => {
    if (!open) return
    if (entries.length >= effectiveSize) {
      setResolvedEntries(entries.slice(0, effectiveSize))
      setFetching(false)
      return
    }
    let cancelled = false
    setFetching(true)
    fetchLibraryCollection({ token, entity: kind, limit: effectiveSize, offset: 0, dateRange, userId })
      .then((result) => {
        if (cancelled) return
        setResolvedEntries((result.entries || []).slice(0, effectiveSize))
      })
      .catch((requestError) => {
        if (cancelled) return
        setError(requestError.message || 'Failed to load entries for share image')
      })
      .finally(() => {
        if (!cancelled) setFetching(false)
      })
    return () => { cancelled = true }
  }, [open, kind, token, userId, dateRange, effectiveSize, entries])

  useEffect(() => {
    if (!open || fetching || resolvedEntries.length === 0) return undefined
    const generation = ++generationRef.current
    setRendering(true)
    setError('')
    const timer = setTimeout(() => {
      if (!cardRef.current) {
        setRendering(false)
        return
      }
      toBlob(cardRef.current, { pixelRatio: 2, imagePlaceholder: TRANSPARENT_PIXEL })
        .then((blob) => {
          if (generation !== generationRef.current || !blob) return
          setImageBlob(blob)
          setImageUrl((current) => {
            if (current) URL.revokeObjectURL(current)
            return URL.createObjectURL(blob)
          })
        })
        .catch((renderError) => {
          if (generation !== generationRef.current) return
          setError(renderError.message || 'Failed to generate share image')
        })
        .finally(() => {
          if (generation === generationRef.current) setRendering(false)
        })
    }, 50)
    return () => clearTimeout(timer)
  }, [open, fetching, resolvedEntries, layout])

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!open) return null

  const canNativeShare = typeof navigator !== 'undefined' && navigator.share && navigator.canShare
  const fileName = `top-${kind}-${dateRange?.range || 'share'}.png`

  const handleDownload = () => {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleNativeShare = async () => {
    if (!imageBlob) return
    const file = new File([imageBlob], fileName, { type: 'image/png' })
    if (!navigator.canShare({ files: [file] })) return
    try {
      await navigator.share({ files: [file], title: `Top ${kind}` })
    } catch {
      // user cancelled or share failed silently
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="modal-dialog share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
        <div className="share-dialog-scroll">
          <h3 id="share-dialog-title" className="modal-title">Share {kind}</h3>

          <div className="share-dialog-controls">
            <div className="share-dialog-layout-toggle" role="group" aria-label="Layout">
              <button type="button" className={layout === 'list' ? 'active' : ''} aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>List</button>
              <button type="button" className={layout === 'grid' ? 'active' : ''} aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>Grid</button>
            </div>

            <label className="share-dialog-size-control" htmlFor="share-size-slider">
              <span>Size: {effectiveSize}</span>
              <input
                id="share-size-slider"
                type="range"
                min={MIN_SIZE}
                max={MAX_SIZE}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </label>
          </div>

          {totalCount > 0 && totalCount < size && (
            <p className="notice">Only {totalCount} {kind} available — showing {totalCount}.</p>
          )}

          {error && <p className="notice notice-error" role="alert">{error}</p>}

          <div className="share-dialog-preview">
            {(fetching || rendering) && !imageUrl && <p className="notice">Generating preview...</p>}
            {imageUrl && <img className="share-dialog-preview-image" src={imageUrl} alt={`Top ${kind} share preview`} />}
          </div>

          <div className="share-card-offscreen" aria-hidden="true">
            <div ref={cardRef}>
              <ShareCard entries={resolvedEntries} kind={kind} layout={layout} dateRangeLabel={dateRangeLabel(dateRange)} />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-cancel-button" onClick={onClose}>Close</button>
          {canNativeShare && (
            <button type="button" className="modal-confirm-button" disabled={!imageBlob} onClick={handleNativeShare}>Share</button>
          )}
          <button type="button" className="modal-confirm-button" disabled={!imageUrl} onClick={handleDownload}>Download PNG</button>
        </div>
      </div>
    </div>
  )
}
