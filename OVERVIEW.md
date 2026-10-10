# Audio Scrobbler App: Overview, Features & Benefits

## What is the Audio Scrobbler App?

The Audio Scrobbler App is a comprehensive platform for tracking, analyzing, and sharing your music listening history. Similar to services like Last.fm, it ingests your "scrobbles" (records of tracks you've listened to) from sources such as Spotify, YouTube, Apple Music, and BBC Sounds, giving you deep insights into your listening habits over time. It provides a rich social experience, allowing you to follow friends and compare your top artists, albums, tracks, and genres.

## Key Benefits

* **Own Your Data:** Instead of relying strictly on third-party services, this self-hosted or dedicated platform allows you to securely store and own your listening history.
* **Unified History:** Consolidate your music journey from multiple sources (Spotify, YouTube, Apple Music, and BBC Sounds) into a single, cohesive timeline.
* **Deep Analytics:** Uncover your personal music trends with last.fm-style charts and analytics covering your top tracks, artists, albums, and genres over different timeframes.
* **Social Discovery:** See what your friends are listening to, discover new music through their activity, and build a social network around music tastes.
* **Always Available:** Designed as a Progressive Web App (PWA) with a local-first mindset, allowing you to access the application quickly, even with poor network conditions.

## Core Features

### 1. Data Ingestion & Sync
* **Real-time Spotify Integration:** Opt-in automated polling fetches your latest Spotify listening history, currently-playing state, and liked songs.
* **Historical Data Import:** Easily upload historical data exports (Spotify, YouTube, or Apple Music JSON exports) with real-time Server-Sent Events (SSE) progress streaming and automatic iTunes/Deezer artwork resolution.
* **BBC Sounds ("Scope Creep") & Followed Shows:** Follow BBC radio programmes, browse recent episodes, extract broadcast tracklists via the BBC RMS API, scrobble tracks directly, or export them to a new or existing Spotify playlist.
* **Unattended File Import:** The background worker can automatically ingest files dropped into a designated server directory, perfect for automated sync jobs or bulk imports.
* **Robust Deduplication:** Smart deduplication logic prevents duplicate entries per user, track, and playback timestamp, even when importing from multiple overlapping sources.

### 2. Social Profiles
* **Public Usernames:** Unique profiles generated and deduplicated automatically.
* **Follow System:** Find and follow other users on the platform.
* **Privacy Controls:** Users can restrict their last-scrobbled track and detailed charts so only approved followers can see them.

### 3. Analytics, Charts & Recaps
* **Personalized Charts:** Generate top charts for artists, tracks, albums, and genres filtered by time range (7 days, 1 month, 12 months, overall, or custom dates), alongside listening heatmaps and clock charts.
* **Automated Recaps & Push Notifications:** Receive daily, weekly, or monthly listening recaps via the in-app notification bell and browser/PWA Web Push notifications.

### 4. Modern Architecture & DevOps
* **Containerized Deployment:** Fully Dockerized stack using Docker Compose for both local development and production.
* **Automated CI/CD:** GitHub Actions workflows for running tests, validating code, and deploying to GitHub Container Registry (GHCR).
* **Automated Backups:** Built-in scripts and cron jobs to automatically back up the PostgreSQL database, verify backup integrity, and alert on failures.
* **Robust Monitoring:** Includes Prometheus and Alertmanager configurations for operational metrics (last sync timestamps, queue sizes, failure rates).

### 5. Progressive Web App (PWA)
* **Installable:** Can be installed to your device's home screen for an app-like experience.
* **Caching Shell & Web Push:** A service worker caches the core app shell for fast load times and handles incoming Web Push notifications.

## Technology Stack

* **Frontend:** React, Vite
* **Backend:** Python, FastAPI, SQLAlchemy, Alembic
* **Database:** PostgreSQL
* **Background Worker:** Python (for background data ingestion and syncing)
* **Infrastructure:** Docker, Docker Compose, GitHub Actions, Prometheus, Alertmanager

