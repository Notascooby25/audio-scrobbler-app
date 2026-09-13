import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ImportProgressBar from './ImportProgressBar'

describe('ImportProgressBar', () => {
  it('renders nothing when progress is null or undefined', () => {
    const { container } = render(<ImportProgressBar progress={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders stage label, percentage, and dynamic message', () => {
    const progress = {
      stage: 'record_normalization',
      percent: 42,
      message: 'Normalizing 150 tracks...',
      current: 42,
      total: 100,
    }
    render(<ImportProgressBar progress={progress} />)

    expect(screen.getByText('Normalizing Records')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText('Normalizing 150 tracks...')).toBeInTheDocument()
    expect(screen.getByText('42 / 100')).toBeInTheDocument()

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '42')
  })

  it('renders errors list when errors exist', () => {
    const progress = {
      stage: 'completion',
      percent: 100,
      message: 'Import complete!',
      current: 10,
      total: 10,
      errors: ['Row 3 skipped: bad timestamp', 'Row 7 skipped: non-music podcast'],
    }
    render(<ImportProgressBar progress={progress} />)

    expect(screen.getByText('2 failed or skipped records')).toBeInTheDocument()
    expect(screen.getByText('Row 3 skipped: bad timestamp')).toBeInTheDocument()
    expect(screen.getByText('Row 7 skipped: non-music podcast')).toBeInTheDocument()
  })
})

