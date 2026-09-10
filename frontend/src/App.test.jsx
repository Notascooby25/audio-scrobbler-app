import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./api', () => ({
  fetchMonthlySummary: vi.fn(),
  fetchRecentScrobbles: vi.fn().mockResolvedValue({ user_id: 1, scrobbles: [], limit: 50, offset: 0 }),
  fetchUserCharts: vi.fn().mockResolvedValue({ user_id: 1, entity: 'artists', range: 'overall', entries: [] }),
  submitImportScrobbles: vi.fn(),
  requestDevelopmentToken: vi.fn().mockResolvedValue({ access_token: 'demo-token', expires_in: 3600 }),
  requestSpotifyAuthorization: vi.fn().mockResolvedValue({ authorization_url: 'https://accounts.spotify.com/authorize' }),
  redirectToAuthorization: vi.fn(),
}))

import { fetchMonthlySummary, fetchRecentScrobbles, requestDevelopmentToken, requestSpotifyAuthorization, submitImportScrobbles } from './api'

describe('App', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  function renderConnectPage(hash = '') {
    window.history.pushState({}, '', `/connect${hash}`)
    return render(<App />)
  }

  it('renders the new Overview page at the root route', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it('shows an error after Spotify authorization is cancelled', () => {
    renderConnectPage('#auth_error=spotify_authorization_denied')
    expect(screen.getByText('Spotify authorization was cancelled.')).toBeInTheDocument()
    window.history.replaceState({}, document.title, window.location.pathname)
  })

  it('requests Spotify authorization from the dashboard', async () => {
    renderConnectPage()
    fireEvent.click(screen.getByRole('button', { name: 'Connect Spotify' }))
    await waitFor(() => expect(requestSpotifyAuthorization).toHaveBeenCalled())
  })

  it('renders an empty result after loading a filtered summary', async () => {
    fetchMonthlySummary.mockResolvedValue({ user_id: 1, summary: [], total_months: 0 })
    renderConnectPage()

    fireEvent.change(screen.getByLabelText('Development user ID'), { target: { value: '1' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form'))

    await waitFor(() => expect(screen.getByText('No listens found for this date range.')).toBeInTheDocument())
    expect(fetchMonthlySummary).toHaveBeenCalled()
    expect(requestDevelopmentToken).toHaveBeenCalledWith('1')
  })

  it('renders monthly metrics from a populated summary', async () => {
    fetchMonthlySummary.mockResolvedValue({
      user_id: 1,
      total_months: 1,
      summary: [{ month: '2026-01', total_plays: 12, unique_tracks: 5, total_listening_minutes: 240 }],
    })
    renderConnectPage()

    fireEvent.change(screen.getByLabelText('Development user ID'), { target: { value: '1' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form'))

    await waitFor(() => expect(screen.getByText('2026-01')).toBeInTheDocument())
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('240 min')).toBeInTheDocument()
  })

  it('clears the session when analytics returns unauthorized', async () => {
    fetchMonthlySummary.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({
      userId: 1,
      accessToken: 'expired-token',
      expiresAt: Date.now() + 60000,
    }))

    renderConnectPage()

    await waitFor(() => expect(screen.getByText('Your session has expired. Sign in again.')).toBeInTheDocument())
    expect(localStorage.getItem('audio-scrobbler-session')).toBeNull()
  })

  it('renders source badges for recent scrobbles', async () => {
    fetchMonthlySummary.mockResolvedValue({ user_id: 1, summary: [], total_months: 0 })
    fetchRecentScrobbles.mockResolvedValue({
      user_id: 1,
      limit: 50,
      offset: 0,
      scrobbles: [
        { id: 1, track_name: 'Daylight', artist_name: 'Matt Berninger', source: 'spotify', played_at: '2026-01-15T12:30:00' },
        { id: 2, track_name: 'Midnight City', artist_name: 'M83', source: 'youtube', played_at: '2026-01-15T12:31:00' },
      ],
    })
    renderConnectPage()

    fireEvent.change(screen.getByLabelText('Development user ID'), { target: { value: '1' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form'))

    await waitFor(() => expect(screen.getByText('Daylight')).toBeInTheDocument())
    expect(screen.getByText('spotify')).toBeInTheDocument()
    expect(screen.getByText('youtube')).toBeInTheDocument()
  })

  it('shows an import summary breakdown after a successful import', async () => {
    fetchMonthlySummary.mockResolvedValue({ user_id: 1, summary: [], total_months: 0 })
    fetchRecentScrobbles.mockResolvedValue({ user_id: 1, scrobbles: [], limit: 50, offset: 0 })
    submitImportScrobbles.mockResolvedValue({
      source: 'spotify',
      status: 'ok',
      summary: { inserted: 2, skipped: 1, duplicate: 0 },
    })
    renderConnectPage()

    fireEvent.change(screen.getByLabelText('Development user ID'), { target: { value: '1' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form'))
    await waitFor(() => expect(screen.getByText('No listens found for this date range.')).toBeInTheDocument())

    const file = new File([JSON.stringify([{ trackName: 'Slow Show' }])], 'spotify-history.json', { type: 'application/json' })
    file.text = async () => JSON.stringify([{ trackName: 'Slow Show' }])
    fireEvent.change(screen.getByLabelText('Import history JSON'), { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText('spotify', { exact: false })).toBeInTheDocument())
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('detects a youtube import from file content when the filename gives no hint', async () => {
    fetchMonthlySummary.mockResolvedValue({ user_id: 1, summary: [], total_months: 0 })
    fetchRecentScrobbles.mockResolvedValue({ user_id: 1, scrobbles: [], limit: 50, offset: 0 })
    submitImportScrobbles.mockResolvedValue({
      source: 'youtube',
      status: 'ok',
      summary: { inserted: 1, skipped: 0, duplicate: 0 },
    })
    renderConnectPage()

    fireEvent.change(screen.getByLabelText('Development user ID'), { target: { value: '1' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form'))
    await waitFor(() => expect(screen.getByText('No listens found for this date range.')).toBeInTheDocument())

    const entries = [{ artist: 'The Sherlocks', song: 'Everything Must Make Sense', album: 'Everything Must Make Sense!', time: '2025-10-20T12:33:20.422Z' }]
    const file = new File([JSON.stringify(entries)], 'watch-history.json', { type: 'application/json' })
    file.text = async () => JSON.stringify(entries)
    fireEvent.change(screen.getByLabelText('Import history JSON'), { target: { files: [file] } })

    await waitFor(() => expect(submitImportScrobbles).toHaveBeenCalledWith({ token: 'demo-token', source: 'youtube', entries }))
  })
})