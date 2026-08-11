# Full platform pre-deployment audit

Audit date: 2026-07-30.

## Repositories and lineage

| Project | Path | Audited source branch | Starting commit | Final integration branch |
| --- | --- | --- | --- | --- |
| Backend | `D:\three\question-bank-api` | `intelligent-services-gateway` | `845b1da` | `production-intelligent-platform` |
| Flutter | `D:\three\app_app` | `flutter-intelligent-services` | `90e062a` | `flutter-production-intelligent-platform` |
| Admin | `D:\three\admin-dashboard` | `intelligent-services-admin-dashboard` | `173175f` | `admin-production-intelligent-platform` |

The Git graphs show the Google authentication and production API integration
commits are ancestors of the selected backend and Flutter branches. The admin
dashboard is an independent Next.js repository. The pre-existing uncommitted
backend edit at `docs/student-progress-hardening-audit.md` is outside this task
and must not be staged.

## Environment evidence

- PostgreSQL server: `16.13`.
- `vector` extension: neither available nor installed in the current Windows
  PostgreSQL installation.
- Docker Desktop Linux daemon: unavailable at audit time.
- Redis integration and API/database/Redis health checks already exist.
- The current document worker is a database polling loop with a Redis lock, not
  a BullMQ worker.
- No real external service credential is present or required for automated
  development verification.

## Feature matrix

| Feature | Backend implementation | Flutter implementation | Admin implementation | Database impact | External dependency | Current status | Missing work | Test evidence | Deployment risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google sign-in | Verified-token login and account linking | Plugin sign-in and backend exchange | Not applicable | Identity columns/migration | OAuth configuration | COMPLETE_AND_AUTOMATED_TESTED | Live release credentials | Backend/Flutter tests | Medium |
| Multi-provider gateway | Adapter registry, encryption, routing, fallback | Backend-only calls | CRUD and connection-test screens | Provider/model/route tables | Real credentials | COMPLETE_AND_AUTOMATED_TESTED | Live provider test | Unit/admin tests | Medium |
| Usage and cost | Redis quotas and request logs | Generic remaining-limit UI | Usage and cost pages | Policy/log tables | Redis | COMPLETE_AND_AUTOMATED_TESTED | Production alert thresholds | Unit tests | Medium |
| Question safety | Server-owned question/attempt context | Hint/explain entry points | Not applicable | No new impact | None | COMPLETE_AND_AUTOMATED_TESTED | Multimodal matching safety | Unit tests | High |
| Text assistant | Typed public endpoints | Chat/lesson/question UI | Prompt/route configuration | Prompt and request logs | Text-capable service | IMPLEMENTED_NOT_LIVE_TESTED | Streaming and live service test | Backend/Flutter tests | Medium |
| Text document ingestion | PDF/DOCX/TXT/Markdown extraction and chunking | Not applicable | Upload/reprocess UI | Document/chunk tables | Durable storage | COMPLETE_AND_AUTOMATED_TESTED | Production storage driver | Unit/admin tests | Medium |
| Scanned PDF OCR | Honest `OCR_REQUIRED` failure only | Not applicable | Status display only | Status enum exists | OCR engine and PDF renderer | MISSING | OCR worker and page pipeline | No live OCR evidence | High |
| Image question analysis | Adapter capability only | No camera/gallery flow | No vision test workflow | Task enum only | Image normalizer and vision service | MISSING | Public endpoint, validation, safety and UI | No endpoint tests | High |
| Embeddings | Adapter contract only | Not applicable | Capability fields only | `embeddingRef` placeholder | Embedding-capable service | PARTIAL | Jobs, vectors and idempotency | Adapter tests only | High |
| Vector storage | Not implemented | Not applicable | Not implemented | No vector column/index | pgvector | BLOCKED_BY_EXTERNAL_CONFIGURATION | Extension-enabled PostgreSQL and migration | Audit query: unavailable | High |
| Keyword retrieval | Scoped deterministic search | Citations display | Admin search test | Existing chunk indexes | PostgreSQL | COMPLETE_AND_AUTOMATED_TESTED | Full-text ranking improvement | Unit tests | Low |
| Hybrid retrieval | Keyword only | Public response compatible | Settings not operational | Vector schema required | pgvector/embedding | MISSING | Vector + FTS merge and thresholds | None | High |
| Reranking | Task/capability enum only | Not applicable | Capability fields only | Optional route/model | Reranking-capable service | MISSING | Abstraction, validation and fallback | None | Medium |
| Streaming | No SSE endpoint | No streaming transport | Not applicable | Request logs must stay idempotent | Streaming-capable service | MISSING | SSE contract, cancellation and heartbeat | None | Medium |
| Intelligent response cache | `cacheHit` log field only | Transparent | Cache metric display | No schema change required | Redis | MISSING | Safe keys, TTL and invalidation | None | Medium |
| Persistent storage | Local path implementation | Not applicable | Upload UI | Storage path metadata | Persistent volume | PARTIAL | S3-compatible abstraction | Local unit behavior | High |
| Workers | One document polling process | Not applicable | No queue controls | Document statuses | Redis | PARTIAL | BullMQ OCR/embedding/document workers | Existing ingestion tests | High |
| Admin authentication | Backend JWT via BFF cookies | Not applicable | Login/proxy/middleware/tests | Existing auth data | Backend availability | COMPLETE_AND_AUTOMATED_TESTED | CSRF and production cookie proof | Vitest suite | High |
| Admin provider/model/routing | Protected CRUD APIs | Hidden from students | Connected pages and persistence tests | Existing intelligent tables | Backend | COMPLETE_AND_AUTOMATED_TESTED | Live browser CRUD proof | Vitest/MSW and backend tests | Medium |
| Admin knowledge/documents | Protected APIs | Citations only | Connected upload and management pages | Knowledge tables | Storage/worker | COMPLETE_AND_AUTOMATED_TESTED | OCR/vector fields and live proof | Admin/backend tests | Medium |
| Observability | JSON logger and health endpoints | Generic errors | Health/usage pages | Request logs | Redis/PostgreSQL | PARTIAL | Worker/vector/OCR/SSE metrics | Health unit tests | Medium |
| Production Docker | API Dockerfile and development compose | Built separately | No production image yet | Volumes required | Docker daemon | PARTIAL | Production compose, admin/workers/Nginx | Prior syntax evidence only | High |
| Nginx and TLS | Not configured | HTTPS base URL required | Separate admin origin required | None | DNS/certificate | MISSING | Reverse proxy and certificate runbook | None | High |
| Backup and restore | Documentation only | Not applicable | Not applicable | All persistent tables | PostgreSQL/storage tools | IMPLEMENTED_NOT_LIVE_TESTED | Executable scripts and restore drill | No restore proof | High |
| Flutter release | Debug APK previously built | Existing production API app | Not applicable | None | Signing/OAuth/Firebase config | PARTIAL | Final ID, permissions, release signing/APK/AAB | 106 tests, debug APK | High |

## Audit decision

The existing platform is a sound base and must be extended rather than
recreated. It is not deployment-ready yet. The highest-risk blockers are the
absence of pgvector in the local database, no OCR/image pipeline, no real
streaming/cache, incomplete worker/storage architecture, and the unavailable
Docker daemon. Features that require real credentials remain
`BLOCKED_BY_EXTERNAL_CONFIGURATION`; automated verification must use a
development/test-only local service and must never enable it in production.

