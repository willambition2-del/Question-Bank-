# VPS deployment guide

1. Install a supported Docker Engine and Compose plugin; open only 80/443.
2. Clone the three projects under one workspace matching the production
   compose build contexts.
3. Copy `.env.production.example` to `.env.production`, inject generated
   secrets outside Git, and place TLS files at `ops/certs/fullchain.pem` and
   `ops/certs/privkey.pem`.
4. Review `docker compose --env-file .env.production -f
   docker-compose.production.yml config` output without printing secrets.
5. Pull/build, run the one-shot migration, then start PostgreSQL, Redis, API,
   worker, admin and Nginx.
6. Verify `/api/v1/health`, migration status, queue processing, admin login,
   vector extension/table, OCR language cache and one controlled provider task.
7. Enable intelligent routes gradually and monitor failures/cost.

The current workstation cannot start Docker (`com.docker.service` is
inaccessible), so Compose syntax was validated but its images were not built
or run here. This is an explicit deployment gate.

## Question import phase (2026-07-30)

A pre-import custom-format database backup and checksum were captured. The canonical source is audited SQLite; direct SQL restore is prohibited. New staging migrations and a read-only dry-run pipeline are documented in `question-import-architecture.md`. Final import is blocked pending review of `question-data-quality-report.md`.