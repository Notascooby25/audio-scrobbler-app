import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import RetroJukebox from './RetroJukebox'

describe('RetroJukebox', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    filteredAlbums: [{ id: 1, album_name: 'Abbey Road', artist_name: 'The Beatles', release_year: 1969, play_count: 42 }],
    pool: [{ id: 1, album_name: 'Abbey Road', artist_name: 'The Beatles', release_year: 1969, play_count: 42 }],
    currentPick: { id: 1, album_name: 'Abbey Road', artist_name: 'The Beatles', release_year: 1969, play_count: 42, spotify_url: 'https://open.spotify.com/album/1' },
    rollsLeft: 3,
    sessionActive: false,
    canRoll: true,
    busy: false,
    mode: 'any',
    setMode: vi.fn(),
    onLuckyDip: vi.fn(),
    onReroll: vi.fn(),
    onCommit: vi.fn(),
  }

  it('renders marquee, turntable, and lucky dip button', () => {
    render(<RetroJukebox {...defaultProps} />)
    expect(screen.getByText('JUKEBOX')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lucky Dip/i })).toBeInTheDocument()
    expect(screen.getByText('Abbey Road')).toBeInTheDocument()
  })

  it('renders album title and artist with explicit high-contrast retro colors', () => {
    render(<RetroJukebox {...defaultProps} />)
    const titleEl = screen.getByRole('heading', { level: 3, name: 'Abbey Road' })
    expect(titleEl).toHaveStyle({ color: '#24212b' })

    const artistEl = screen.getByText(/The Beatles \(1969\)/)
    expect(artistEl).toHaveStyle({ color: '#394651' })

    const countEl = screen.getByText(/records match filters/i)
    expect(countEl).toHaveStyle({ color: '#24212b' })
  })
})

