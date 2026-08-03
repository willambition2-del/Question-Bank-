#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${DOCUMENT_STORAGE_PATH:?DOCUMENT_STORAGE_PATH is required}"
: "${BACKUP_ROOT:?BACKUP_ROOT is required}"

backup_id="$(date -u +%Y%m%dT%H%M%SZ)"
target="${BACKUP_ROOT}/${backup_id}"
mkdir -p "${target}"
pg_dump --format=custom --no-owner --no-acl "${DATABASE_URL}" > "${target}/database.dump"
tar -C "${DOCUMENT_STORAGE_PATH}" -czf "${target}/knowledge-storage.tar.gz" .
sha256sum "${target}/database.dump" "${target}/knowledge-storage.tar.gz" > "${target}/SHA256SUMS"
printf '%s\n' "${backup_id}" > "${target}/BACKUP_ID"
echo "Backup completed: ${target}"
