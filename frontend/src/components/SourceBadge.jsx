import React, { useId } from 'react'

export function resolveSourceType(sourceOrSources) {
  if (!sourceOrSources) return null
  const list = Array.isArray(sourceOrSources)
    ? sourceOrSources.map((s) => String(s).toLowerCase().trim())
    : [String(sourceOrSources).toLowerCase().trim()]

  const hasSpotify = list.some((s) => s === 'spotify' || s === 'spotify_realtime' || s.startsWith('spotify'))
  const hasYoutube = list.some((s) => s === 'youtube' || s === 'youtube_music' || s === 'youtubemusic')
  const hasApple = list.some((s) => s === 'apple' || s === 'apple_music' || s === 'itunes')
  const hasBbc = list.some((s) => s === 'bbc_sounds' || s === 'bbc' || s.includes('bbc'))

  if (hasSpotify && hasYoutube) return 'split'
  if (hasSpotify) return 'spotify'
  if (hasYoutube) return 'youtube'
  if (hasApple) return 'apple'
  if (hasBbc) return 'bbc'
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
    case 'apple':
      return 'Scrobbled via Apple Music'
    case 'bbc':
      return 'Scrobbled via BBC Sounds'
    case 'import':
      return 'Imported scrobble'
    default:
      return 'Source'
  }
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="var(--color-spotify)" />
      <path
        fill="var(--color-surface)"
        d="M17.9 10.9C14.3 8.8 8.3 8.6 4.9 9.6c-.6.2-1.1-.2-1.3-.7-.2-.6.2-1.1.7-1.3 4-1.2 10.5-1 14.7 1.5.5.3.7 1 .4 1.5-.3.5-1 .7-1.5.3zm-.2 2.9c-.3.4-.8.5-1.2.3-3-1.8-7.5-2.4-11-1.3-.4.1-.9-.1-1-.6-.1-.4.1-.9.6-1 4-1.2 9-.6 12.3 1.4.4.2.5.8.3 1.2zm-1.4 2.8c-.2.3-.6.4-1 .2-2.6-1.6-5.8-2-9.6-1.1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4.2-1 7.8-.5 10.7 1.3.3.1.4.6.2.9z"
      />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="var(--color-youtube)" />
      <polygon points="9.5,7.5 16.5,12 9.5,16.5" fill="var(--color-surface)" />
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
      <path d="M12 0 A12 12 0 0 0 12 24 Z" fill="var(--color-spotify)" />
      <g clipPath={`url(#${clipId})`}>
        <path
          fill="var(--color-surface)"
          d="M17.9 10.9C14.3 8.8 8.3 8.6 4.9 9.6c-.6.2-1.1-.2-1.3-.7-.2-.6.2-1.1.7-1.3 4-1.2 10.5-1 14.7 1.5.5.3.7 1 .4 1.5-.3.5-1 .7-1.5.3zm-.2 2.9c-.3.4-.8.5-1.2.3-3-1.8-7.5-2.4-11-1.3-.4.1-.9-.1-1-.6-.1-.4.1-.9.6-1 4-1.2 9-.6 12.3 1.4.4.2.5.8.3 1.2zm-1.4 2.8c-.2.3-.6.4-1 .2-2.6-1.6-5.8-2-9.6-1.1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4.2-1 7.8-.5 10.7 1.3.3.1.4.6.2.9z"
        />
      </g>
      {/* Right half - YouTube */}
      <path d="M12 0 A12 12 0 0 1 12 24 Z" fill="var(--color-youtube)" />
      <polygon points="14,8 19.5,12 14,16" fill="var(--color-surface)" />
    </svg>
  )
}

function BbcSoundsIcon() {
  return (
    <svg viewBox="0 0 512 512" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="256" cy="256" r="256" fill="var(--color-bbc, #FA6400)" />
      <g transform="translate(6, 0)">
        <path fill="#ffffff" d="M122,304H78c-0.552,0-1.052-0.224-1.414-0.586S76,302.552,76,302v-92c0-0.552,0.224-1.052,0.586-1.414 S77.448,208,78,208h44c0.552,0,1.052,0.224,1.414,0.586S124,209.448,124,210v92c0,0.552-0.224,1.052-0.586,1.414 S122.552,304,122,304z" />
        <path fill="#ffffff" d="M230,376h-80c-0.552,0-1.052-0.224-1.414-0.586S148,374.552,148,374V138c0-0.552,0.224-1.052,0.586-1.414 S149.448,136,150,136h80c0.552,0,1.052,0.224,1.414,0.586S232,137.448,232,138v236c0,0.552-0.224,1.052-0.586,1.414 S230.552,376,230,376z" />
        <path fill="#ffffff" d="M422,424H258c-0.552,0-1.052-0.224-1.414-0.586S256,422.552,256,422V90c0-0.552,0.224-1.052,0.586-1.414 S257.448,88,258,88h164c0.552,0,1.052,0.224,1.414,0.586S424,89.448,424,90v332c0,0.552-0.224,1.052-0.586,1.414 S422.552,424,422,424z" />
      </g>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="var(--color-apple)" />
      <path
        fill="var(--color-surface)"
        d="M15.2 9.5c-.1-1.7 1.4-2.7 1.5-2.7-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.3 0-2.6.8-3.3 2.1-1.4 2.5-.4 6.2.9 8.2.7 1 1.4 2.1 2.5 2.1 1 0 1.5-.7 2.8-.7 1.2 0 1.7.7 2.8.7 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.4 1.2-2.4 0-.1-2.2-.9-2.3-3.6zM13.6 6.3c.6-.7 1-1.7.8-2.6-.8.1-1.9.6-2.5 1.3-.5.6-1 1.6-.8 2.5.9 0 1.9-.5 2.5-1.2z"
      />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="var(--color-muted)" />
      <path
        fill="var(--color-surface)"
        d="M11 5v7.586l-2.293-2.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L13 12.586V5a1 1 0 10-2 0z"
      />
      <path
        fill="var(--color-surface)"
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
      {sourceType === 'apple' && <AppleIcon />}
      {sourceType === 'split' && <SplitIcon />}
      {sourceType === 'bbc' && <BbcSoundsIcon />}
      {sourceType === 'import' && <ImportIcon />}
    </span>
  )
}
