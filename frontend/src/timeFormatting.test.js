import { describe, expect, it } from 'vitest'
import { formatScrobbleTime } from './timeFormatting'

describe('formatScrobbleTime', () => {
  const now = Date.parse('2026-09-10T12:00:00')

  it('uses Just now for events under a minute old', () => {
    expect(formatScrobbleTime('2026-09-10T11:59:30', now)).toBe('Just now')
  })

  it('uses minutes below one hour', () => {
    expect(formatScrobbleTime('2026-09-10T11:42:00', now)).toBe('18 minutes ago')
  })

  it('uses hours below 24 hours', () => {
    expect(formatScrobbleTime('2026-09-09T13:00:00', now)).toBe('23 hours ago')
  })

  it('uses a local date and time at 24 hours and older', () => {
    // Exact layout (day/month order, spacing) depends on the runtime's Intl
    // locale, which is deliberate (each viewer sees their own locale) and
    // differs between dev machines and CI runners — assert on content only.
    const result = formatScrobbleTime('2026-09-09T10:30:00', now)
    expect(result).toMatch(/sep/i)
    expect(result).toContain('9')
    expect(result).toMatch(/10:30\s*am/i)
  })

  it('always uses a date and time in absolute mode', () => {
    const result = formatScrobbleTime('2026-09-10T11:42:00', now, 'absolute')
    expect(result).toMatch(/sep/i)
    expect(result).toContain('10')
    expect(result).toMatch(/11:42\s*am/i)
  })
})
