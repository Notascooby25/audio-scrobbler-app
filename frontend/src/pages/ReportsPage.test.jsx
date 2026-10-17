import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ReportsPage from './ReportsPage'

vi.mock('../api', () => ({
  fetchReportsSummary: vi.fn().mockResolvedValue({ period_scrobbles: 10, comparison_percent: 0, listening_minutes: 50, average_per_day: 5 }),
  fetchReportsCharts: vi.fn().mockResolvedValue({ weekly_scrobbles: [], listening_heatmap: [], listening_clock: [], music_by_decade: [] }),
  fetchReportsEntity: vi.fn().mockResolvedValue({ entries: [] }),
  fetchFriendsComparison: vi.fn().mockResolvedValue({ has_friends: false, top_artists: [], top_tracks: [], leaderboard: [] }),
  fetchUserProfile: vi.fn(),
  fetchUserSettings: vi.fn().mockResolvedValue({ default_date_range: 'last.week' }),
}))

vi.mock('../session', () => ({
  readSession: vi.fn().mockReturnValue({ accessToken: 'fake-token', userId: 1 }),
}))

describe('ReportsPage with Friends Comparison', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(() => cleanup())

  it('toggles the friends comparison section when button is clicked', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    const toggleBtn = screen.getByRole('button', { name: /Compare with Friends/i })
    expect(toggleBtn).toBeInTheDocument()

    // Initially closed
    expect(screen.queryByRole('heading', { name: 'With Friends' })).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(toggleBtn)
    expect(await screen.findByRole('heading', { name: 'With Friends' })).toBeInTheDocument()

    // Button label updates to indicate active / close
    expect(screen.getByRole('button', { name: /Hide Friends Comparison/i })).toBeInTheDocument()
  })
})
