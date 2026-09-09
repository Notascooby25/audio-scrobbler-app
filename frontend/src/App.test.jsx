import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./api', () => ({
  fetchMonthlySummary: vi.fn(),
}))

import { fetchMonthlySummary } from './api'

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

    fireEvent.change(screen.getByLabelText('Bearer token'), { target: { value: 'demo-token' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Refresh summary' }).closest('form'))

    await waitFor(() => expect(screen.getByText('No listens found for this date range.')).toBeInTheDocument())
    expect(fetchMonthlySummary).toHaveBeenCalledWith({ token: 'demo-token', fromMonth: '', toMonth: '' })
  })

  it('renders monthly metrics from a populated summary', async () => {
    fetchMonthlySummary.mockResolvedValue({
      user_id: 1,
      total_months: 1,
      summary: [{ month: '2026-01', total_plays: 12, unique_tracks: 5, total_listening_minutes: 240 }],
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('Bearer token'), { target: { value: 'demo-token' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Refresh summary' }).closest('form'))

    await waitFor(() => expect(screen.getByText('2026-01')).toBeInTheDocument())
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('240 min')).toBeInTheDocument()
  })
})