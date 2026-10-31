# Differential Security Review: Spotify Scope Alignment & Reconnect UX (v0.30.1)

**Date:** 2026-10-31  
**Target:** Changes for Spotify two-way like reconnect and scope alignment  
**Reviewer:** Pair Programming AI Assistant (differential-review skill)  

---

## 1. Executive Summary

This differential security review assesses the updates in v0.30.1:
1. Addition of `user-library-modify` to default scope fallbacks in `docker-compose.yml` and `docker-compose.prod.yml`.
2. Enhanced logging in `_call_user_spotify` and structured JSON payload handling in `toggle_like_track` and `toggle_like_album`.
3. Actionable 1-click **Reconnect Spotify** buttons in `SettingsPage.jsx`, `LibraryPage.jsx`, `OverviewPage.jsx`, and `HomePage.jsx`.
4. Normalization of `LikedHeart.jsx` prop signatures and bumping version to 0.30.1.

**Verdict:** **PASSED — LOW RISK / NO VULNERABILITIES IDENTIFIED**

All OAuth flows continue to use CSRF-protected state parameters signed with JWT (`validate_oauth_state`), redirect URLs are validated against `settings.spotify_redirect_uri`, and Spotify tokens remain AES-encrypted at rest.

---

## 2. Risk Classification & Blast Radius

| Component | Files Changed | Risk Level | Blast Radius | Notes |
|---|---|---|---|---|
| Docker Configuration | `docker-compose.yml`, `docker-compose.prod.yml` | LOW | Low | Added standard `user-library-modify` to default scope strings |
| Backend Spotify Service | `backend/app/services/spotify_library_service.py` | LOW | Low | Added warning logging on HTTP errors; passes explicit JSON body |
| Backend Tests | `backend/app/tests/test_spotify_library_likes.py` | LOW | Low | Validates payload delivery and mocked error handling |
| Frontend UX & Reconnect | `frontend/src/pages/*`, `frontend/src/components/LikedHeart.jsx` | LOW | Low | 1-click OAuth initiation using standard `requestSpotifyAuthorization(true)` |
| Metadata & Versioning | `frontend/package.json`, `frontend/src/changelogData.js` | LOW | None | Bump to v0.30.1 |

---

## 3. Security Findings by Category

### 3.1 OAuth & State Validation
- **Finding:** Initiating Spotify authorization via `requestSpotifyAuthorization(true)` generates a fresh short-lived HMAC-SHA256 JWT state parameter expiring in 10 minutes (`create_oauth_state()`).
- **CSRF Defense:** The callback strictly validates the state against `settings.jwt_secret` before exchanging the authorization code.
- **Severity:** Informational / Verified.

### 3.2 Information Disclosure & Logging
- **Finding:** Added error logging in `_call_user_spotify` logs `resp.status_code` and `resp.text`.
- **Sensitive Data Exposure Check:** Verified that Spotify API error responses for `/v1/me/tracks` and `/v1/me/albums` return standard error objects (e.g. `{"error": {"status": 403, "message": "Insufficient client scope"}}`) and do not echo back user refresh tokens, access tokens, or sensitive client secrets.
- **Severity:** Informational / Verified.

### 3.3 Session Storage & Redirection Safety
- **Finding:** The return URL after Spotify re-authorization is stored in `sessionStorage.setItem("spotify_auth_return_to", ...)`.
- **Open Redirect Defense:** The stored paths are constrained to relative URLs (`window.location.pathname + window.location.search` or `/settings?tab=scrobble`), eliminating open redirect risks.
- **Severity:** Informational / Verified.

---

## 4. Verification Evidence

- **Frontend Linter & Build:**
  - `cd frontend && npm run lint` passed with 0 errors.
  - `cd frontend && npm test` passed (58 test files, 337 tests passing).
  - `cd frontend && npm run build` succeeded.
- **Backend Lint & Tests:**
  - `ruff check backend/app worker scripts` passed with 0 errors.
  - `ruff format --check backend/app/services/spotify_library_service.py backend/app/tests/test_spotify_library_likes.py` passed.
  - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q` passed (392 passed, 13 skipped, 0 failures).
