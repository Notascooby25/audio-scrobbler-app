import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('renders comparison percentages for all three metrics when compare_to_previous is true', async () => {
    const { fetchReportsSummary } = await import('../api')
    fetchReportsSummary.mockResolvedValue({
      period_scrobbles: 244,
      comparison_percent: -36.6,
      previous_period_scrobbles: 385,
      listening_minutes: 897,
      previous_listening_minutes: 1250,
      listening_minutes_comparison_percent: -28.2,
      average_per_day: 34.9,
      previous_average_per_day: 55.0,
      average_per_day_comparison_percent: -36.5,
    })

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Toggle compare to previous period
    const compareToggle = screen.getByLabelText(/Compare to previous period/i)
    fireEvent.click(compareToggle)

    expect(await screen.findByText(/-36.6% vs previous \(385\)/)).toBeInTheDocument()
    expect(screen.getByText(/-28.2% vs previous \(1,250\)/)).toBeInTheDocument()
    expect(screen.getByText(/-36.5% vs previous \(55\)/)).toBeInTheDocument()
  })

  it('applies negative, positive, and neutral color classes to comparison delta labels', async () => {
    const { fetchReportsSummary } = await import('../api')
    fetchReportsSummary.mockResolvedValue({
      period_scrobbles: 500,
      comparison_percent: 25.5,
      previous_period_scrobbles: 400,
      listening_minutes: 800,
      previous_listening_minutes: 1000,
      listening_minutes_comparison_percent: -20.0,
      average_per_day: 50.0,
      previous_average_per_day: 50.0,
      average_per_day_comparison_percent: 0,
    })

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    const compareToggle = screen.getByLabelText(/Compare to previous period/i)
    fireEvent.click(compareToggle)

    const positiveEl = await screen.findByText(/\+25.5% vs previous \(400\)/)
    const negativeEl = screen.getByText(/-20% vs previous \(1,000\)/)
    const neutralEl = screen.getByText(/0% vs previous \(50\)/)

    expect(positiveEl).toHaveClass('stat-comparison-positive')
    expect(negativeEl).toHaveClass('stat-comparison-negative')
    expect(neutralEl).toHaveClass('stat-comparison-neutral')
  })

  it('displays loading feedback while reports are being fetched', async () => {
    const { fetchReportsSummary } = await import('../api')
    let resolveSummary
    const pendingPromise = new Promise((resolve) => {
      resolveSummary = resolve
    })
    fetchReportsSummary.mockReturnValueOnce(pendingPromise)

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('status')).toHaveTextContent(/Updating listening report/i)

    resolveSummary({
      period_scrobbles: 10,
      comparison_percent: 0,
      listening_minutes: 50,
      average_per_day: 5,
    })

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })
})

