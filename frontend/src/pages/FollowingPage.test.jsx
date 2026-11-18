import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FollowingPage from './FollowingPage'

vi.mock('../api', () => ({
  fetchFollowing: vi.fn(),
  fetchFollowers: vi.fn(),
  removeFollower: vi.fn(),
  searchUsers: vi.fn(),
  fetchLeaderboard: vi.fn(),
}))

import { fetchFollowing, fetchFollowers, removeFollower, searchUsers, fetchLeaderboard } from '../api'

describe('FollowingPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    fetchFollowers.mockResolvedValue({ results: [] })
  })

  const signIn = () =>
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token' }))

  const twoFollowers = () => {
    fetchFollowing.mockResolvedValue({ results: [] })
    searchUsers.mockResolvedValue({ results: [] })
    fetchFollowers.mockResolvedValue({
      results: [
        { id: 7, username: 'jo_vinyl', display_name: 'Jo Vinyl' },
        { id: 8, username: 'alex_music', display_name: 'Alex Music' },
      ],
    })
  }

  it('shows a Followers section with a Remove button for each follower', async () => {
    signIn()
    twoFollowers()
    render(<MemoryRouter><FollowingPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Followers (2)' })).toBeInTheDocument())
    expect(fetchFollowers).toHaveBeenCalledWith({ token: 'demo-token' })
    expect(screen.getByRole('button', { name: 'Remove jo_vinyl', exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove alex_music', exact: true })).toBeInTheDocument()
  })

  it('asks for confirmation, then removes the follower', async () => {
    signIn()
    twoFollowers()
    removeFollower.mockResolvedValue({ follower_count: 1 })
    render(<MemoryRouter><FollowingPage /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove jo_vinyl', exact: true }))
    expect(screen.getByText(/Remove Jo Vinyl\? They can follow you again\./)).toBeInTheDocument()
    expect(removeFollower).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove jo_vinyl', exact: true }))
    await waitFor(() => expect(removeFollower).toHaveBeenCalledWith({ token: 'demo-token', userId: 7 }))
    await waitFor(() => expect(screen.queryByText('Jo Vinyl')).not.toBeInTheDocument())
    expect(screen.getByText('Alex Music')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Followers (1)' })).toBeInTheDocument()
  })

  it('keeps the follower when the confirmation is cancelled', async () => {
    signIn()
    twoFollowers()
    render(<MemoryRouter><FollowingPage /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove jo_vinyl', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel removing jo_vinyl', exact: true }))

    expect(removeFollower).not.toHaveBeenCalled()
    expect(screen.getByText('Jo Vinyl')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove jo_vinyl', exact: true })).toBeInTheDocument()
  })

  it('shows an error and keeps the follower when removing fails', async () => {
    signIn()
    twoFollowers()
    removeFollower.mockRejectedValue(new Error('Could not remove follower'))
    render(<MemoryRouter><FollowingPage /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove jo_vinyl', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove jo_vinyl', exact: true }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not remove follower')
    expect(screen.getByText('Jo Vinyl')).toBeInTheDocument()
  })

  it('shows an empty message when nobody follows you yet', async () => {
    signIn()
    fetchFollowing.mockResolvedValue({ results: [] })
    searchUsers.mockResolvedValue({ results: [] })
    render(<MemoryRouter><FollowingPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText(/nobody follows you yet/i)).toBeInTheDocument())
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
