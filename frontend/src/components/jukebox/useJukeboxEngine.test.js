import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useJukeboxEngine } from './useJukeboxEngine'

const MOCK_ALBUMS = [
  { id: 1, album_name: 'Abbey Road', artist_name: 'The Beatles', release_year: 1969, genres: ['Rock'], duration_ms: 2843000, added_at: '2026-01-01T00:00:00Z', play_count: 50, last_picked_at: null },
  { id: 2, album_name: 'Nevermind', artist_name: 'Nirvana', release_year: 1991, genres: ['Grunge'], duration_ms: 2900000, added_at: '2026-02-01T00:00:00Z', play_count: 20, last_picked_at: null },
  { id: 3, album_name: 'Discovery', artist_name: 'Daft Punk', release_year: 2001, genres: ['Electronic'], duration_ms: 3660000, added_at: '2026-03-01T00:00:00Z', play_count: 5, last_picked_at: null },
  { id: 4, album_name: 'Currents', artist_name: 'Tame Impala', release_year: 2015, genres: ['Alternative'], duration_ms: 3060000, added_at: '2026-04-01T00:00:00Z', play_count: 80, last_picked_at: null },
]

describe('useJukeboxEngine', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('initializes with all albums and rolls left as 3', () => {
    const { result } = renderHook(() => useJukeboxEngine(MOCK_ALBUMS))
    expect(result.current.filteredAlbums.length).toBe(4)
    expect(result.current.rollsLeft).toBe(3)
    expect(result.current.sessionActive).toBe(false)
  })

  it('filters by decade correctly', () => {
    const { result } = renderHook(() => useJukeboxEngine(MOCK_ALBUMS))
    act(() => {
      result.current.toggleFilter('decade', '1960')
    })
    expect(result.current.filteredAlbums.length).toBe(1)
    expect(result.current.filteredAlbums[0].album_name).toBe('Abbey Road')
  })

  it('spends rolls on Lucky Dip and Re-roll down to 0 and locks', () => {
    const { result } = renderHook(() => useJukeboxEngine(MOCK_ALBUMS))
    act(() => {
      result.current.luckyDip()
    })
    expect(result.current.sessionActive).toBe(true)
    expect(result.current.rollsLeft).toBe(3)
    expect(result.current.currentPick).not.toBeNull()

    act(() => {
      result.current.reroll()
    })
    expect(result.current.rollsLeft).toBe(2)

    act(() => {
      result.current.reroll()
    })
    expect(result.current.rollsLeft).toBe(1)

    act(() => {
      result.current.reroll()
    })
    expect(result.current.rollsLeft).toBe(0)
    expect(result.current.canRoll).toBe(false)
  })

  it('commits session and resets rolls when commitSession is called', () => {
    const { result } = renderHook(() => useJukeboxEngine(MOCK_ALBUMS))
    act(() => {
      result.current.luckyDip()
      result.current.reroll()
      result.current.commitSession()
    })
    expect(result.current.sessionActive).toBe(false)
    expect(result.current.rollsLeft).toBe(3)
  })
})
