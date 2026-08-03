#!/usr/bin/env sh
set -eu
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${RESTORE_STORAGE_PATH:?RESTORE_STORAGE_PATH is required}"
: "${BACKUP_SET:?BACKUP_SET is required}"

test -f "${BACKUP_SET}/database.dump"
test -f "${BACKUP_SET}/knowledge-storage.tar.gz"
(cd "${BACKUP_SET}" && sha256sum -c SHA256SUMS)
mkdir -p "${RESTORE_STORAGE_PATH}"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="${RESTORE_DATABASE_URL}" "${BACKUP_SET}/database.dump"
tar -C "${RESTORE_STORAGE_PATH}" -xzf "${BACKUP_SET}/knowledge-storage.tar.gz"
echo "Restore completed; run migration status and scripts/verify-intelligent-platform.mjs"
