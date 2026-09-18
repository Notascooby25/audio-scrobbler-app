import React, { useId } from 'react'

export function resolveSourceType(sourceOrSources) {
  if (!sourceOrSources) return null
  const list = Array.isArray(sourceOrSources)
    ? sourceOrSources.map((s) => String(s).toLowerCase().trim())
    : [String(sourceOrSources).toLowerCase().trim()]

  const hasSpotify = list.some((s) => s === 'spotify' || s === 'spotify_realtime' || s.startsWith('spotify'))
  const hasYoutube = list.some((s) => s === 'youtube' || s === 'youtube_music' || s === 'youtubemusic')

  if (hasSpotify && hasYoutube) return 'split'
  if (hasSpotify) return 'spotify'
  if (hasYoutube) return 'youtube'
  if (list.some((s) => s.length > 0)) return 'import'
  return null
}

export function getSourceLabel(type) {
  switch (type) {
    case 'split':
      return 'Scrobbled via Spotify and YouTube'
    case 'spotify':
      return 'Scrobbled via Spotify'
    case 'youtube':
      return 'Scrobbled via YouTube Music'
    case 'import':
      return 'Imported scrobble'
    default:
      return 'Source'
  }
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="#1DB954" />
      <path
        fill="#FFFFFF"
        d="M17.9 10.9C14.3 8.8 8.3 8.6 4.9 9.6c-.6.2-1.1-.2-1.3-.7-.2-.6.2-1.1.7-1.3 4-1.2 10.5-1 14.7 1.5.5.3.7 1 .4 1.5-.3.5-1 .7-1.5.3zm-.2 2.9c-.3.4-.8.5-1.2.3-3-1.8-7.5-2.4-11-1.3-.4.1-.9-.1-1-.6-.1-.4.1-.9.6-1 4-1.2 9-.6 12.3 1.4.4.2.5.8.3 1.2zm-1.4 2.8c-.2.3-.6.4-1 .2-2.6-1.6-5.8-2-9.6-1.1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4.2-1 7.8-.5 10.7 1.3.3.1.4.6.2.9z"
      />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="#FF0000" />
      <polygon points="9.5,7.5 16.5,12 9.5,16.5" fill="#FFFFFF" />
    </svg>
  )
}

function SplitIcon() {
  const clipId = useId()
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>
      {/* Left half - Spotify */}
      <path d="M12 0 A12 12 0 0 0 12 24 Z" fill="#1DB954" />
      <g clipPath={`url(#${clipId})`}>
        <path
          fill="#FFFFFF"
          d="M17.9 10.9C14.3 8.8 8.3 8.6 4.9 9.6c-.6.2-1.1-.2-1.3-.7-.2-.6.2-1.1.7-1.3 4-1.2 10.5-1 14.7 1.5.5.3.7 1 .4 1.5-.3.5-1 .7-1.5.3zm-.2 2.9c-.3.4-.8.5-1.2.3-3-1.8-7.5-2.4-11-1.3-.4.1-.9-.1-1-.6-.1-.4.1-.9.6-1 4-1.2 9-.6 12.3 1.4.4.2.5.8.3 1.2zm-1.4 2.8c-.2.3-.6.4-1 .2-2.6-1.6-5.8-2-9.6-1.1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4.2-1 7.8-.5 10.7 1.3.3.1.4.6.2.9z"
        />
      </g>
      {/* Right half - YouTube */}
      <path d="M12 0 A12 12 0 0 1 12 24 Z" fill="#FF0000" />
      <polygon points="14,8 19.5,12 14,16" fill="#FFFFFF" />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="#666666" />
      <path
        fill="#FFFFFF"
        d="M11 5v7.586l-2.293-2.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L13 12.586V5a1 1 0 10-2 0z"
      />
      <path
        fill="#FFFFFF"
        d="M6 17a1 1 0 011-1h10a1 1 0 110 2H7a1 1 0 01-1-1z"
      />
    </svg>
  )
}

export default function SourceBadge({
  source,
  sources,
  size = 'sm',
  className = '',
}) {
  const sourceType = resolveSourceType(sources || source)
  if (!sourceType) return null

  const label = getSourceLabel(sourceType)
  const sizeClass = size === 'grid' ? 'source-badge-grid' : 'source-badge-list'

  return (
    <span
      className={`source-badge ${sizeClass} source-badge-${sourceType} ${className}`.trim()}
      title={label}
      aria-label={label}
      role="img"
      data-source={sourceType}
    >
      <span className="visually-hidden-accessible">{sourceType === 'split' ? 'spotify youtube' : sourceType}</span>
      {sourceType === 'spotify' && <SpotifyIcon />}
      {sourceType === 'youtube' && <YouTubeIcon />}
      {sourceType === 'split' && <SplitIcon />}
      {sourceType === 'import' && <ImportIcon />}
    </span>
  )
}
