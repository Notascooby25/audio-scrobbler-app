import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FollowingPage from './FollowingPage'

vi.mock('../api', () => ({
  fetchFollowing: vi.fn(),
  searchUsers: vi.fn(),
  fetchLeaderboard: vi.fn(),
}))

import { fetchFollowing, searchUsers, fetchLeaderboard } from '../api'

describe('FollowingPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('prompts sign-in when there is no session', () => {
    render(<MemoryRouter><FollowingPage /></MemoryRouter>)
    expect(screen.getByText('Sign in to see who you follow.')).toBeInTheDocument()
  })

  it('lists followed users linking to their profiles', async () => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token' }))
    fetchFollowing.mockResolvedValue({
      results: [
        { id: 2, username: 'music-fan', display_name: 'Music Fan' },
        { id: 3, username: 'other-fan', display_name: 'Other Fan' },
      ],
    })
    searchUsers.mockResolvedValue({ results: [] })

    render(<MemoryRouter><FollowingPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('Music Fan')).toBeInTheDocument())
    expect(fetchFollowing).toHaveBeenCalledWith({ token: 'demo-token' })
    expect(screen.getByText('@music-fan')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'View profile' })[0]).toHaveAttribute('href', '/profile/2')
    expect(screen.getAllByRole('link', { name: 'View profile' })[1]).toHaveAttribute('href', '/profile/3')
  })

  it('shows an empty-state message when following no one', async () => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token' }))
    fetchFollowing.mockResolvedValue({ results: [] })
    searchUsers.mockResolvedValue({ results: [] })

    render(<MemoryRouter><FollowingPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText(/not following anyone yet/)).toBeInTheDocument())
  })

  it('can switch to leaderboard tab and fetch data', async () => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token' }))
    fetchFollowing.mockResolvedValue({ results: [] })
    searchUsers.mockResolvedValue({ results: [] })
    fetchLeaderboard.mockResolvedValue({
      results: [
        { user: { id: 1, username: 'viewer', display_name: 'Viewer' }, scrobble_count: 500, unique_artists: 10 },
      ]
    })

    render(<MemoryRouter><FollowingPage /></MemoryRouter>)

    const leaderboardTab = screen.getByRole('tab', { name: /Leaderboard/i })
    fireEvent.click(leaderboardTab)

    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalled())
    expect(screen.getByText(/500 scrobbles/i)).toBeInTheDocument()
    expect(screen.getByText(/Viewer \(You\)/i)).toBeInTheDocument()
  })
})
