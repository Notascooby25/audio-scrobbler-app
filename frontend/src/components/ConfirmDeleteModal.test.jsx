import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfirmDeleteModal from './ConfirmDeleteModal'

describe('ConfirmDeleteModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('does not render when isOpen is false', () => {
    render(<ConfirmDeleteModal isOpen={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog with title, description, and requires typing DELETE by default', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <ConfirmDeleteModal
        isOpen={true}
        title="Delete YouTube scrobbles"
        description="Are you sure you want to delete all scrobbles?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete YouTube scrobbles')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to delete all scrobbles?')).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'Delete permanently' })
    expect(confirmBtn).toBeDisabled()

    const input = screen.getByPlaceholderText('DELETE')
    fireEvent.change(input, { target: { value: 'del' } })
    expect(confirmBtn).toBeDisabled()

    fireEvent.change(input, { target: { value: 'DELETE' } })
    expect(confirmBtn).not.toBeDisabled()

    fireEvent.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel button is clicked or Escape key is pressed', () => {
    const onCancel = vi.fn()

    render(
      <ConfirmDeleteModal
        isOpen={true}
        title="Delete scrobbles"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
