# Staging Live Test Report

Date: 2026-07-30

## Outcome

Production-like staging was **not run** because the local Docker daemon was unavailable, pgvector was not installed/available in PostgreSQL 16.13, and no provider credentials were supplied.

## Completed locally

- Backend unit: 40/40 suites, 186/186 tests.
- Backend PostgreSQL E2E (vector disabled): 13/13 suites, 63/63 tests.
- Prisma: 20 migrations, status current, diff empty.
- OCR: real bitmap recognition returned `QUESTION BANK 2026`, confidence 96.
- Admin: 8/8 tests, typecheck and production build pass.
- Flutter: 106/106 tests; APK and AAB generated.
- Compose syntax: valid with placeholder environment.

## Not executed

- Container image build/start/health.
- pgvector insert/search and HNSW execution.
- live provider or standalone mock-provider journey.
- scanned PDF through the complete queued pipeline.
- live SUPER_ADMIN CRUD journey.
- HTTPS/Nginx/Socket journey.
- restart/429/timeout/Redis failure drills.
- backup and isolated restore drill.

The deployment must remain blocked until the release gates in `final-platform-readiness-audit.md` are closed.