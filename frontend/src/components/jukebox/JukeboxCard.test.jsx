import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import JukeboxCard from './JukeboxCard'

vi.mock('../../api', () => ({
  fetchJukeboxAlbums: vi.fn().mockResolvedValue({
    albums: [
      { id: 1, album_name: 'Abbey Road', artist_name: 'The Beatles', release_year: 1969, play_count: 50, added_at: '2026-01-01T00:00:00Z' },
    ],
    source: 'spotify_saved',
  }),
  recordJukeboxPick: vi.fn().mockResolvedValue({ status: 'ok' }),
}))

describe('JukeboxCard', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('renders Jukebox card and allows toggling between Flat and Arcade mode', async () => {
    render(<JukeboxCard token="mock-token" />)
    expect(await screen.findByText(/Album Jukebox/i)).toBeInTheDocument()

    const toggleBtn = screen.getByRole('button', { name: /Arcade View/i })
    expect(toggleBtn).toBeInTheDocument()

    fireEvent.click(toggleBtn)
    expect(screen.getByText('JUKEBOX')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Flat View/i })).toBeInTheDocument()
  })
})
