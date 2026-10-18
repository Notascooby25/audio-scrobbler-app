import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import HomePage from './pages/HomePage'
import * as api from './api'

vi.mock('./api')

describe('Monthly Archive Ledger (Distillation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem(
      'audio-scrobbler-session',
      JSON.stringify({ accessToken: 'test-token', userId: 1 })
    )
    api.fetchSpotifyStatus.mockResolvedValue({ rate_limited: false })
    api.fetchRecentScrobbles.mockResolvedValue({ scrobbles: [], total: 0, limit: 50, offset: 0 })
    api.fetchUserCharts.mockResolvedValue({ entries: [] })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders high-level archive totals and monthly rows when summary is loaded', async () => {
    api.fetchMonthlySummary.mockResolvedValue({
      user_id: 1,
      total_months: 2,
      summary: [
        { month: '2026-02', total_plays: 100, unique_tracks: 40, total_listening_minutes: 300 },
        { month: '2026-01', total_plays: 50, unique_tracks: 25, total_listening_minutes: 150 },
      ],
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    expect(await screen.findByText('Monthly archive ledger')).toBeInTheDocument()
    expect(screen.getByText('2026-02')).toBeInTheDocument()
    expect(screen.getByText('2026-01')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('300 min')).toBeInTheDocument()
  })

  it('renders year filter chips and filters rows when a year is selected', async () => {
    api.fetchMonthlySummary.mockResolvedValue({
      user_id: 1,
      total_months: 3,
      summary: [
        { month: '2026-01', total_plays: 80, unique_tracks: 30, total_listening_minutes: 200 },
        { month: '2025-12', total_plays: 60, unique_tracks: 20, total_listening_minutes: 180 },
        { month: '2025-11', total_plays: 40, unique_tracks: 15, total_listening_minutes: 120 },
      ],
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    expect(await screen.findByText('2026-01')).toBeInTheDocument()
    expect(screen.getByText('2025-12')).toBeInTheDocument()

    // Year chips: All, 2026, 2025
    const chip2026 = screen.getByRole('tab', { name: '2026' })
    const chip2025 = screen.getByRole('tab', { name: '2025' })
    expect(chip2026).toBeInTheDocument()
    expect(chip2025).toBeInTheDocument()

    // Filter to 2026 only
    fireEvent.click(chip2026)
    expect(screen.getByText('2026-01')).toBeInTheDocument()
    expect(screen.queryByText('2025-12')).not.toBeInTheDocument()
    expect(screen.queryByText('2025-11')).not.toBeInTheDocument()

    // Filter to 2025 only
    fireEvent.click(chip2025)
    expect(screen.queryByText('2026-01')).not.toBeInTheDocument()
    expect(screen.getByText('2025-12')).toBeInTheDocument()
    expect(screen.getByText('2025-11')).toBeInTheDocument()

    // Reset to All
    fireEvent.click(screen.getByRole('tab', { name: 'All' }))
    expect(screen.getByText('2026-01')).toBeInTheDocument()
    expect(screen.getByText('2025-12')).toBeInTheDocument()
  })
})
