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
  return response.status === 204 ? null : response.json();
}

export function fetchWrapped({ token }) {
  return wrappedRequest("/wrapped", { token });
}

export function fetchWrappedYear({ token, year }) {
  return wrappedRequest(`/wrapped/${encodeURIComponent(year)}`, { token });
}

export function markWrappedSeen({ token, year }) {
  return wrappedRequest(`/wrapped/${encodeURIComponent(year)}/seen`, { token, method: "POST" });
}

export function dismissWrapped({ token, year }) {
  return wrappedRequest(`/wrapped/${encodeURIComponent(year)}/dismiss`, {
    token,
    method: "POST",
  });
}
