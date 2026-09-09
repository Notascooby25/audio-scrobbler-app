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