const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function cleanSetlistUsername(input) {
  if (!input) return "";
  let cleaned = input.trim();
  if (cleaned.includes("setlist.fm/user/")) {
    cleaned = cleaned.split("setlist.fm/user/").pop();
  } else if (cleaned.includes("setlist.fm/attended/")) {
    cleaned = cleaned.split("setlist.fm/attended/").pop();
  } else if (cleaned.includes("setlist.fm/concerts/")) {
    cleaned = cleaned.split("setlist.fm/concerts/").pop();
  }
  cleaned = cleaned
    .replace(/^\/+|\/+$/g, "")
    .split("/")[0]
    .split("?")[0]
    .trim();
  return cleaned;
}

async function parseResponse(response) {
  if (!response.ok) {
    let detail = "";
    try {
      const parsed = await response.json();
      detail = parsed?.detail || parsed?.message || "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    // Structured details (e.g. the 409 "already_logged" payload) carry their own message
    const detailText = typeof detail === "string" ? detail : detail?.message || "";
    const message = detailText
      ? detailText.startsWith("HTTP")
        ? detailText
        : `HTTP ${response.status}: ${detailText}`
      : `Request failed with HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    if (text.includes("<!doctype") || text.includes("<html")) {
      throw new Error(
        "Received HTML instead of JSON from server. Please ensure the proxy is properly routing /setlists to the backend."
      );
    }
  }
  return response.json();
}

export async function fetchSetlistStatus({ token }) {
  const response = await fetch(`${API_BASE_URL}/setlists/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function searchSetlists({
  token,
  artistName,
  countryCode,
  year,
  month,
  venueName,
  setlistUrlOrId,
  p = 1,
}) {
  const params = new URLSearchParams();
  if (setlistUrlOrId) params.set("setlist_url_or_id", setlistUrlOrId);
  if (artistName) params.set("artist_name", artistName);
  if (countryCode) params.set("country_code", countryCode);
  if (year) params.set("year", year);
  if (month) params.set("month", month);
  if (venueName) params.set("venue_name", venueName);
  if (p) params.set("p", p);

  const response = await fetch(`${API_BASE_URL}/setlists/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function logManualConcert({
  token,
  artistName,
  venueName,
  city,
  country = "United Kingdom",
  eventDate,
  notes = null,
  setlistUrl = null,
  allowDuplicate = false,
}) {
  const response = await fetch(`${API_BASE_URL}/setlists/manual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      artist_name: artistName,
      venue_name: venueName,
      city,
      country,
      event_date: eventDate,
      ...(notes !== null ? { notes } : {}),
      ...(setlistUrl ? { setlist_url: setlistUrl } : {}),
      allow_duplicate: allowDuplicate,
    }),
  });
  return parseResponse(response);
}

/** The existing-gig details from a 409 "already logged" response, or null for other errors. */
export function alreadyLoggedInfo(err) {
  return err?.status === 409 && err?.detail?.code === "already_logged" ? err.detail : null;
}

export async function fetchVenueSupportActs({ token, venueId, eventDate, excludeSetlistId }) {
  const params = new URLSearchParams({ venue_id: venueId, event_date: eventDate });
  if (excludeSetlistId) params.set("exclude_setlist_id", excludeSetlistId);

  const response = await fetch(`${API_BASE_URL}/setlists/venue-support?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function logConcertAttendance({
  token,
  setlistId,
  supportSetlistIds = [],
  notes = null,
  allowDuplicate = false,
}) {
  const response = await fetch(`${API_BASE_URL}/setlists/attend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      setlist_id: setlistId,
      support_setlist_ids: supportSetlistIds,
      ...(notes !== null ? { notes } : {}),
      allow_duplicate: allowDuplicate,
    }),
  });
  return parseResponse(response);
}

export async function updateConcert({
  token,
  concertId,
  artistName,
  venueName,
  city = "",
  country = "",
  eventDate,
  tourName = null,
  allowDuplicate = false,
}) {
  const response = await fetch(`${API_BASE_URL}/setlists/${concertId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      artist_name: artistName,
      venue_name: venueName,
      city,
      country,
      event_date: eventDate,
      tour_name: tourName,
      allow_duplicate: allowDuplicate,
    }),
  });
  return parseResponse(response);
}

export async function updateConcertNotes({ token, concertId, notes }) {
  const response = await fetch(`${API_BASE_URL}/setlists/${concertId}/notes`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notes }),
  });
  return parseResponse(response);
}

export async function fetchSetlistDetail({ token, setlistId }) {
  const response = await fetch(`${API_BASE_URL}/setlists/setlist/${setlistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

// My Gigs pages through the list in the browser, so ask for every gig by default
export async function fetchAttendances({ token, limit = 2000, offset = 0 }) {
  const params = new URLSearchParams({ limit, offset });
  const response = await fetch(`${API_BASE_URL}/setlists/attendances?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchAttendance({ token, concertId }) {
  const response = await fetch(`${API_BASE_URL}/setlists/attendances/${concertId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchGigBill({ token, concertId }) {
  const response = await fetch(`${API_BASE_URL}/setlists/attendances/${concertId}/bill`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function logBillAct({ token, concertId, setlistId }) {
  const response = await fetch(`${API_BASE_URL}/setlists/attendances/${concertId}/bill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ setlist_id: setlistId }),
  });
  return parseResponse(response);
}

export async function deleteAttendance({ token, concertId, includeSupportActs = true }) {
  const params = new URLSearchParams({ include_support_acts: includeSupportActs });
  const response = await fetch(`${API_BASE_URL}/setlists/${concertId}?${params.toString()}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function refreshConcertSetlist({ token, concertId }) {
  const response = await fetch(`${API_BASE_URL}/setlists/${concertId}/refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchArtistsSeenLeaderboard({ token }) {
  const response = await fetch(`${API_BASE_URL}/setlists/stats/artists`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchSongsHeardLeaderboard({ token, limit = 1000 }) {
  const response = await fetch(`${API_BASE_URL}/setlists/stats/songs?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchVenuesVisitedLeaderboard({ token }) {
  const response = await fetch(`${API_BASE_URL}/setlists/stats/venues`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function previewSetlistsImport({ token, username, page = 1 }) {
  const cleanedUsername = cleanSetlistUsername(username);
  const params = new URLSearchParams({ username: cleanedUsername, page });
  const response = await fetch(`${API_BASE_URL}/setlists/import/preview?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchImportJob({ token }) {
  const response = await fetch(`${API_BASE_URL}/setlists/import/job`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function cancelImportJob({ token }) {
  const response = await fetch(`${API_BASE_URL}/setlists/import/job`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function importSetlistsFromFile({ token, format, content }) {
  const response = await fetch(`${API_BASE_URL}/setlists/import/file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ format, content }),
  });
  return parseResponse(response);
}

export async function importSetlistHistory({ token, username, setlistIds = null }) {
  const cleanedUsername = cleanSetlistUsername(username);
  const response = await fetch(`${API_BASE_URL}/setlists/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: cleanedUsername,
      ...(setlistIds ? { setlist_ids: setlistIds } : {}),
    }),
  });
  return parseResponse(response);
}

export async function fetchGigCompanions({ token, concertId }) {
  const response = await fetch(`${API_BASE_URL}/setlists/attendances/${concertId}/companions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function addGigCompanions({ token, concertId, friendIds }) {
  const response = await fetch(`${API_BASE_URL}/setlists/attendances/${concertId}/companions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ friend_ids: friendIds }),
  });
  return parseResponse(response);
}

export async function removeGigCompanion({ token, concertId, friendId }) {
  const response = await fetch(
    `${API_BASE_URL}/setlists/attendances/${concertId}/companions/${friendId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  return parseResponse(response);
}

export async function fetchGigInvites({ token }) {
  const response = await fetch(`${API_BASE_URL}/setlists/invites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function answerGigInvite({ token, inviteId, add }) {
  const response = await fetch(
    `${API_BASE_URL}/setlists/invites/${inviteId}/${add ? "add" : "dismiss"}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } }
  );
  return parseResponse(response);
}
