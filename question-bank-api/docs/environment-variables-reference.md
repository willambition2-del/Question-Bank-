# Environment variables

Required in every environment: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`.

Production also requires `REDIS_HOST`, non-wildcard `CORS_ORIGINS`, and
strong JWT secrets. Intelligent services require a canonical base64 32-byte
`PROVIDER_CREDENTIALS_MASTER_KEY` and persistent storage.

Key intelligent-platform settings:

- `INTELLIGENT_SERVICES_ENABLED`
- `VECTOR_SEARCH_ENABLED`, `VECTOR_DIMENSIONS`, `EMBEDDING_BATCH_SIZE`
- `OCR_ENABLED`, `OCR_LANGUAGES`, `OCR_RENDER_SCALE`,
  `OCR_MIN_CHARACTERS_PER_PAGE`
- `IMAGE_MAX_SIZE_MB`, `IMAGE_MAX_PIXELS`, `IMAGE_MAX_DIMENSION`
- `ASSISTANT_CACHE_TTL_SECONDS`
- `STORAGE_DRIVER=local|s3`, `DOCUMENT_STORAGE_PATH`
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`
- `DOCUMENT_WORKER_CONCURRENCY`

Use a secret manager or a host-only `.env.production`. Never commit live
values. `.env.example` and the workspace production example contain names and
placeholders only.

## Question import phase (2026-07-30)

A pre-import custom-format database backup and checksum were captured. The canonical source is audited SQLite; direct SQL restore is prohibited. New staging migrations and a read-only dry-run pipeline are documented in `question-import-architecture.md`. Final import is blocked pending review of `question-data-quality-report.md`.