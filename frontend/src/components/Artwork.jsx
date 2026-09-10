import { useState } from 'react'

function initials(label = '') {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?'
}

export default function Artwork({ src, label, className = '', sizes }) {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed

  return showImage ? (
    <img
      className={`artwork ${className}`}
      src={src}
      alt={`${label || 'Artwork'} artwork`}
      sizes={sizes}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={`artwork artwork-fallback ${className}`} role="img" aria-label={`${label || 'Artwork'} artwork unavailable`}>
      {initials(label)}
    </span>
  )
}
