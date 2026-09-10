const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

export function formatScrobbleTime(value, now = Date.now(), mode = 'relative') {
  const timestamp = new Date(value).getTime()
  const elapsed = Math.max(0, now - timestamp)

  if (mode === 'relative' && elapsed < MINUTE_MS) return 'Just now'
  if (mode === 'relative' && elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} minute${Math.floor(elapsed / MINUTE_MS) === 1 ? '' : 's'} ago`
  if (mode === 'relative' && elapsed < 24 * HOUR_MS) {
    const hours = Math.floor(elapsed / HOUR_MS)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
    month: 'short',
  }).format(new Date(timestamp)).replace(' AM', 'am').replace(' PM', 'pm')
}
