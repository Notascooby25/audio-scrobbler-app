import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage from './ProfilePage'

vi.mock('../api', () => ({
  fetchUserProfile: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  requestSpotifyAuthorization: vi.fn().mockResolvedValue({ authorization_url: 'https://accounts.spotify.com/authorize' }),
  redirectToAuthorization: vi.fn(),
}))

import { fetchUserProfile, followUser, redirectToAuthorization } from '../api'

function renderProfile(routeUserId) {
  const path = routeUserId ? `/profile/${routeUserId}` : '/profile'
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProfilePage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows a connect prompt when there is no saved session', () => {
    renderProfile()
    expect(screen.getByText('Sign in from the dashboard, or connect Spotify to create your profile.')).toBeInTheDocument()
  })

  it('starts Spotify authorization from the connect button', async () => {
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Connect Spotify' }))
    await waitFor(() => expect(redirectToAuthorization).toHaveBeenCalledWith('https://accounts.spotify.com/authorize'))
  })

  it('hides the last scrobble from non-followers', async () => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token' }))
    fetchUserProfile.mockResolvedValue({
      id: 2,
      username: 'music-fan',
      display_name: 'Music Fan',
      follower_count: 0,
      following_count: 0,
      is_self: false,
      is_following: false,
      can_view_details: false,
      last_scrobble: null,
    })

    renderProfile(2)

    await waitFor(() => expect(screen.getByText('@music-fan')).toBeInTheDocument())
    expect(screen.getByText('Follow this user to see their last scrobbled track.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument()
  })

  it('reveals the last scrobble to followers', async () => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token' }))
    fetchUserProfile.mockResolvedValue({
      id: 2,
      username: 'music-fan',
      display_name: 'Music Fan',
      follower_count: 3,
      following_count: 1,
      is_self: false,
      is_following: true,
      can_view_details: true,
      last_scrobble: { track_name: 'Slow Show', artist_name: 'The National', album_name: 'Trouble Will Find Me', source: 'spotify', played_at: '2026-01-15T12:30:00' },
    })

    renderProfile(2)

    await waitFor(() => expect(screen.getByText('Slow Show', { exact: false })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Unfollow' })).toBeInTheDocument()
  })

  it('toggles follow state when the follow button is clicked', async () => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token' }))
    fetchUserProfile.mockResolvedValue({
      id: 2,
      username: 'music-fan',
      display_name: 'Music Fan',
      follower_count: 0,
      following_count: 0,
      is_self: false,
      is_following: false,
      can_view_details: false,
      last_scrobble: null,
    })
    followUser.mockResolvedValue({ following: true, follower_count: 1 })

    renderProfile(2)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))

    await waitFor(() => expect(followUser).toHaveBeenCalledWith({ token: 'demo-token', userId: 2 }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unfollow' })).toBeInTheDocument())
  })
})
