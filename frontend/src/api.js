const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export async function fetchMonthlySummary({ token, fromMonth, toMonth }) {
  const params = new URLSearchParams()
  if (fromMonth) params.set('from_month', fromMonth)
  if (toMonth) params.set('to_month', toMonth)

  const query = params.toString()
  const response = await fetch(`${API_BASE_URL}/analytics/monthly-summary${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail || `Analytics request failed (${response.status})`)
  }

  return response.json()
}