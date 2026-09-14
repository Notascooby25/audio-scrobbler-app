# Audio Scrobbler App: Overview, Features & Benefits

## What is the Audio Scrobbler App?

The Audio Scrobbler App is a comprehensive platform for tracking, analyzing, and sharing your music listening history. Similar to services like Last.fm, it ingests your "scrobbles" (records of tracks you've listened to) from various sources such as Spotify and YouTube, giving you deep insights into your listening habits over time. It provides a rich social experience, allowing you to follow friends and compare your top artists, albums, and tracks.

## Key Benefits

* **Own Your Data:** Instead of relying strictly on third-party services, this self-hosted or dedicated platform allows you to securely store and own your listening history.
* **Unified History:** Consolidate your music journey from multiple sources (Spotify, YouTube) into a single, cohesive timeline.
* **Deep Analytics:** Uncover your personal music trends with last.fm-style charts and analytics covering your top tracks, artists, and albums over different timeframes.
* **Social Discovery:** See what your friends are listening to, discover new music through their activity, and build a social network around music tastes.
* **Always Available:** Designed as a Progressive Web App (PWA) with a local-first mindset, allowing you to access the application quickly, even with poor network conditions.

## Core Features

### 1. Data Ingestion & Sync
* **Real-time Spotify Integration:** Opt-in automated polling fetches your latest Spotify listening history.
* **Historical Data Import:** Easily upload historical data exports (e.g., Spotify or YouTube JSON exports) directly from the dashboard to backfill your entire listening history.
* **Unattended File Import:** The background worker can automatically ingest files dropped into a designated server directory, perfect for automated sync jobs or bulk imports.
* **Robust Deduplication:** Smart deduplication logic prevents duplicate entries per user, track, and playback timestamp, even when importing from multiple overlapping sources.

### 2. Social Profiles
* **Public Usernames:** Unique profiles generated and deduplicated automatically.
* **Follow System:** Find and follow other users on the platform.
* **Privacy Controls:** Users can restrict their last-scrobbled track and detailed charts so only approved followers can see them.

### 3. Analytics & Charts
* **Personalized Charts:** Generate top charts for artists, tracks, and albums filtered by time range (7 days, 1 month, 12 months, or overall).
* **Monthly Summaries:** A dashboard view that breaks down listening habits periodically.

### 4. Modern Architecture & DevOps
* **Containerized Deployment:** Fully Dockerized stack using Docker Compose for both local development and production.
* **Automated CI/CD:** GitHub Actions workflows for running tests, validating code, and deploying to GitHub Container Registry (GHCR).
* **Automated Backups:** Built-in scripts and cron jobs to automatically back up the PostgreSQL database, verify backup integrity, and alert on failures.
* **Robust Monitoring:** Includes Prometheus and Alertmanager configurations for operational metrics (last sync timestamps, queue sizes, failure rates).

### 5. Progressive Web App (PWA)
* **Installable:** Can be installed to your device's home screen for an app-like experience.
* **Caching Shell:** A service worker caches the core app shell to ensure fast load times and reliable UI rendering before API requests complete.

## Technology Stack

* **Frontend:** React, Vite
* **Backend:** Python, FastAPI, SQLAlchemy, Alembic
* **Database:** PostgreSQL
* **Background Worker:** Python (for background data ingestion and syncing)
* **Infrastructure:** Docker, Docker Compose, GitHub Actions, Prometheus, Alertmanager

