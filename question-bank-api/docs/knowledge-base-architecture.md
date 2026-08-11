# Knowledge Base Architecture

Knowledge bases are private control-plane resources managed only through
SUPER_ADMIN APIs. A base may be global or scoped to a subject, unit, lesson,
question bank, or private administration use.

PostgreSQL stores metadata and normalized text chunks. Original files are stored
under `DOCUMENT_STORAGE_PATH`; file bytes are never stored as Base64 or in a
database JSON column. Each document has a SHA-256 checksum and a lifecycle from
`UPLOADED` through `READY`, `FAILED`, or `ARCHIVED`.

Retrieval applies mandatory knowledge-base and document-status filters plus
subject/unit/lesson filters. Returned citations are created only from persisted
chunks and contain document ID, chunk ID, title and page number.

`VECTOR_SEARCH_ENABLED=false` is the safe current default. The schema stores an
opaque `embeddingRef` for a replaceable vector store. The current implementation
uses PostgreSQL keyword matching and deterministic reranking; it does not claim
semantic vector search until pgvector or another production vector store is
configured.

