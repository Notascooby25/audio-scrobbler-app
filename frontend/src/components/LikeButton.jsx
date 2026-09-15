import { useState } from 'react'
import { likeSpotifyTrack, unlikeSpotifyTrack } from '../api'

export default function LikeButton({ token, trackId, initialLiked = false }) {
  const [liked, setLiked] = useState(initialLiked)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const disabled = !trackId || busy

  const toggleLike = async () => {
    if (disabled) return
    setBusy(true)
    setError(false)
    try {
      const response = liked
        ? await unlikeSpotifyTrack({ token, trackId })
        : await likeSpotifyTrack({ token, trackId })
      setLiked(response.is_liked)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={liked ? 'like-button like-button-active scrobble-grid-heart' : 'like-button scrobble-grid-heart'}
      aria-label={liked ? 'Remove from Spotify liked tracks' : 'Add to Spotify liked tracks'}
      aria-pressed={liked}
      disabled={disabled}
      onClick={toggleLike}
      title={!trackId ? 'Spotify track unavailable' : error ? 'Spotify could not update this track' : undefined}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={liked ? "2.4" : "1.8"}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}
