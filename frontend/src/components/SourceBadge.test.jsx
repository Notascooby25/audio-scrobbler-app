import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SourceBadge, { resolveSourceType, getSourceLabel } from './SourceBadge'

describe('SourceBadge', () => {
  it('resolves source types correctly', () => {
    expect(resolveSourceType(null)).toBeNull()
    expect(resolveSourceType([])).toBeNull()
    expect(resolveSourceType('spotify')).toBe('spotify')
    expect(resolveSourceType('spotify_realtime')).toBe('spotify')
    expect(resolveSourceType(['spotify'])).toBe('spotify')
    expect(resolveSourceType('youtube')).toBe('youtube')
    expect(resolveSourceType(['youtube'])).toBe('youtube')
    expect(resolveSourceType(['spotify', 'youtube'])).toBe('split')
    expect(resolveSourceType(['youtube', 'spotify'])).toBe('split')
    expect(resolveSourceType('import')).toBe('import')
    expect(resolveSourceType(['other'])).toBe('import')
  })

  it('returns human-readable labels', () => {
    expect(getSourceLabel('split')).toBe('Scrobbled via Spotify and YouTube')
    expect(getSourceLabel('spotify')).toBe('Scrobbled via Spotify')
    expect(getSourceLabel('youtube')).toBe('Scrobbled via YouTube Music')
    expect(getSourceLabel('import')).toBe('Imported scrobble')
  })

  it('renders nothing when no sources are provided', () => {
    const { container } = render(<SourceBadge />)
    expect(container.firstChild).toBeNull()
  })

  it('renders Spotify badge with accessible label', () => {
    render(<SourceBadge source="spotify" />)
    const badge = screen.getByRole('img', { name: 'Scrobbled via Spotify' })
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('source-badge-spotify')
    expect(badge).toHaveClass('source-badge-list')
  })

  it('renders YouTube badge with accessible label', () => {
    render(<SourceBadge source="youtube" />)
    const badge = screen.getByRole('img', { name: 'Scrobbled via YouTube Music' })
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('source-badge-youtube')
  })

  it('renders split badge when both Spotify and YouTube are present', () => {
    render(<SourceBadge sources={['spotify', 'youtube']} size="grid" />)
    const badge = screen.getByRole('img', { name: 'Scrobbled via Spotify and YouTube' })
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('source-badge-split')
    expect(badge).toHaveClass('source-badge-grid')
  })

  it('renders import badge for imported data', () => {
    render(<SourceBadge source="import" />)
    const badge = screen.getByRole('img', { name: 'Imported scrobble' })
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('source-badge-import')
  })
})

