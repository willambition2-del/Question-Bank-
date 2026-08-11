# Intelligent Services Gateway Audit

Date: 2026-07-29

Starting points:

- Backend: `D:\three\question-bank-api` at `756b1af`
- Flutter: `D:\three\app_app` at `f188701`
- Admin UI: no Question Bank admin application exists under `D:\three`.
  `D:\my-next-app` and `D:\my-next-app2` are unrelated starter projects and
  contain separate user work, so they are not safe integration targets.

| Feature | Current implementation | Data source | Security state | Missing pieces | Suggested module | Database impact | Admin UI impact | Flutter impact | Risk | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication | JWT access/refresh and Google identity | PostgreSQL | Global JWT and role guards | Feature-specific permission and quota checks | `IntelligentServicesModule` | Usage policies and request logs | SUPER_ADMIN session required | Existing auth interceptor reused | Low | P0 |
| Admin authorization | `ADMIN`, `REVIEWER`, `SUPER_ADMIN` roles | JWT claims | Route-level `@Roles` works | Intelligent-service management must be SUPER_ADMIN only | `AdminIntelligentServicesModule` | Credential audit actor relations | New control center required | None | High | P0 |
| Questions | Published student DTO excludes solutions; admin DTO contains answers | PostgreSQL | Strong public/admin separation | Context modes for active quiz safety | `QuestionContextService` | No question schema change required | Test context and policies | Explain/hint actions | Critical | P0 |
| Quiz attempts | Server snapshots, scoring and answer ownership | PostgreSQL | Server remains source of truth | Assistant must inspect active attempt before revealing answers | `QuestionContextService` | Request log references only | Safety diagnostics | No scoring changes | Critical | P0 |
| Lessons and sources | Typed hierarchy and published flags | PostgreSQL | Student views are filtered | Knowledge scope and retrieval bindings | `KnowledgeBaseModule` | Knowledge/document relations | Scope selectors | Lesson assistant | Medium | P1 |
| Recommendations/statistics | Deterministic backend services | PostgreSQL | Authenticated and server-owned | Optional explanation task only | `AssistantModule` | Usage log only | Routing policy | Typed explanation | Medium | P2 |
| Redis | Distributed throttling, locks, pub/sub; memory fallback outside production | Redis | Redis required in production | Atomic feature quotas, circuit state and cache | `UsageModule`, `CircuitBreakerService` | None | Health and quota views | Limit status | Medium | P0 |
| Logging | Request IDs and JSON logs; no request bodies | stdout | Authorization/body not logged | Explicit secret redaction and intelligent request metrics | `ServiceAuditService` | Redacted request log | Logs/health pages | No internal metadata | High | P0 |
| Health | Database/Redis health endpoint | Runtime | Public result is coarse | Internal provider/model health | `ProviderHealthService` | Provider health metadata/logs | Detailed internal health | Generic availability only | Medium | P1 |
| File uploads | Question import payloads; no reusable binary storage abstraction | PostgreSQL/import service | No knowledge upload pipeline | Signature/MIME validation, disk storage, worker | `DocumentIngestionModule` | Documents/chunks | Drag/drop and status | No public KB upload | High | P1 |
| Queues | Redis sorted-set helper only | Redis | No production document worker | Durable document jobs and separate worker entry point | `DocumentIngestionModule` | Document status lifecycle | Reprocess controls | Processing state only | High | P1 |
| Provider calls | None | — | No keys currently exposed | Encrypted credentials, adapters, SSRF controls | `ProvidersModule` | Providers/models/audits | Provider/model forms | Backend-only | Critical | P0 |
| Routing | None | — | Client cannot currently choose models | Capability registry, policy, fallbacks and circuit breaker | `RoutingModule` | Policies/candidates | Routing editor/tester | No provider/model fields | Critical | P0 |
| Prompts | Hard-coded educational copy only | Source code | Client cannot edit system text | Versioned admin-managed templates and schemas | `PromptsModule` | Prompt versions | Prompt editor/activation | Typed feature requests only | High | P0 |
| Usage/cost | Global HTTP throttling only | Redis | No per-feature budgets | Atomic quotas and model/provider cost accounting | `UsageModule` | Policies and request logs | Usage/cost dashboard | Remaining allowance only | High | P0 |
| Knowledge/RAG | No document ingestion or retrieval | — | No injection boundary yet | Extraction, chunking, filtering, retrieval and citations | `KnowledgeBaseModule` | KB/documents/chunks | Full KB management | Read-only sources | High | P1 |
| Vector search | Not installed and pgvector availability is unconfirmed | PostgreSQL | No unsafe JSON embeddings | Swappable vector reference with keyword fallback; enable pgvector only after deployment capability check | `KnowledgeRetrievalService` | `embeddingRef`, indexed text | Search diagnostics | No implementation detail | Medium | P1 |
| Flutter assistant | No assistant/image upload screen; no direct provider API calls found | Platform backend only | No keys in Flutter | Repository, state machine and feature UI | Flutter `AssistantRepository` | None | None | New platform feature screens | Medium | P1 |
| Admin UI | No related application found | — | Backend admin APIs exist only | A new isolated control center is required | `question-bank-admin` | None | Entire private UI | None | High | P1 |

## Audit conclusions

1. The existing quiz engine remains authoritative for correctness, score and
   results. Intelligent services receive only a policy-filtered context.
2. Public endpoints must map to fixed internal task types and reject
   `providerId`, `modelId`, routing policy and system prompt fields.
3. Provider credentials must be AES-GCM encrypted with a versioned envelope;
   plaintext is used only for the outbound call and never returned or logged.
4. PostgreSQL is suitable for control-plane metadata and keyword retrieval.
   pgvector is deployment-dependent, so vector storage remains behind an
   abstraction and cannot be claimed active until the extension is installed.
5. No production mock or provider fallback will be introduced. CI uses injected
   adapter test doubles and local mock HTTP servers only.
