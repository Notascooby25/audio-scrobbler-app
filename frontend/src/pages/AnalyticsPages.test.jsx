import { cleanup, render, screen } from '@testing-library/react'
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
  fetchReportsSummary: vi.fn(),
  fetchReportsCharts: vi.fn(),
}))

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