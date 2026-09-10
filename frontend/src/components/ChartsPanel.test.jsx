import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChartsPanel from './ChartsPanel'

vi.mock('../api', () => ({
  fetchUserCharts: vi.fn(),
}))

import { fetchUserCharts } from '../api'

describe('ChartsPanel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing without a token or user id', () => {
    const { container } = render(<ChartsPanel token={null} userId={null} />)
    expect(container).toBeEmptyDOMElement()
    expect(fetchUserCharts).not.toHaveBeenCalled()
  })

  it('renders ranked chart entries once loaded', async () => {
    fetchUserCharts.mockResolvedValue({
      user_id: 1,
      entity: 'artists',
      range: 'overall',
      entries: [
        { label: 'The National', secondary: null, play_count: 12 },
        { label: 'M83', secondary: null, play_count: 4 },
      ],
    })

    render(<ChartsPanel token="demo-token" userId={1} />)

    await waitFor(() => expect(screen.getByText('The National')).toBeInTheDocument())
    expect(screen.getByText('12 plays')).toBeInTheDocument()
    expect(fetchUserCharts).toHaveBeenCalledWith({ token: 'demo-token', userId: 1, entity: 'artists', range: 'overall', limit: 10 })
  })

  it('shows an empty-state notice when there are no plays', async () => {
    fetchUserCharts.mockResolvedValue({ user_id: 1, entity: 'artists', range: '7day', entries: [] })

    render(<ChartsPanel token="demo-token" userId={1} />)

    await waitFor(() => expect(screen.getByText('No plays found for this range.')).toBeInTheDocument())
  })

  it('refetches when the range selector changes', async () => {
    fetchUserCharts.mockResolvedValue({ user_id: 1, entity: 'artists', range: 'overall', entries: [] })

    render(<ChartsPanel token="demo-token" userId={1} />)
    await waitFor(() => expect(fetchUserCharts).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('Range'), { target: { value: '7day' } })

    await waitFor(() => expect(fetchUserCharts).toHaveBeenCalledWith({ token: 'demo-token', userId: 1, entity: 'artists', range: '7day', limit: 10 }))
  })

  it('shows secondary label and track/album entities distinctly', async () => {
    fetchUserCharts.mockResolvedValue({
      user_id: 1,
      entity: 'tracks',
      range: 'overall',
      entries: [{ label: 'Slow Show', secondary: 'The National', play_count: 5 }],
    })

    render(<ChartsPanel token="demo-token" userId={1} />)

    await waitFor(() => expect(screen.getByText('Slow Show')).toBeInTheDocument())
    expect(screen.getByText('The National')).toBeInTheDocument()
  })
})
