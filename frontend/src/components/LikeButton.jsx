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
      {String.fromCharCode(liked ? 9829 : 9825)}
    </button>
  )
}
