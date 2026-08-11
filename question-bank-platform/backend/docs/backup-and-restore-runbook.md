# Backup and restore runbook

`scripts/backup-production.sh` requires `DATABASE_URL`,
`DOCUMENT_STORAGE_PATH`, and `BACKUP_ROOT`. It creates one UTC-labeled set with
a custom PostgreSQL dump, compressed knowledge storage and SHA-256 manifest.
Encrypt and replicate the set outside the host together with the master-key
version (never the plaintext key in the backup directory).

For a drill, provision an isolated empty database and storage path, then set
`RESTORE_DATABASE_URL`, `RESTORE_STORAGE_PATH`, and `BACKUP_SET` before running
`scripts/restore-production.sh`. The script verifies checksums before restore.
Afterward run migration status and `scripts/verify-intelligent-platform.mjs`,
then sample document checksums, credentials through a protected connection
test, retrieval, OCR, quotas and public-response privacy.

No destructive restore drill was run against the active development database.
A real isolated restore and recorded RPO/RTO remain a production gate.

## Question import phase (2026-07-30)

A pre-import custom-format database backup and checksum were captured. The canonical source is audited SQLite; direct SQL restore is prohibited. New staging migrations and a read-only dry-run pipeline are documented in `question-import-architecture.md`. Final import is blocked pending review of `question-data-quality-report.md`.