import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import {
  advancedDeleteImports,
  deleteImportedScrobbles,
  enableLikedTracksSync,
  fetchBlocks,
  fetchImportBatches,
  fetchScrobbleSettings,
  fetchUserSettings,
  removeBlock,
  updateScrobbleSettings,
  updateUserSettings,
} from '../api'

vi.mock('../api', () => ({
  fetchUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  fetchScrobbleSettings: vi.fn(),
  updateScrobbleSettings: vi.fn(),
  enableLikedTracksSync: vi.fn(),
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
  theme: 'system',
  default_page_size: 50,
  default_library_view: 'list',
  scrobbles_view: null,
  artists_view: null,
  albums_view: null,
  tracks_view: null,
  show_artwork: true,
  show_source_badges: true,
  timestamp_mode: 'relative',
}

const scrobbleSettings = {
  user_id: 1,
  strip_remaster_tags: true,
  poll_interval_minutes: 5,
  liked_tracks_sync_enabled: false,
  liked_tracks_backfill_in_progress: false,
  liked_tracks_last_synced_at: null,
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ accessToken: 'token', userId: 1 }))
    fetchUserSettings.mockResolvedValue(settings)
    fetchBlocks.mockResolvedValue({ blocks: [] })
    fetchImportBatches.mockResolvedValue({ batches: [] })
    updateUserSettings.mockImplementation(({ changes }) => Promise.resolve({ ...settings, ...changes }))
    fetchScrobbleSettings.mockResolvedValue(scrobbleSettings)
    updateScrobbleSettings.mockImplementation(({ changes }) => Promise.resolve({ ...scrobbleSettings, ...changes }))
    enableLikedTracksSync.mockResolvedValue({ ...scrobbleSettings, liked_tracks_sync_enabled: true, liked_tracks_backfill_in_progress: true })
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

  it('updates the theme setting and saves it', async () => {
    fetchUserSettings.mockResolvedValue(settings)
    updateUserSettings.mockResolvedValue({ ...settings, theme: 'dark' })
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByLabelText('Theme')).toHaveValue('system'))
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } })

    await waitFor(() => expect(updateUserSettings).toHaveBeenCalledWith({ token: 'token', changes: { theme: 'dark' } }), { timeout: 1000 })
    expect(localStorage.getItem('audio-scrobbler-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
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

  it('renders all 6 tabs with Danger Zone visually distinct and switches between them', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    // All 6 tabs present
    const generalTab = await screen.findByRole('tab', { name: 'General' })
    const changelogTab = screen.getByRole('tab', { name: 'Changelog' })
    const viewsTab = screen.getByRole('tab', { name: 'Views' })
    const scrobbleTab = screen.getByRole('tab', { name: 'Scrobble' })
    const dataTab = screen.getByRole('tab', { name: 'Data' })
    const dangerTab = screen.getByRole('tab', { name: 'Danger Zone' })

    expect(generalTab).toBeInTheDocument()
    expect(viewsTab).toBeInTheDocument()
    expect(scrobbleTab).toBeInTheDocument()
    expect(dataTab).toBeInTheDocument()
    expect(dangerTab).toBeInTheDocument()

    // Danger Zone tab has destructive styling class
    expect(dangerTab).toHaveClass('destructive')

    // Initially on General tab
    expect(generalTab).toHaveClass('active')
    expect(screen.getByLabelText('Default date range')).toBeInTheDocument()
    expect(screen.queryByLabelText('Artists view')).not.toBeInTheDocument()

    // Switch to Views tab
    fireEvent.click(viewsTab)
    expect(viewsTab).toHaveClass('active')
    expect(screen.getByLabelText('Artists view')).toBeInTheDocument()
    expect(screen.getByLabelText('Scrobbles view')).toBeInTheDocument()
    expect(screen.queryByLabelText('Default date range')).not.toBeInTheDocument()

    // Switch to Data tab
    fireEvent.click(dataTab)
    expect(dataTab).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Backfill Missing Artwork' })).toBeInTheDocument()

    // Switch to Danger Zone tab
    fireEvent.click(dangerTab)
    expect(dangerTab).toHaveClass('active')
    expect(screen.getByText('Deleting scrobbles removes them permanently from your library. This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Scrobbles' })).toBeInTheDocument()
  })

  it('preserves form state when switching tabs', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    // Switch to Danger Zone
    const dangerTab = await screen.findByRole('tab', { name: 'Danger Zone' })
    fireEvent.click(dangerTab)

    // Select "By Date Range" mode and set dates
    fireEvent.click(screen.getByLabelText('By Date Range'))
    const startDateInput = screen.getByLabelText('Start Date:')
    fireEvent.change(startDateInput, { target: { value: '2025-01-01' } })
    expect(startDateInput).toHaveValue('2025-01-01')

    // Switch away to General tab
    const generalTab = screen.getByRole('tab', { name: 'General' })
    fireEvent.click(generalTab)
    expect(screen.getByLabelText('Default date range')).toBeInTheDocument()

    // Switch back to Danger Zone tab
    fireEvent.click(dangerTab)
    // Selected mode and date inputs are preserved
    expect(screen.getByLabelText('By Date Range')).toBeChecked()
    expect(screen.getByLabelText('Start Date:')).toHaveValue('2025-01-01')
  })

  it('requires typed DELETE confirmation modal before deleting scrobbles', async () => {
    advancedDeleteImports.mockResolvedValue({ deleted: 32 })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    // Click the Danger Zone tab
    const dangerTab = await screen.findByRole('tab', { name: 'Danger Zone' })
    fireEvent.click(dangerTab)

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

  it('saves the strip remaster tags toggle and poll interval from the Scrobble tab', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    const scrobbleTab = await screen.findByRole('tab', { name: 'Scrobble' })
    fireEvent.click(scrobbleTab)

    const stripToggle = await screen.findByLabelText(/Strip remaster tags/)
    expect(stripToggle).toBeChecked()
    fireEvent.click(stripToggle)

    await waitFor(() =>
      expect(updateScrobbleSettings).toHaveBeenCalledWith({ token: 'token', changes: { strip_remaster_tags: false } }),
      { timeout: 1000 },
    )

    fireEvent.change(screen.getByLabelText('Poll frequency'), { target: { value: '30' } })

    await waitFor(() =>
      expect(updateScrobbleSettings).toHaveBeenCalledWith({ token: 'token', changes: { poll_interval_minutes: 30 } }),
      { timeout: 1000 },
    )
  })

  it('triggers liked-songs sync once and then shows it as active', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    const dataTab = await screen.findByRole('tab', { name: 'Data' })
    fireEvent.click(dataTab)

    const syncButton = await screen.findByRole('button', { name: 'Sync Liked Songs' })
    fireEvent.click(syncButton)

    await waitFor(() => expect(enableLikedTracksSync).toHaveBeenCalledWith({ token: 'token' }))
    await waitFor(() => expect(screen.getByText(/Liked songs sync is active/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Sync Liked Songs' })).not.toBeInTheDocument()
  })
})
