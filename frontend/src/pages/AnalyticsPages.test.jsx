import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import OverviewPage from './OverviewPage'
import LibraryPage from './LibraryPage'
import ReportsPage from './ReportsPage'

vi.mock('../api', () => ({
  fetchStatsSummary: vi.fn(),
  fetchStatsChart: vi.fn(),
  fetchLibraryScrobbles: vi.fn(),
  fetchLibraryCollection: vi.fn(),
  fetchLibraryTimeline: vi.fn(),
  fetchLikedTracks: vi.fn(),
  fetchReportsSummary: vi.fn(),
  fetchReportsCharts: vi.fn(),
  fetchUserSettings: vi.fn().mockResolvedValue({ default_date_range: 'last.week', default_page_size: 50, default_library_view: 'list', scrobbles_view: null, artists_view: null, albums_view: null, tracks_view: null, liked_tracks_view: null, show_artwork: true, show_source_badges: true, timestamp_mode: 'relative' }),
  syncLikedTracks: vi.fn(),
  backfillArtwork: vi.fn(),
}))

import {
  fetchLibraryCollection,
  fetchLibraryScrobbles,
  fetchLibraryTimeline,
  fetchReportsCharts,
  fetchReportsSummary,
  fetchStatsChart,
  fetchStatsSummary,
} from '../api'

describe('analytics pages', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('renders the Overview entry point', () => {
    render(<MemoryRouter><OverviewPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it('renders the Library entry point', () => {
    render(<MemoryRouter><LibraryPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
  })

  it('renders the Reports entry point', () => {
    render(<MemoryRouter><ReportsPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()
  })
})

describe('date filtering', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token', expiresAt: Date.now() + 60000 }))
  })

  afterEach(() => cleanup())

  it('refetches Reports data when the date range preset changes', async () => {
    fetchReportsSummary.mockImplementation(({ dateRange }) => Promise.resolve({
      period_scrobbles: dateRange.range === 'last.month' ? 42 : 7,
      comparison_percent: 0,
    }))
    fetchReportsCharts.mockResolvedValue({ weekly_scrobbles: [], listening_clock: [] })

    render(<MemoryRouter><ReportsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText(/7 scrobbles this period/)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'last.month' } })

    await waitFor(() => expect(screen.getByText(/42 scrobbles this period/)).toBeInTheDocument())
    expect(fetchReportsSummary).toHaveBeenLastCalledWith({ token: 'demo-token', dateRange: expect.objectContaining({ range: 'last.month' }) })
  })

  it('does not refetch Reports data while a custom range is missing dates', async () => {
    fetchReportsSummary.mockResolvedValue({ period_scrobbles: 7, comparison_percent: 0 })
    fetchReportsCharts.mockResolvedValue({ weekly_scrobbles: [], listening_clock: [] })

    render(<MemoryRouter><ReportsPage /></MemoryRouter>)
    await waitFor(() => expect(fetchReportsSummary).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'custom' } })

    expect(fetchReportsSummary).toHaveBeenCalledTimes(1)
  })

  it('refetches Overview top artists when the date range changes', async () => {
    fetchStatsSummary.mockResolvedValue({ total_scrobbles: 10, unique_artists: 2, loved_tracks: 1 })
    fetchStatsChart.mockImplementation(({ entity, dateRange }) => Promise.resolve({
      entries: entity === 'artists' ? [{ label: dateRange.range, secondary: null, play_count: 1 }] : [],
    }))

    render(<MemoryRouter><OverviewPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('last.week')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'last.year' } })

    await waitFor(() => expect(screen.getByText('last.year')).toBeInTheDocument())
  })

  it('refetches the Library entity tab on date range change and hides the selector on Liked tracks', async () => {
    fetchLibraryCollection.mockImplementation(({ dateRange }) => Promise.resolve({
      entries: [{ label: dateRange.range, secondary: null, play_count: 1 }],
    }))
    fetchLibraryScrobbles.mockResolvedValue({ scrobbles: [] })
    fetchLibraryTimeline.mockResolvedValue({ entries: [] })

    render(<MemoryRouter><LibraryPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: 'Artists' }))
    await waitFor(() => expect(screen.getByText('last.week')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'last.month' } })
    await waitFor(() => expect(screen.getByText('last.month')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Liked tracks' }))
    expect(screen.queryByLabelText('Range')).not.toBeInTheDocument()
  })
})

describe('library pagination', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token', expiresAt: Date.now() + 60000 }))
  })

  afterEach(() => cleanup())

  it('shows numbered pagination and fetches the correct offset when a page is clicked', async () => {
    fetchLibraryScrobbles.mockResolvedValue({ scrobbles: [], total_count: 0 })
    fetchLibraryCollection.mockImplementation(({ offset }) => Promise.resolve({
      entries: [{ label: `Artist ${offset}`, secondary: null, play_count: 1 }],
      total_count: 120,
    }))
    fetchLibraryTimeline.mockResolvedValue({ entries: [] })

    render(<MemoryRouter><LibraryPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: 'Artists' }))
    await waitFor(() => expect(screen.getByText('Artist 0')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => expect(screen.getByText('Artist 50')).toBeInTheDocument())
    expect(fetchLibraryCollection).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50, offset: 50 }))
  })

  it('resets to page 1 and refetches with the new page size when the page-size dropdown changes', async () => {
    fetchLibraryScrobbles.mockResolvedValue({ scrobbles: [], total_count: 0 })
    fetchLibraryCollection.mockImplementation(({ limit, offset }) => Promise.resolve({
      entries: [{ label: `limit-${limit}-offset-${offset}`, secondary: null, play_count: 1 }],
      total_count: 120,
    }))
    fetchLibraryTimeline.mockResolvedValue({ entries: [] })

    render(<MemoryRouter><LibraryPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: 'Artists' }))
    await waitFor(() => expect(screen.getByText('limit-50-offset-0')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(screen.getByText('limit-50-offset-50')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Per page'), { target: { value: '25' } })

    await waitFor(() => expect(screen.getByText('limit-25-offset-0')).toBeInTheDocument())
  })

  it('hides pagination controls when everything fits on one page', async () => {
    fetchLibraryScrobbles.mockResolvedValue({ scrobbles: [], total_count: 0 })
    fetchLibraryCollection.mockResolvedValue({ entries: [{ label: 'Solo Artist', secondary: null, play_count: 1 }], total_count: 3 })
    fetchLibraryTimeline.mockResolvedValue({ entries: [] })

    render(<MemoryRouter><LibraryPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: 'Artists' }))

    await waitFor(() => expect(screen.getByText('Solo Artist')).toBeInTheDocument())
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })
})