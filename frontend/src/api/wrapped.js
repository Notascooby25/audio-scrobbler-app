const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function wrappedRequest(path, { token, method = "GET" } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = new Error(`Request failed with HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    // Read the (empty) body anyway: leaving it unread makes the browser report the request as aborted.
    await response.text();
    return null;
  }
  return response.json();
}

export function fetchWrapped({ token }) {
  return wrappedRequest("/year-reviews", { token });
}

export function fetchWrappedYear({ token, year }) {
  return wrappedRequest(`/year-reviews/${encodeURIComponent(year)}`, { token });
}

export function markWrappedSeen({ token, year }) {
  return wrappedRequest(`/year-reviews/${encodeURIComponent(year)}/seen`, {
    token,
    method: "POST",
  });
}

export function dismissWrapped({ token, year }) {
  return wrappedRequest(`/year-reviews/${encodeURIComponent(year)}/dismiss`, {
    token,
    method: "POST",
  });
}
