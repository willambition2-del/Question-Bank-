# Question database source audit

Audit date: 2026-07-30 (Asia/Riyadh). Source was inspected read-only; no source file was changed or executed.

| Path | Type | Size | SHA-256 | Classification |
|---|---:|---:|---|---|
| `D:\three\db\question_bank_verified_only.sqlite` | SQLite 3 | 96,923,648 B | `400e5ebd6f6ab34c4a6a03f53c7550d3bf57a0897397f4c1905dfee463914bf8` | REQUIRES_CLEANING |
| `D:\three\db\question_bank_verified_only_postgresql.sql` | PostgreSQL SQL text | 62,011,907 B | `e7e36500881e8503e1cd6e8b77c9f8e89b246152e272ace4753c0f5f6ee5561b` | DUPLICATE_SOURCE |
| `D:\three\db\question_bank_verified_only_postgresql.sql.gz` | gzip of the SQL file | 4,292,577 B | `0dfb859e21265ef7dc9298325392c19f2ac24edc7a66c7b9782db7d99d29e954` | DUPLICATE_SOURCE |

The decompressed gzip checksum equals the SQL checksum. The SQL contains `DROP TABLE ... CASCADE`; it must never be executed against the application database. SQLite is the canonical import input.

SQLite `integrity_check` returned `ok`; `foreign_key_check` returned zero violations. Core tables: questions 19,841; options 42,035; subjects 7; curriculum units 33; curriculum lessons 298; source sets 18; passages 90. Language is primarily Arabic with English subject content. Grade metadata is ثالث ثانوي. Types are MCQ 9,745 and true/false 10,096. Explanations and answers are present at source level, but 61 true/false answers are ambiguous under strict validation. No images, PDFs, attachment folders, CSV, JSON, or XLSX files exist in the source directory.

Quality findings: 18 blank question texts; 440 rows with duplicate normalized option text; 1,074 source review flags; 2,663 duplicate fingerprint groups with 3,847 extra rows; 11,110 source rows lack a curriculum lesson relation. The full application mapping found no unmatched subject after explicit aliases (`أحياء→الأحياء`, `فيزياء→الفيزياء`, `كيمياء→الكيمياء`), but the application currently has only one placeholder unit/lesson per subject, so all 19,841 source lessons remain unmapped.

Risk: HIGH for direct import, LOW for read-only discovery and staging. Proposed path: read-only SQLite parser → explicit mapping → staging rows → strict validation → duplicate detection → dry run → human curriculum mapping/review → SUPER_ADMIN confirmation. Current source is not ready for final import.
