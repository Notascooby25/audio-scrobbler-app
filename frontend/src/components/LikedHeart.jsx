export default function LikedHeart({ liked, className = '' }) {
  const label = liked ? 'Liked on Spotify' : 'Not liked on Spotify'

  return (
    <span
      className={`liked-heart ${liked ? 'liked-heart-active' : ''} ${className}`.trim()}
      title={label}
      aria-label={label}
      role="img"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </span>
  )
}
