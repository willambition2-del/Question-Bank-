# Deployment, backup and restore

Deploy the API and document worker from one tested build. PostgreSQL, Redis and
durable document storage are external state. Apply reviewed migrations with
`prisma migrate deploy` before starting the new processes.

Backups must cover:

- a consistent PostgreSQL dump including intelligent-service configuration,
  encrypted credentials, prompts, usage logs and knowledge metadata;
- the complete document-storage directory;
- the runtime configuration/key version needed to decrypt credential rows.

Database and document backups should share a backup-set identifier. Encrypt
backup media, restrict access, define retention, and test restoration on an
isolated environment. Redis quota/circuit keys are operational state and may be
rebuilt, but production policy should document the effect of losing them.

Restore order:

1. Provision an isolated database and durable storage.
2. Restore PostgreSQL and the matching document backup.
3. provide the matching runtime secrets through the secret manager.
4. Run migration status and integrity checks.
5. Start the worker, then the API with intelligent services disabled.
6. Verify document checksums, credential decryption through protected tests,
   retrieval, quotas and public privacy.
7. Enable routes/policies gradually.

Record recovery time and recovery point results for every drill. Never commit a
dump, document backup, credential or master key.

