import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./api', () => ({
  fetchMonthlySummary: vi.fn(),
  requestDevelopmentToken: vi.fn().mockResolvedValue({ access_token: 'demo-token', expires_in: 3600 }),
}))

import { fetchMonthlySummary, requestDevelopmentToken } from './api'

describe('App', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows the connection prompt before a token is provided', () => {
    render(<App />)
    expect(screen.getByText('Connect your account to see your listening history.')).toBeInTheDocument()
  })

  it('renders an empty result after loading a filtered summary', async () => {
    fetchMonthlySummary.mockResolvedValue({ user_id: 1, summary: [], total_months: 0 })
    render(<App />)

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
    render(<App />)

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

    render(<App />)

    await waitFor(() => expect(screen.getByText('Your session has expired. Sign in again.')).toBeInTheDocument())
    expect(localStorage.getItem('audio-scrobbler-session')).toBeNull()
  })
})