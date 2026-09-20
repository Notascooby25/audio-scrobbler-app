from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite://")

# backend/app/config.py calls load_dotenv() on the repo-root .env at import
# time, so a developer's real .env otherwise decides how these tests behave:
# a real JWT_SECRET makes the placeholder-rejection test raise on a different
# variable, and a set FRONTEND_AUTH_CALLBACK_URL turns the OAuth-denial 400
# into a redirect the test client follows to a non-route (404). CI has no
# .env, so the suite passed there and failed only on developer machines.
#
# load_dotenv() defaults to override=False, so pinning the values here — and
# this file is imported before any test module pulls in the config — makes the
# suite hermetic regardless of what is in .env.
for _key, _value in {
    "APP_ENV": "development",
    "JWT_SECRET": "dev-secret-change-me",
    "REFRESH_TOKEN_KEY": "0123456789abcdef0123456789abcdef",
    "WORKER_INGESTION_TOKEN": "dev-worker-token",
    "FRONTEND_AUTH_CALLBACK_URL": "",
    "ALLOWED_SPOTIFY_USER_IDS": "",
    "SPOTIFY_CLIENT_ID": "",
    "SPOTIFY_CLIENT_SECRET": "",
}.items():
    os.environ.setdefault(_key, _value)
