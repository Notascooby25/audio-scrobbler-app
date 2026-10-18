import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RediscoverCard from './RediscoverCard'
import { createRediscoverPlaylist, fetchRediscoverTracks } from '../api'

vi.mock('../api', () => ({
  fetchRediscoverTracks: vi.fn(),
  createRediscoverPlaylist: vi.fn(),
}))

describe('RediscoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders loading state and then displays forgotten favorites', async () => {
    fetchRediscoverTracks.mockResolvedValueOnce({
      user_id: 1,
      mode: 'forgotten',
      tracks: [
        {
          track_name: 'Echoes of Love',
          artist_name: 'The Nostalgics',
          album_name: 'Archive 1',
          artwork_url: 'https://example.com/art.jpg',
          track_id: 'spotify-track-1',
          play_count: 14,
          last_played_at: '2025-08-10T00:00:00Z',
          context_badge: '14 plays · Last played Aug 2025',
        },
      ],
    })

    render(<RediscoverCard token="mock-token" />)

    expect(screen.getByText('Finding tracks in your archive...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Echoes of Love')).toBeInTheDocument()
    })

    expect(screen.getByText('The Nostalgics')).toBeInTheDocument()
    expect(screen.getByText('14 plays · Last played Aug 2025')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save to Spotify' })).toBeEnabled()
  })

  it('switches to On This Day mode and loads anniversary tracks', async () => {
    fetchRediscoverTracks.mockResolvedValueOnce({
      user_id: 1,
      mode: 'forgotten',
      tracks: [],
    })
    fetchRediscoverTracks.mockResolvedValueOnce({
      user_id: 1,
      mode: 'anniversary',
      tracks: [
        {
          track_name: 'Autumn Leaves',
          artist_name: 'Jazz Quartet',
          album_name: 'October Sessions',
          track_id: 'spotify-track-2',
          play_count: 3,
          last_played_at: '2025-10-18T10:00:00Z',
          context_badge: 'Played 1 year ago (Oct 2025)',
        },
      ],
    })

    render(<RediscoverCard token="mock-token" />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'On This Day' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'On This Day' }))

    await waitFor(() => {
      expect(fetchRediscoverTracks).toHaveBeenCalledWith({
        token: 'mock-token',
        mode: 'anniversary',
        limit: 12,
      })
      expect(screen.getByText('Autumn Leaves')).toBeInTheDocument()
    })

    expect(screen.getByText('Played 1 year ago (Oct 2025)')).toBeInTheDocument()
  })

  it('displays empty state when no tracks are found', async () => {
    fetchRediscoverTracks.mockResolvedValueOnce({
      user_id: 1,
      mode: 'forgotten',
      tracks: [],
    })

    render(<RediscoverCard token="mock-token" />)

    await waitFor(() => {
      expect(
        screen.getByText(/No forgotten favorites yet — keep listening and they'll appear here/)
      ).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Save to Spotify' })).toBeDisabled()
  })

  it('handles error state and retry', async () => {
    fetchRediscoverTracks.mockRejectedValueOnce(new Error('Network error'))

    render(<RediscoverCard token="mock-token" />)

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })

    fetchRediscoverTracks.mockResolvedValueOnce({
      user_id: 1,
      mode: 'forgotten',
      tracks: [
        {
          track_name: 'Retry Success',
          artist_name: 'Artist',
          track_id: 't-retry',
          play_count: 5,
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('Retry Success')).toBeInTheDocument()
    })
  })

  it('successfully creates Spotify playlist and shows banner link', async () => {
    fetchRediscoverTracks.mockResolvedValueOnce({
      user_id: 1,
      mode: 'forgotten',
      tracks: [
        {
          track_name: 'Song One',
          artist_name: 'Artist One',
          track_id: 'spotify-track-1',
          play_count: 8,
        },
      ],
    })

    createRediscoverPlaylist.mockResolvedValueOnce({
      playlist_name: 'Forgotten Favorites — Oct 2026',
      playlist_url: 'https://open.spotify.com/playlist/sample123',
      track_count: 1,
    })

    render(<RediscoverCard token="mock-token" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save to Spotify' })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save to Spotify' }))

    await waitFor(() => {
      expect(createRediscoverPlaylist).toHaveBeenCalledWith({
        token: 'mock-token',
        mode: 'forgotten',
      })
      expect(screen.getByText('Forgotten Favorites — Oct 2026')).toBeInTheDocument()
    })

    const playlistLink = screen.getByRole('link', {
      name: 'Forgotten Favorites — Oct 2026',
    })
    expect(playlistLink).toHaveAttribute('href', 'https://open.spotify.com/playlist/sample123')

    // Test dismiss
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(screen.queryByText('Forgotten Favorites — Oct 2026')).not.toBeInTheDocument()
  })

  it('shows error banner when playlist creation fails', async () => {
    fetchRediscoverTracks.mockResolvedValueOnce({
      user_id: 1,
      mode: 'forgotten',
      tracks: [
        {
          track_name: 'Song One',
          artist_name: 'Artist One',
          track_id: 'spotify-track-1',
          play_count: 8,
        },
      ],
    })

    createRediscoverPlaylist.mockRejectedValueOnce(
      new Error('Spotify API rate limit reached')
    )

    render(<RediscoverCard token="mock-token" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save to Spotify' })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save to Spotify' }))

    await waitFor(() => {
      expect(screen.getByText('Spotify API rate limit reached')).toBeInTheDocument()
    })
  })
})
