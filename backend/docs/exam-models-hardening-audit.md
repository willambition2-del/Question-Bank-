# Exam Models Hardening Audit

## Baseline

- Branch baseline: `question-bank-hardening` at `2c370d0dbe8f293dd441c18a9440f016214071e6`.
- Existing Prisma models and uniqueness constraints are reusable; no schema migration is required.
- Scope is limited to exam-model authoring, membership/order, publication, student-safe reads, filters, and real PostgreSQL E2E coverage.

## Findings

1. Student list/detail did not enforce the full Subject/Curriculum/Grade/Source and question Unit/Lesson/Passage visibility chain.
2. Student list exposed administration fields and counted raw memberships rather than currently valid questions.
3. Student detail could return a published exam with no currently valid questions.
4. Publication validation omitted exam-parent visibility, question hierarchy visibility, positive finite points, duration, slug, and ordering checks.
5. Published exams could be edited or have membership/order changed; operations silently unpublished them.
6. Single add/remove operations were not transactional; reorder used the root Prisma client during a transaction.
7. Membership addition accepted inactive/non-READY questions and did not validate hierarchy consistency.
8. Restore did not validate relations or explicitly preserve the unpublished authoring state.
9. Subject changes were insufficiently classified when memberships existed.
10. DTO validation lacked normalized slug rules, complete trimming, the intended duration range, admin publication/deletion filters, deterministic sort selection, and the bulk limit of 100.
11. Constraint failures used generic error codes instead of stable exam-model conflict codes.
12. Admin detail had no membership validity warnings or computed question count/total points.
13. The admin Swagger tag was not separated from the student API.
14. No real PostgreSQL E2E suite covered the complete exam-model lifecycle and security boundaries.

## Hardening Plan

- Centralize exam-parent and question-membership validation.
- Separate student and admin mapping contracts.
- Reject all content and membership mutation while published.
- Make membership writes transactional and map uniqueness races to stable codes.
- Add deterministic filtering/sorting, current-valid counts, totals, and admin warnings.
- Add focused unit tests and a real PostgreSQL lifecycle/security E2E suite.

## Completed Implementation

- Reused `ExamModel` and `ExamModelQuestion`; no duplicate model or migration was introduced.
- Added centralized exam-parent validation and reused the Question hierarchy validator.
- Added distinct student/admin mappers, current-valid counts and server-calculated total points.
- Added stable filtering/sorting and admin membership warnings.
- Made add, bulk add, remove, and reorder membership writes transactional.
- Added stable conflict/not-found/publication error codes and rejected all mutation while published.
- Enforced publication prerequisites and current visibility on every student list/detail read.
- Preserved memberships across soft delete/restore; restore remains unpublished.
- Added 10 focused unit tests and a real PostgreSQL lifecycle/security E2E suite.

## Migration Decision

No migration was required. The existing schema already provides both required unique constraints: `(examModelId, questionId)` and `(examModelId, sortOrder)`. Prisma reports all 12 migrations applied and `migrate diff` reports no difference.

## Verification

- Prisma format, validate, generate, migrate status, and migrate diff: pass.
- Format, lint, and build: pass.
- Unit: 22 suites / 98 tests, all pass; 0 skipped and 0 snapshots.
- E2E: 7 suites / 40 tests, all pass on guarded `question_bank_test`; 0 skipped and 0 snapshots.
- Runtime on port 3100: Health, Swagger UI, and Swagger JSON returned HTTP 200.
- Swagger exposes all 11 Exam Models paths and 14 HTTP operations.
- Student leakage proof covers answer flags, boolean answers, explanations, review state, fingerprints, and wrong-answer rationale.

## Remaining Gaps

- Student listing validates candidates in application code to guarantee current hierarchy correctness; a future scale phase may replace this with a denormalized eligibility projection.
- Legacy mock E2E suites remain, but Exam Models now has a real Nest/Prisma/PostgreSQL suite without core-service overrides.
- Quiz Engine Hardening is the next dependency phase and was not implemented here.
