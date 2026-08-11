# Selected Next Phase Plan

SELECTED_NEXT_PHASE=Student Progress + Mistakes + Saved Questions Hardening

STATUS=COMPLETE_FOR_SELECTED_PHASE

## Delivered

- QuizAnswer-backed, retry-safe StudentQuestionProgress with deterministic counters, averages, last-answer state, and first-mastery history.
- Same-client sequential transaction policy for Quiz-to-Progress integration.
- Distinct-question Lesson, Unit, and Subject aggregates with stable accuracy/mastery definitions.
- Internal question/hierarchy/user reconciliation with Serializable retries.
- Fully visible, owner-safe, paginated and solution-free Mistakes.
- Idempotent manual review acknowledgement without bypassing calculated mastery.
- Idempotent, hierarchy-derived, normalized and student-safe Saved Questions.
- MISTAKES and SAVED collection quizzes delegated to the hardened Quiz Engine.
- Focused unit coverage and real PostgreSQL lifecycle, ownership, leakage, reconciliation and concurrency E2E.

## Migration decision

Two new applied migration steps implement one structural hardening change: the first adds missing deterministic rebuild/mastery/saved-update fields; the Prisma-generated second normalizes the SavedQuestion updatedAt default to match @updatedAt. Existing migrations were not modified. All 14 migrations are current and migrate diff is empty.

## Verification

- Unit: 23 suites / 118 tests.
- E2E: 9 suites / 51 tests on guarded `question_bank_test`.
- Prisma format/validate/generate/status/diff: pass, no drift.
- Format, lint and build: pass.
- Port 3100 Health and Swagger UI/JSON: HTTP 200; all Mistakes/Saved paths present and guarded.
- No skipped tests or snapshots.

## Next phase

Statistics + Recommendations Hardening remains intentionally unimplemented.
