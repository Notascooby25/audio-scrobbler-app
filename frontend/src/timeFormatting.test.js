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
    expect(formatScrobbleTime('2026-09-09T10:30:00', now)).toMatch(/9 Sep(?:t)?\.?[,]? 10:30 am/)
  })

  it('always uses a date and time in absolute mode', () => {
    expect(formatScrobbleTime('2026-09-10T11:42:00', now, 'absolute')).toMatch(/10 Sep(?:t)?\.?[,]? 11:42 am/)
  })
})
