# Production Infrastructure Hardening Audit

Date: 2026-07-19
Status: COMPLETE_WITH_EXTERNAL_DOCKER_BUILD_LIMIT

## Implemented hardening

- Production configuration is fail-closed: PostgreSQL, strong JWT secrets, Redis and explicit non-wildcard CORS origins are required. Development/test retain explicit local behavior.
- Redis is the production cache/queue/lock backend, now also providing atomic distributed throttling. The in-memory implementation is limited to non-production.
- Socket.IO uses the official Redis adapter with dedicated pub/sub clients and the same environment-specific CORS allowlist.
- Helmet is configured with production HSTS and stable Swagger compatibility. Global DTO validation keeps transform, whitelist and forbidden-extra-field enforcement.
- HTTP responses receive validated/generated `x-request-id`; structured JSON request/error logs include request id, authenticated user id, status and latency without logging request bodies or tokens.
- Health exposes liveness plus PostgreSQL, Redis mode, process memory and uptime readiness data.
- Added multi-stage Docker targets for build, one-shot migrations and a non-root production runtime. Compose defines API, migration, PostgreSQL and Redis services with dependency health gates and persistent volumes.
- Added GitHub Actions with PostgreSQL/Redis services and install, format check, lint, unit, build, Prisma validate/deploy and full PostgreSQL E2E gates.

## Verification

- `npm run format:check`, lint and build: pass.
- Unit: 25 suites / 126 tests, all pass.
- PostgreSQL E2E: 13 suites / 63 tests, all pass.
- Prisma: schema valid; 17 migrations applied/current; diff empty.
- Runtime: Health, Swagger UI and Swagger JSON returned HTTP 200 on port 3100. Health returned database connected, Redis development-memory mode and memory metrics; response headers included request id and Helmet nosniff.
- `docker compose config --quiet`: pass with required secrets supplied.
- `npm audit --omit=dev --audit-level=high`: exit 0; no high/critical findings.

## External verification limit

The Docker image could not be built on this workstation because Docker Desktop's Linux daemon was stopped. The service exists but Windows denied starting/opening it even after the approved elevated attempt. Dockerfile/Compose syntax was validated, but an actual image build/run remains a deployment-environment check.

## Security advisories and honest limits

- npm reports nine moderate transitive advisories in the installed tree. The production-relevant Firebase chain has no non-breaking automated resolution; `npm audit fix --force` would downgrade Firebase Admin incompatibly and was intentionally not used. Prisma CLI is isolated to the migration/dev target and omitted from runtime dependencies.
- Live FCM and multi-instance Redis/Socket.IO behavior require deployment credentials/services and are not exercised locally. CI is configured with real Redis and PostgreSQL services.
- Notification delivery retry scheduling, metrics export/APM and centralized log shipping remain operational platform work.
- A pg deprecation warning appears in a concurrency E2E path and should be removed before upgrading to pg 9.