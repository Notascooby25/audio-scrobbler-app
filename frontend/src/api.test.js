import { describe, expect, it, vi } from 'vitest'
import {
  fetchMonthlySummary,
  fetchRecentScrobbles,
  fetchUserCharts,
  fetchUserProfile,
  followUser,
  requestDevelopmentToken,
  searchUsers,
  unfollowUser,
} from './api'
import { requestSpotifyAuthorization } from './api'

describe('requestSpotifyAuthorization', () => {
  it('requests the backend authorization URL', async () => {
    const response = { ok: true, json: vi.fn().mockResolvedValue({ authorization_url: 'https://accounts.spotify.com/authorize' }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await requestSpotifyAuthorization()

    expect(fetch).toHaveBeenCalledWith('/auth/spotify/authorize')
  })
})

describe('requestDevelopmentToken', () => {
  it('requests a signed token for a development user', async () => {
    const response = { ok: true, json: vi.fn().mockResolvedValue({ access_token: 'demo-token' }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await requestDevelopmentToken('7')

    expect(fetch).toHaveBeenCalledWith('/auth/dev-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 7 }),
    })
  })
})

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

describe('fetchRecentScrobbles', () => {
  it('sends the bearer token and encoded pagination params', async () => {
    const response = { ok: true, json: vi.fn().mockResolvedValue({ scrobbles: [] }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await fetchRecentScrobbles({ token: 'demo token', limit: 10, offset: 5 })

    expect(fetch).toHaveBeenCalledWith('/analytics/recent-scrobbles?limit=10&offset=5', {
      headers: { Authorization: 'Bearer demo token' },
    })
  })
})

describe('followUser', () => {
  it('posts to the follow endpoint with the bearer token', async () => {
    const response = { ok: true, json: vi.fn().mockResolvedValue({ following: true, follower_count: 1 }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await followUser({ token: 'demo token', userId: 2 })

    expect(fetch).toHaveBeenCalledWith('/users/2/follow', {
      method: 'POST',
      headers: { Authorization: 'Bearer demo token' },
    })
  })
})

describe('unfollowUser', () => {
  it('sends a delete request to the follow endpoint', async () => {
    const response = { ok: true, json: vi.fn().mockResolvedValue({ following: false, follower_count: 0 }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await unfollowUser({ token: 'demo token', userId: 2 })

    expect(fetch).toHaveBeenCalledWith('/users/2/follow', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer demo token' },
    })
  })
})

describe('searchUsers', () => {
  it('sends the bearer token and encoded query', async () => {
    const response = { ok: true, json: vi.fn().mockResolvedValue({ results: [] }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await searchUsers({ token: 'demo token', query: 'music fan' })

    expect(fetch).toHaveBeenCalledWith('/users/search?q=music+fan', {
      headers: { Authorization: 'Bearer demo token' },
    })
  })
})

describe('fetchUserProfile', () => {
  it('requests the profile for the given user id', async () => {
    const response = { ok: true, json: vi.fn().mockResolvedValue({ id: 2 }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await fetchUserProfile({ token: 'demo token', userId: 2 })

    expect(fetch).toHaveBeenCalledWith('/users/2/profile', {
      headers: { Authorization: 'Bearer demo token' },
    })
  })
})

describe('fetchUserCharts', () => {
  it('sends the bearer token and encoded chart params', async () => {
    const response = { ok: true, json: vi.fn().mockResolvedValue({ entries: [] }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await fetchUserCharts({ token: 'demo token', userId: 2, entity: 'tracks', range: '1month', limit: 5 })

    expect(fetch).toHaveBeenCalledWith('/analytics/charts/2?entity=tracks&range=1month&limit=5', {
      headers: { Authorization: 'Bearer demo token' },
    })
  })
})