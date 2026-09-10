import { toQueryParams } from './dateRange'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function parseResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const error = new Error(body?.detail || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return response.json()
}

export async function requestDevelopmentToken(userId) {
  const response = await fetch(`${API_BASE_URL}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: Number(userId) }),
  })
  return parseResponse(response)
}

export async function requestSpotifyAuthorization() {
  const response = await fetch(`${API_BASE_URL}/auth/spotify/authorize`)
  return parseResponse(response)
}

export function redirectToAuthorization(url) {
  window.location.assign(url)
}

export async function fetchMonthlySummary({ token, fromMonth, toMonth }) {
  const params = new URLSearchParams()
  if (fromMonth) params.set('from_month', fromMonth)
  if (toMonth) params.set('to_month', toMonth)

  const query = params.toString()
  const response = await fetch(`${API_BASE_URL}/analytics/monthly-summary${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseResponse(response)
}

export async function fetchRecentScrobbles({ token, limit, offset }) {
  const params = new URLSearchParams()
  if (limit) params.set('limit', limit)
  if (offset) params.set('offset', offset)

  const query = params.toString()
  const response = await fetch(`${API_BASE_URL}/analytics/recent-scrobbles${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseResponse(response)
}

export async function submitImportScrobbles({ token, source, entries }) {
  const response = await fetch(`${API_BASE_URL}/import/scrobbles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ source, entries }),
  })
  return parseResponse(response)
}

export async function followUser({ token, userId }) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseResponse(response)
}

export async function unfollowUser({ token, userId }) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/follow`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseResponse(response)
}

export async function searchUsers({ token, query }) {
  const params = new URLSearchParams({ q: query })
  const response = await fetch(`${API_BASE_URL}/users/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseResponse(response)
}

export async function fetchUserProfile({ token, userId }) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseResponse(response)
}

export async function fetchUserCharts({ token, userId, entity, range, limit }) {
  const params = new URLSearchParams()
  if (entity) params.set('entity', entity)
  if (range) params.set('range', range)
  if (limit) params.set('limit', limit)

  const query = params.toString()
  const response = await fetch(`${API_BASE_URL}/analytics/charts/${userId}${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseResponse(response)
}

async function fetchAnalyticsResource(path, { token, method = 'GET', params = {}, body } = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const response = await fetch(`${API_BASE_URL}${path}${suffix}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return parseResponse(response)
}

export function fetchStatsSummary({ token }) {
  return fetchAnalyticsResource('/stats/summary', { token })
}

export function fetchStatsChart({ token, entity, limit, dateRange }) {
  const params = { limit, ...(dateRange ? toQueryParams(dateRange) : {}) }
  return fetchAnalyticsResource(`/stats/top-${entity}`, { token, params })
}

export function fetchLibraryCollection({ token, entity, limit, offset, dateRange }) {
  const params = { limit, offset, ...(dateRange ? toQueryParams(dateRange) : {}) }
  return fetchAnalyticsResource(`/library/${entity}`, { token, params })
}

export function fetchLibraryScrobbles({ token, limit, offset, dateRange }) {
  return fetchLibraryCollection({ token, entity: 'scrobbles', limit, offset, dateRange })
}

export function fetchLibraryTimeline({ token }) {
  return fetchAnalyticsResource('/library/timeline', { token })
}

export function fetchReportsSummary({ token, dateRange }) {
  const params = dateRange ? toQueryParams(dateRange) : {}
  return fetchAnalyticsResource('/reports/summary', { token, params })
}

export function fetchReportsCharts({ token, dateRange }) {
  const params = dateRange ? toQueryParams(dateRange) : {}
  return fetchAnalyticsResource('/reports/charts', { token, params })
}

export function fetchReportsEntity({ token, entity, dateRange }) {
  const params = dateRange ? toQueryParams(dateRange) : {}
  return fetchAnalyticsResource(`/reports/${entity}`, { token, params })
}

export function syncLikedTracks({ token }) {
  return fetchAnalyticsResource('/spotify/sync-liked-tracks', { token })
}

export function likeSpotifyTrack({ token, trackId }) {
  return fetchAnalyticsResource(`/spotify/tracks/${encodeURIComponent(trackId)}/like`, { token, method: 'PUT' })
}

export function unlikeSpotifyTrack({ token, trackId }) {
  return fetchAnalyticsResource(`/spotify/tracks/${encodeURIComponent(trackId)}/like`, { token, method: 'DELETE' })
}

export function backfillArtwork({ token }) {
  return fetchAnalyticsResource('/spotify/backfill-artwork', { token })
}

export function fetchLikedTracks({ token, limit, offset }) {
  return fetchAnalyticsResource('/spotify/liked-tracks', { token, params: { limit, offset } })
}

export function fetchUserSettings({ token }) {
  return fetchAnalyticsResource('/users/me/settings', { token })
}

export function updateUserSettings({ token, changes }) {
  return fetchAnalyticsResource('/users/me/settings', { token, method: 'PATCH', body: changes })
}

export function fetchBlocks({ token }) {
  return fetchAnalyticsResource('/users/me/blocks', { token })
}

export function createBlock({ token, entityType, name }) {
  return fetchAnalyticsResource('/users/me/blocks', { token, method: 'POST', body: { entity_type: entityType, name } })
}

export async function removeBlock({ token, blockId }) {
  const response = await fetch(`${API_BASE_URL}/users/me/blocks/${blockId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
}

export function deleteLibraryEntries({ token, entityType, name, secondary }) {
  return fetchAnalyticsResource('/library/delete-entries', { token, method: 'POST', body: { entity_type: entityType, name, secondary } })
}