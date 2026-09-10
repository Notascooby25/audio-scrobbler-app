import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { likeSpotifyTrack, unlikeSpotifyTrack } from '../api'
import LikeButton from './LikeButton'

vi.mock('../api', () => ({
  likeSpotifyTrack: vi.fn(),
  unlikeSpotifyTrack: vi.fn(),
}))

describe('LikeButton', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('saves an identified track and reflects the liked state', async () => {
    likeSpotifyTrack.mockResolvedValue({ is_liked: true })
    render(<LikeButton token="token" trackId="track-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Add to Spotify liked tracks' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove from Spotify liked tracks' })).toBeInTheDocument())
    expect(likeSpotifyTrack).toHaveBeenCalledWith({ token: 'token', trackId: 'track-1' })
  })

  it('disables the heart when no Spotify identity exists', () => {
    render(<LikeButton token="token" trackId={null} />)
    expect(screen.getByRole('button', { name: 'Add to Spotify liked tracks' })).toBeDisabled()
  })

  it('removes an initially liked track', async () => {
    unlikeSpotifyTrack.mockResolvedValue({ is_liked: false })
    render(<LikeButton token="token" trackId="track-1" initialLiked />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove from Spotify liked tracks' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to Spotify liked tracks' })).toBeInTheDocument())
    expect(unlikeSpotifyTrack).toHaveBeenCalledWith({ token: 'token', trackId: 'track-1' })
  })
})
