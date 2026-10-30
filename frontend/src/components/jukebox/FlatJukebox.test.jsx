import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import FlatJukebox from './FlatJukebox'

describe('FlatJukebox', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const defaultProps = {
    filteredAlbums: [{ id: 1, album_name: 'Abbey Road', artist_name: 'The Beatles', release_year: 1969, play_count: 42 }],
    pool: [{ id: 1, album_name: 'Abbey Road', artist_name: 'The Beatles', release_year: 1969, play_count: 42 }],
    currentPick: { id: 1, album_name: 'Abbey Road', artist_name: 'The Beatles', release_year: 1969, play_count: 42, spotify_url: 'https://open.spotify.com/album/1' },
    rollsLeft: 2,
    sessionActive: true,
    canRoll: true,
    busy: false,
    mode: 'any',
    setMode: vi.fn(),
    onLuckyDip: vi.fn(),
    onReroll: vi.fn(),
    onCommit: vi.fn(),
  }

  it('renders flat vinyl platter, album details, and controls', () => {
    render(<FlatJukebox {...defaultProps} />)
    expect(screen.getByText('Abbey Road')).toBeInTheDocument()
    expect(screen.getByText(/The Beatles/)).toBeInTheDocument()
    expect(screen.getByText(/Re-roll \(2 left\)/)).toBeInTheDocument()
    expect(screen.getByText('Open in Spotify ↗')).toBeInTheDocument()
  })

  it('triggers onReroll when reroll button clicked', () => {
    render(<FlatJukebox {...defaultProps} />)
    const rerollBtn = screen.getByRole('button', { name: /Re-roll/ })
    fireEvent.click(rerollBtn)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(defaultProps.onReroll).toHaveBeenCalled()
  })
})
