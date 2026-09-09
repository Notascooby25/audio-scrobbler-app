import { describe, expect, it, vi } from 'vitest'
import { fetchMonthlySummary } from './api'

describe('fetchMonthlySummary', () => {
  it('sends the bearer token and encoded month filters', async () => {
    const response = { ok: true, json: vi.fn().mockResolvedValue({ total_months: 0 }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await fetchMonthlySummary({ token: 'demo token', fromMonth: '2026-01', toMonth: '2026-03' })

    expect(fetch).toHaveBeenCalledWith('/analytics/monthly-summary?from_month=2026-01&to_month=2026-03', {
      headers: { Authorization: 'Bearer demo token' },
    })
  })

  it('surfaces the API error detail', async () => {
    const response = {
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ detail: 'from_month must be earlier than or equal to to_month' }),
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await expect(fetchMonthlySummary({ token: 'demo token' })).rejects.toThrow(
      'from_month must be earlier than or equal to to_month',
    )
  })
})