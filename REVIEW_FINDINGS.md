# Audio Scrobbler App - Review & Findings

This document outlines the findings from a full review of the Audio Scrobbler App, with a specific focus on its automated processes, architecture, and deployment strategy.

## 1. Application Architecture

The Audio Scrobbler App is a containerized, full-stack application composed of:
- **Frontend:** React application built with Vite, served as a Progressive Web App (PWA).
- **Backend:** Python FastAPI application handling business logic and API requests.
- **Worker:** A background Python worker for asynchronous tasks like polling Spotify and bulk data ingestion.
- **Database:** PostgreSQL for persistent storage, managed via Alembic for schema migrations.

The entire stack is orchestrated using Docker Compose (`docker-compose.yml` for local development, `docker-compose.prod.yml` for production).

## 2. Automated Publishing & Deployments (CI/CD)

The application utilizes a robust, pull-based deployment model that securely updates the production host without exposing it to incoming connections from GitHub.

*   **Continuous Integration (CI):** 
    *   GitHub Actions (`ci.yml`) automatically runs on every push and pull request.
    *   It executes backend/worker tests (`pytest`), frontend tests, and builds (`npm`).
    *   It validates Docker Compose configurations and verifies Prometheus/Alertmanager rules.
    *   It performs a **container smoke test**: spinning up the full stack (including the database and migrations) and asserting health check endpoints and metrics availability before passing.
*   **Automated Image Publishing:** 
    *   On a successful push to the `main` branch, the CI pipeline builds the Docker images for the frontend, backend, and worker.
    *   These images are published to the GitHub Container Registry (GHCR) tagged with both the commit SHA (`sha-<hash>`) and `latest`.
*   **Pull-Based Deployment (Watchtower):** 
    *   The production host runs a [Watchtower](https://containrrr.dev/watchtower/) container that polls GHCR at a set interval (default 300s).
    *   When Watchtower detects that the `latest` tag has been updated, it automatically pulls the new images and gracefully restarts the affected containers.
    *   **Result:** Merging to `main` automatically deploys to production without any direct SSH access from GitHub Actions.
*   **Rollbacks:** Rollbacks are handled manually by editing `.env.production` on the host to replace `IMAGE_TAG=latest` with a specific immutable `IMAGE_TAG=sha-<hash>`, bypassing Watchtower's automatic updates for the duration of the rollback.

## 3. Automated Backups & Verification

The backup system is decoupled from GitHub Actions (which cannot reach the host) and runs entirely on the deployment machine using a `systemd` user timer.

*   **Schedule:** A systemd timer (`audio-scrobbler-backup.timer`) triggers the backup process every 6 hours.
*   **Backup Generation:** `scripts/backup_database.sh` uses `pg_dump -Fc` to create a custom-format PostgreSQL dump.
*   **Automated Verification:** Before relying on a backup, `scripts/verify_database_backup.sh` restores the dump into a temporary, isolated database container and compares row counts (e.g., users, listening events) against the live database to ensure integrity.
*   **Offsite Storage:** Verified backups are automatically uploaded to an offsite location (Google Drive) using `rclone`.
*   **Retention Policies:** Local backups are automatically pruned after 3 days, while offsite backups in Google Drive are retained for 14 days.

## 4. Monitoring & Observability

The app includes a fully automated monitoring stack built in to the production compose file.

*   **Prometheus & Alertmanager:** Scrapes operational metrics from the backend, worker, and database.
*   **Backup Monitoring:** The backup scripts export their status to local `.prom` files, which are read by a Prometheus node-exporter. Alertmanager is configured to trigger critical alerts if a backup fails or if the last verified/uploaded backup becomes stale (older than 12 hours).

## 5. Automated Data Ingestion

The background worker handles automated data processing:
*   **Spotify Polling:** If enabled, the worker continuously polls connected Spotify accounts for new listening history in the background.
*   **Unattended File Ingestion:** The worker can watch a designated server directory (`WORKER_IMPORT_DIR`). If a user drops JSON history export files into this folder, the worker automatically parses, ingests, deduplicates, and moves them to a processed/failed folder on a scheduled interval.

## Summary

The Audio Scrobbler app is highly automated, resilient, and well-designed for a self-hosted environment. The "pull-based" Watchtower deployment pattern is an excellent choice for a server behind NAT, and the automated backup verification (restoring to a throwaway DB to check row counts before uploading) is a robust safeguard against silent data corruption.
