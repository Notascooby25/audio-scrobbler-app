import { useEffect, useRef, useState } from 'react'

export default function ConfirmDeleteModal({
  isOpen,
  title = 'Confirm Deletion',
  description,
  warningText = 'This action is permanent and cannot be undone.',
  confirmWord = 'DELETE',
  confirmButtonText = 'Delete permanently',
  isBusy = false,
  onConfirm,
  onCancel,
}) {
  const [typedInput, setTypedInput] = useState('')
  const inputRef = useRef(null)
  const modalRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTypedInput('')
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const isMatched = confirmWord
    ? typedInput.trim().toUpperCase() === confirmWord.toUpperCase()
    : true

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isMatched && !isBusy) {
      onConfirm?.()
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onCancel?.()
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
        ref={modalRef}
      >
        <h3 id="confirm-delete-title" className="modal-title">
          {title}
        </h3>

        {description && (
          <p id="confirm-delete-desc" className="modal-description">
            {description}
          </p>
        )}

        {warningText && (
          <p className="notice notice-warning" style={{ marginBottom: '1rem' }}>
            {warningText}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {confirmWord && (
            <label className="modal-input-label" htmlFor="confirm-delete-input">
              <span>
                To proceed, type <strong>{confirmWord}</strong> below:
              </span>
              <input
                id="confirm-delete-input"
                ref={inputRef}
                type="text"
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder={confirmWord}
                autoComplete="off"
                disabled={isBusy}
                className="modal-input"
              />
            </label>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="modal-cancel-button"
              disabled={isBusy}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="danger-button modal-confirm-button"
              disabled={!isMatched || isBusy}
            >
              {isBusy ? 'Deleting...' : confirmButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

