import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import {
  advancedDeleteImports,
  deleteImportedScrobbles,
  fetchBlocks,
  fetchImportBatches,
  fetchUserSettings,
  removeBlock,
  updateUserSettings,
} from '../api'

vi.mock('../api', () => ({
  fetchUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  fetchBlocks: vi.fn(),
  removeBlock: vi.fn(),
  deleteImportedScrobbles: vi.fn(),
  fetchImportBatches: vi.fn(),
  advancedDeleteImports: vi.fn(),
  startArtworkBackfill: vi.fn(),
}))

const settings = {
  user_id: 1,
  default_date_range: 'last.week',
  default_page_size: 50,
  default_library_view: 'list',
  scrobbles_view: null,
  artists_view: null,
  albums_view: null,
  tracks_view: null,
  liked_tracks_view: null,
  show_artwork: true,
  show_source_badges: true,
  timestamp_mode: 'relative',
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ accessToken: 'token', userId: 1 }))
    fetchUserSettings.mockResolvedValue(settings)
    fetchBlocks.mockResolvedValue({ blocks: [] })
    fetchImportBatches.mockResolvedValue({ batches: [] })
    updateUserSettings.mockImplementation(({ changes }) => Promise.resolve({ ...settings, ...changes }))
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('loads the Last 7 days default and automatically saves changes', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByLabelText('Default date range')).toHaveValue('last.week'))
    fireEvent.change(screen.getByLabelText('Default date range'), { target: { value: 'last.month' } })

    await waitFor(() => expect(updateUserSettings).toHaveBeenCalledWith({ token: 'token', changes: { default_date_range: 'last.month' } }), { timeout: 1000 })
  })

  it('lists blocked items and unblocks them individually', async () => {
    fetchBlocks.mockResolvedValue({ blocks: [{ id: 7, entity_type: 'album', name: 'Football Weekly', created_at: '2026-09-11T10:00:00' }] })
    removeBlock.mockResolvedValue()

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('Football Weekly')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }))

    await waitFor(() => expect(screen.queryByText('Football Weekly')).not.toBeInTheDocument())
    expect(removeBlock).toHaveBeenCalledWith({ token: 'token', blockId: 7 })
  })

  it('requires typed DELETE confirmation modal before deleting scrobbles', async () => {
    advancedDeleteImports.mockResolvedValue({ deleted: 32 })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    // Click the main Delete Scrobbles button in the Danger Zone
    const openDeleteBtn = await screen.findByRole('button', { name: 'Delete Scrobbles' })
    fireEvent.click(openDeleteBtn)

    // Modal dialog should now be visible
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Permanently Delete Scrobbles')).toBeInTheDocument()

    // Confirm button inside the dialog should be disabled
    const dialogConfirmBtn = screen.getAllByRole('button', { name: 'Delete Scrobbles' })[1]
    expect(dialogConfirmBtn).toBeDisabled()

    // Typing DELETE enables it
    const input = screen.getByPlaceholderText('DELETE')
    fireEvent.change(input, { target: { value: 'DELETE' } })
    expect(dialogConfirmBtn).not.toBeDisabled()

    // Submitting triggers the API call
    fireEvent.click(dialogConfirmBtn)

    await waitFor(() =>
      expect(advancedDeleteImports).toHaveBeenCalledWith({
        token: 'token',
        source: 'youtube',
        startDate: null,
        endDate: null,
        batchTime: null,
      })
    )

    // Success status message displayed
    await waitFor(() =>
      expect(screen.getByText('Deleted 32 scrobbles successfully.')).toBeInTheDocument()
    )
  })
})
