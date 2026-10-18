import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import CopyScrobblesModal from './CopyScrobblesModal'
import * as api from '../../api'

vi.mock('../../api')
vi.mock('../../session', () => ({
  readSession: () => ({ accessToken: 'test-token' })
}))

describe('CopyScrobblesModal', () => {
  const renderModal = (props = {}) => {
    return render(
      <CopyScrobblesModal userId={123} username="testuser" onClose={vi.fn()} {...props} />
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    cleanup()
  })

  it('renders correctly', () => {
    renderModal()
    expect(screen.getByText(/Select a time range to copy scrobbles/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Copy Scrobbles' })).toBeInTheDocument()
  })

  it('calls api when submitted and shows success', async () => {
    api.copyScrobbles.mockResolvedValue({ status: 'ok', copied_count: 5 })
    
    renderModal()
    
    fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '2026-01-01T12:00' } })
    fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '2026-01-01T14:00' } })
    
    fireEvent.click(screen.getByRole('button', { name: 'Copy Scrobbles' }))
    
    await waitFor(() => {
      expect(api.copyScrobbles).toHaveBeenCalledWith({
        token: 'test-token',
        userId: 123,
        startDate: new Date('2026-01-01T12:00').toISOString(),
        endDate: new Date('2026-01-01T14:00').toISOString()
      })
    })
    
    expect(await screen.findByText(/Successfully copied/)).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose on Escape key when status is loading', async () => {
    let resolvePromise
    api.copyScrobbles.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))
    const onClose = vi.fn()
    renderModal({ onClose })

    fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '2026-01-01T12:00' } })
    fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '2026-01-01T14:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Copy Scrobbles' }))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    resolvePromise({ status: 'ok', copied_count: 0 })
  })
})
