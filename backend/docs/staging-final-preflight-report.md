# Staging final preflight report

Date: 2026-08-02
Overall status: **WAITING_FOR_PROVIDER_CREDENTIALS / STAGING RUNTIME NOT VERIFIED**

The implementation is not declared fully staging-ready. Code gates passed where locally runnable, but Docker image pulls/builds stalled until the 10- and 15-minute timeouts before any image or container was created. No provider credentials exist in the current database, so no live student AI request was attempted.

1. **Scope:** only `question-bank-api`, `admin-dashboard`, and read-only verification of `app_app` were used.
2. **Question data safety:** no import, update, deletion, reset, `db push`, or source SQLite operation was executed.
3. **Protected audit file:** `docs/student-progress-hardening-audit.md` remains a pre-existing user modification and is excluded from commits.
4. **Backend branch:** `production-intelligent-platform`.
5. **Admin branch:** `admin-production-intelligent-platform`.
6. **Flutter branch:** `flutter-production-intelligent-platform`; no Flutter change was made.
7. **Node policy:** Backend and Admin now pin Node.js `22.17.1` in `engines`, `.nvmrc`, Dockerfiles, and Backend CI.
8. **Backend formatting:** `npm run format:check` passes.
9. **Backend lint:** `npm run lint` passes after the new onboarding tests were corrected.
10. **Backend build:** `npm run build` passes.
11. **Backend unit tests:** 44 suites and 213 tests pass.
12. **Backend targeted security tests:** credential encryption, SSRF protection, secret non-disclosure, discovery, and readiness: 3 suites / 10 tests pass.
13. **Backend E2E baseline:** the previous immediately preceding verification passed 13 suites / 63 tests; the current rerun was blocked before Jest because Prisma attempted a network binary checksum through a denied proxy.
14. **Admin lint:** passes with 0 errors and 45 pre-existing warnings.
15. **Admin TypeScript:** `npx tsc --noEmit` passes.
16. **Admin tests:** new wizard/status coverage is present; Vitest execution is blocked locally by Windows sandbox `spawn EPERM`.
17. **Admin production build:** source compilation/type checking passes; Next production build is blocked locally by the same `spawn EPERM`.
18. **Next configuration:** the conflicting config that skipped type checking was removed; `next.config.ts` is authoritative and enables standalone output.
19. **Flutter configuration:** release API URL remains supplied only through `--dart-define=API_BASE_URL`; release rejects non-HTTPS URLs.
20. **Flutter auth:** traditional and Google authentication code was not changed.
21. **Flutter verification:** `flutter analyze --no-pub` timed out without output; no APK success is claimed.
22. **Question count:** 19,862.
23. **Option count:** 42,070.
24. **Source-reference count:** 19,841.
25. **Import jobs:** 1.
26. **Import result:** `COMPLETED_WITH_WARNINGS`, imported 19,841, failed 0.
27. **Prisma baseline:** 24 migrations/no drift was verified in the preceding project phase; the current retry was blocked because Prisma attempted a network binary checksum through a denied proxy.
28. **pgvector design:** staging uses `pgvector/pgvector:pg16`; the existing migration creates the extension and vector table.
29. **pgvector runtime:** not claimed; no staging PostgreSQL container was created before Docker timeout.
30. **Redis:** staging Compose includes Redis 7.4 with AOF, password, health check, and a distinct staging volume.
31. **Worker reliability:** BullMQ retains deterministic job IDs, three attempts, exponential backoff, distributed locking, and graceful shutdown.
32. **Queue observability:** the protected readiness endpoint now reports configured mode and waiting/active/delayed/failed/completed depth.
33. **Provider discovery:** a protected endpoint exposes adapter model discovery, normalized/deduplicated and limited to 500 identifiers.
34. **Provider secrets:** responses expose only configured/masked state; discovery/readiness never return ciphertext or plaintext.
35. **SSRF:** provider URLs continue to reject credentials in URLs, unsafe protocols, redirects, and private/link-local networks in production.
36. **Setup wizard:** `/intelligent-services/setup` is available after SUPER_ADMIN-only login and guides provider, discovery/manual model, live test, safe routes, and readiness.
37. **Safe activation:** routes are not created until the model test succeeds; untested capabilities are not inferred.
38. **Platform status:** `/platform-status` shows providers, models/routes, pgvector, queue depth, and release blockers with 30-second refresh.
39. **Knowledge base:** existing document upload/reprocess/archive/test-search and embedding pipeline were preserved; no document was fabricated.
40. **Compose:** `docker compose config --quiet` passes for the new isolated staging definition; actual build/up/ps/restart remains unverified after timeouts.
41. **Backups/restore:** no new backup or isolated restore is claimed because the staging PostgreSQL container never started and local `pg_dump` tools are unavailable.
42. **Release decision:** remain at `WAITING_FOR_PROVIDER_CREDENTIALS`. Owner input required after Docker registry/build access is restored: provider Base URL, API key, and model IDs only when discovery returns none.

## Required next live gate

Run `deploy/start-staging.ps1` (Windows) or `deploy/start-staging.sh` (Linux) on a host that can pull Docker images. Then restore a fresh dump into the isolated staging volume, recheck counts and pgvector, sign in as the existing SUPER_ADMIN, open `/intelligent-services/setup`, enter owner credentials, run provider/model tests, and only then execute student chat/image/RAG live tests.
