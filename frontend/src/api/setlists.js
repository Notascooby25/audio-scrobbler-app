const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function parseResponse(response) {
  if (!response.ok) {
    let detail = "";
    try {
      const parsed = await response.json();
      detail = parsed?.detail || parsed?.message || "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    const message = detail
      ? `HTTP ${response.status}: ${detail}`
      : `Request failed with HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response.json();
}

export async function searchSetlists({ token, artistName, countryCode, year, venueName, p = 1 }) {
  const params = new URLSearchParams();
  if (artistName) params.set("artist_name", artistName);
  if (countryCode) params.set("country_code", countryCode);
  if (year) params.set("year", year);
  if (venueName) params.set("venue_name", venueName);
  if (p) params.set("p", p);

  const response = await fetch(`${API_BASE_URL}/api/setlists/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchVenueSupportActs({ token, venueId, eventDate, excludeSetlistId }) {
  const params = new URLSearchParams({ venue_id: venueId, event_date: eventDate });
  if (excludeSetlistId) params.set("exclude_setlist_id", excludeSetlistId);

  const response = await fetch(`${API_BASE_URL}/api/setlists/venue-support?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function logConcertAttendance({ token, setlistId, supportSetlistIds = [] }) {
  const response = await fetch(`${API_BASE_URL}/api/setlists/attend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      setlist_id: setlistId,
      support_setlist_ids: supportSetlistIds,
    }),
  });
  return parseResponse(response);
}

export async function fetchAttendances({ token, limit = 50, offset = 0 }) {
  const params = new URLSearchParams({ limit, offset });
  const response = await fetch(`${API_BASE_URL}/api/setlists/attendances?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function deleteAttendance({ token, concertId, includeSupportActs = true }) {
  const params = new URLSearchParams({ include_support_acts: includeSupportActs });
  const response = await fetch(`${API_BASE_URL}/api/setlists/${concertId}?${params.toString()}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function refreshConcertSetlist({ token, concertId }) {
  const response = await fetch(`${API_BASE_URL}/api/setlists/${concertId}/refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchArtistsSeenLeaderboard({ token }) {
  const response = await fetch(`${API_BASE_URL}/api/setlists/stats/artists`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchSongsHeardLeaderboard({ token, limit = 100 }) {
  const response = await fetch(`${API_BASE_URL}/api/setlists/stats/songs?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchVenuesVisitedLeaderboard({ token }) {
  const response = await fetch(`${API_BASE_URL}/api/setlists/stats/venues`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function previewSetlistsImport({ token, username, page = 1 }) {
  const params = new URLSearchParams({ username, page });
  const response = await fetch(`${API_BASE_URL}/api/setlists/import/preview?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function importSetlistHistory({ token, username, setlistIds = null }) {
  const response = await fetch(`${API_BASE_URL}/api/setlists/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username,
      ...(setlistIds ? { setlist_ids: setlistIds } : {}),
    }),
  });
  return parseResponse(response);
}
