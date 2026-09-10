import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import { fetchUserSettings, updateUserSettings } from '../api'

vi.mock('../api', () => ({
  fetchUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
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
})
