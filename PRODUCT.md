# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Music enthusiasts and self-hosters wanting full ownership of their listening data and unified cross-platform analytics.

## Product Purpose
A self-hosted platform to track, analyze, and share music listening history. It consolidates "scrobbles" from sources like Spotify and YouTube into a single, cohesive timeline, offering deep insights and social features.

## Positioning
Unlike third-party services like Last.fm, this application empowers users to securely store and fully own their listening history, while seamlessly merging data from distinct sources into one unified platform.

## Operating Context
Deployed as a self-hosted containerized stack via Docker Compose on personal servers or VPS environments. Users access the service primarily through a Progressive Web App (PWA) available on both desktop and mobile devices.

## Capabilities and Constraints
- **Data Ingestion:** Real-time Spotify polling and historical file imports (Spotify/YouTube JSON).
- **Deduplication:** Smart logic prevents duplicate entries per user, track, and playback timestamp across overlapping sources.
- **Social Features:** Public profiles, follow systems, privacy controls, and personalized top charts.
- **Infrastructure:** Built-in monitoring (Prometheus/Alertmanager) and automated PostgreSQL backups.
- **Performance:** Progressive Web App (PWA) with a caching shell for fast, reliable loading.

## Evidence on Hand
- Functioning Docker Compose deployment for frontend (React), backend (FastAPI), and ingestion worker.
- Existing GitHub Actions CI/CD workflows and automated backup scripts.

## Product Principles
- **Data Sovereignty:** The user must always maintain complete ownership and control of their listening data.
- **Unified History:** Disparate data sources should blend smoothly into a single, understandable music journey.
- **Resilient Operation:** The platform should be robust, highly available, and prioritize a local-first user experience.

