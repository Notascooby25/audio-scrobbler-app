import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import BarTrendChart from './BarTrendChart'
import ListeningClockChart from './ListeningClockChart'

describe('BarTrendChart', () => {
  afterEach(() => cleanup())

  it('renders one bar per data point with an accessible summary', () => {
    const { container } = render(
      <BarTrendChart title="Weekly scrobbles" points={[
        { label: '2026-09-01', count: 4 },
        { label: '2026-09-02', count: 9 },
        { label: '2026-09-03', count: 2 },
      ]} />,
    )

    expect(screen.getByRole('img', { name: 'Weekly scrobbles: 3 data points' })).toBeInTheDocument()
    expect(container.querySelectorAll('rect')).toHaveLength(3)
    expect(container.querySelectorAll('.bar-trend-bar-peak')).toHaveLength(1)
  })

  it('shows an empty state without data', () => {
    render(<BarTrendChart title="Weekly scrobbles" points={[]} />)
    expect(screen.getByText('No data available for this period.')).toBeInTheDocument()
  })
})

describe('ListeningClockChart', () => {
  afterEach(() => cleanup())

  it('renders 24 hour bars and highlights the busiest hour', () => {
    const points = Array.from({ length: 24 }, (_, hour) => ({ label: String(hour), count: hour === 21 ? 12 : 1 }))
    const { container } = render(<ListeningClockChart points={points} />)

    expect(container.querySelectorAll('line.clock-bar')).toHaveLength(24)
    expect(container.querySelectorAll('.clock-bar-peak')).toHaveLength(1)
    expect(screen.getByText('21:00')).toBeInTheDocument()
  })

  it('shows an empty state when every hour is zero', () => {
    const points = Array.from({ length: 24 }, (_, hour) => ({ label: String(hour), count: 0 }))
    render(<ListeningClockChart points={points} />)
    expect(screen.getByText('No data available for this period.')).toBeInTheDocument()
  })
})
