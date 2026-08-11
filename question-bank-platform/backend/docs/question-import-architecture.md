# Question import architecture

Upload/local dev selection → checksum and magic validation → parser → schema/column mapping → normalization → validation → duplicate detection → staging dry run → admin review → SUPER_ADMIN confirmation → bounded worker batches → reconciliation.

`QuestionImportJob` tracks lifecycle, counters, cursor and settings. `QuestionImportRow` contains source evidence, normalized candidate, errors/warnings and destination id. `QuestionSourceReference` makes imported records traceable and idempotent. Rollback and export actions have actor audit records. Dry run writes only these staging/audit tables, never `Question` or `QuestionOption`.

SQLite is opened with `readonly`, `fileMustExist`, `query_only=ON`, and `integrity_check`. SQL dumps are inspected only. Production uses uploaded/object-storage paths, not Windows paths. The final-import path must require `DRY_RUN_COMPLETED`, explicit SUPER_ADMIN confirmation, batch transactions, cursor updates, cancellation checks, and per-question atomic creation of question/options/reference.
