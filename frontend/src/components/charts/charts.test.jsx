import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import BarTrendChart from './BarTrendChart'
import GenreBarList from './GenreBarList'
import ListeningHeatmap from './ListeningHeatmap'
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

describe('GenreBarList', () => {
  afterEach(() => cleanup())

  it('renders a list of genres', () => {
    const { container } = render(<GenreBarList genres={[
      { label: 'pop', count: 10 },
      { label: 'rock', count: 5 }
    ]} />)
    
    expect(screen.getByText('pop')).toBeInTheDocument()
    expect(screen.getByText('rock')).toBeInTheDocument()
    expect(container.querySelectorAll('.genre-row')).toHaveLength(2)
  })

  it('renders nothing when empty', () => {
    const { container } = render(<GenreBarList genres={[]} />)
    expect(container.querySelector('.genre-list')).not.toBeInTheDocument()
  })
})

describe('ListeningHeatmap', () => {
  afterEach(() => cleanup())

  it('renders 7x24 cells', () => {
    const points = [{ day: 0, hour: 12, count: 5 }, { day: 1, hour: 13, count: 10 }]
    const { container } = render(<ListeningHeatmap points={points} />)

    expect(container.querySelectorAll('.heatmap-cell')).toHaveLength(7 * 24)
    expect(container.querySelectorAll('.peak')).toHaveLength(1)
  })

  it('returns nothing when empty', () => {
    const { container } = render(<ListeningHeatmap points={[]} />)
    expect(container.querySelector('.heatmap-container')).not.toBeInTheDocument()
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
