import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FriendsComparisonSection from './FriendsComparisonSection'
import * as api from '../../api'

describe('FriendsComparisonSection', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders loading state initially', () => {
    vi.spyOn(api, 'fetchFriendsComparison').mockImplementation(() => new Promise(() => {}))
    render(
      <MemoryRouter>
        <FriendsComparisonSection token="tok" dateRange={{ range: 'last.week' }} />
      </MemoryRouter>
    )
    expect(screen.getByText('Loading friends comparison...')).toBeInTheDocument()
  })

  it('renders empty callout when user follows no friends', async () => {
    vi.spyOn(api, 'fetchFriendsComparison').mockResolvedValue({
      has_friends: false,
      top_artists: [],
      top_tracks: [],
      leaderboard: [],
    })

    render(
      <MemoryRouter>
        <FriendsComparisonSection token="tok" dateRange={{ range: 'last.week' }} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No followed friends yet.')).toBeInTheDocument()
    })
    const link = screen.getByRole('link', { name: /Find and follow friends/i })
    expect(link).toHaveAttribute('href', '/following')
  })

  it('renders cards with shared artists, shared songs, and leaderboard', async () => {
    vi.spyOn(api, 'fetchFriendsComparison').mockResolvedValue({
      has_friends: true,
      top_artists: [
        {
          name: 'Lime Garden',
          total_scrobbles: 15,
          contributions: [
            { user_id: 1, username: 'alice', scrobbles: 10 },
            { user_id: 2, username: 'bob', scrobbles: 5 },
          ],
        },
      ],
      top_tracks: [
        {
          name: 'Stain',
          artist_name: 'Lime Garden',
          total_scrobbles: 8,
          contributions: [
            { user_id: 1, username: 'alice', scrobbles: 5 },
            { user_id: 2, username: 'bob', scrobbles: 3 },
          ],
        },
      ],
      leaderboard: [
        {
          user_id: 1,
          username: 'alice',
          is_current_user: true,
          minutes_listened: 120,
          scrobbles: 30,
          rank: 1,
        },
        {
          user_id: 2,
          username: 'bob',
          is_current_user: false,
          minutes_listened: 80,
          scrobbles: 20,
          rank: 2,
        },
      ],
    })

    render(
      <MemoryRouter>
        <FriendsComparisonSection token="tok" dateRange={{ range: 'last.week' }} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Top Artists with Friends')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Lime Garden')).toHaveLength(2)
    expect(screen.getByText(/15 scrobbles/i)).toBeInTheDocument()
    expect(screen.getByText(/alice \(10\)/i)).toBeInTheDocument()
    expect(screen.getByText(/bob \(5\)/i)).toBeInTheDocument()

    expect(screen.getByText('Top Songs with Friends')).toBeInTheDocument()
    expect(screen.getByText('Stain')).toBeInTheDocument()

    expect(screen.getByText('Minutes Listened')).toBeInTheDocument()
    expect(screen.getByText('120 min')).toBeInTheDocument()
    expect(screen.getByText('80 min')).toBeInTheDocument()
  })

  it('renders no-overlap notices when friends exist but shared lists are empty', async () => {
    vi.spyOn(api, 'fetchFriendsComparison').mockResolvedValue({
      has_friends: true,
      top_artists: [],
      top_tracks: [],
      leaderboard: [
        {
          user_id: 1,
          username: 'alice',
          is_current_user: true,
          minutes_listened: 50,
          scrobbles: 15,
          rank: 1,
        },
      ],
    })

    render(
      <MemoryRouter>
        <FriendsComparisonSection token="tok" dateRange={{ range: 'last.week' }} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No shared artists played this period.')).toBeInTheDocument()
    })
    expect(screen.getByText('No shared songs played this period.')).toBeInTheDocument()
    expect(screen.getByText('50 min')).toBeInTheDocument()
  })
})
