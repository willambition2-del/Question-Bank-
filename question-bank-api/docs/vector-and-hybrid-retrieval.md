# Vector and hybrid retrieval

The new migration adds embedding metadata, generated `tsvector` content, a GIN
index, and conditionally creates pgvector storage plus a 1536-dimension HNSW
cosine index when the extension is available.

Embedding writes are idempotent by chunk, model and content checksum.
Repository raw SQL is isolated and parameterized. Retrieval applies knowledge
base, document status, subject, unit, lesson, source and language filters to
both keyword and vector candidates, then deduplicates and combines scores with
configured weights.

Startup fails closed when `VECTOR_SEARCH_ENABLED=true` but the extension or
vector table is absent. The current host PostgreSQL 16.13 does not provide
pgvector, so local verification covers migration, keyword GIN, metadata and
the safe disabled path. `docker-compose.production.yml` selects
`pgvector/pgvector:pg16`; it still requires an actual Docker run before a
production readiness claim.
