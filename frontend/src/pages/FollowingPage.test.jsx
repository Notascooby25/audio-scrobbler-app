import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FollowingPage from './FollowingPage'

vi.mock('../api', () => ({
  fetchFollowing: vi.fn(),
  searchUsers: vi.fn(),
}))

import { fetchFollowing, searchUsers } from '../api'

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
})
