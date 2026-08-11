# Student Progress + Mistakes + Saved Questions Hardening Audit

## Baseline

- Starting commit: `f4e48f75ebb1e76b918c22bde81dea841bae982a`.
- Existing Progress module and all five persistence models are reused.
- Existing composite unique constraints protect one question aggregate and one saved row per user/question.

## Existing Implementation

- Quiz persists `QuizAnswer` and calls `StudentProgressService` in the same transaction.
- Question, lesson, unit, subject, daily activity, mistakes, saved questions, and collection-quiz integrations already exist.
- Mastery is centralized and manual review is distinct from calculated mastery.
- Student question mapping already strips answer keys.

## Found Defects

1. Question and hierarchy aggregates use unprotected read-modify-write values and can lose concurrent updates.
2. Lesson/unit/subject `answeredQuestions` count answer events rather than distinct attempted questions.
3. Aggregate mastery uses a separate approximation instead of current question mastery state.
4. Hierarchy updates run concurrently through `Promise.all` on one transaction client, producing the observed `pg` warning.
5. `recordAnswer` cannot independently prove or rebuild idempotency from the persisted `QuizAnswer` source of truth.
6. There is no question or hierarchy reconciliation service.
7. Average-time state lacks the last-time and first-answer fields needed for a complete deterministic rebuild contract.
8. Calculated mastery has no persisted first-mastery timestamp.
9. Saved rows lack `updatedAt`, return raw Prisma entities from writes, do not derive hierarchy fields, and validate only the question row.
10. Mistake detail does not apply current visibility checks; list visibility is incomplete above question/passage level.
11. Saved sorting is fixed despite a documented multi-sort contract.
12. Stable Progress/Mistake/Saved error mapping and Swagger documentation are incomplete.
13. Unit coverage is shallow and no real PostgreSQL Progress lifecycle/concurrency/reconciliation E2E suite exists.

## Integrity and Security Risks

- Concurrent answers can leave counters, averages, and hierarchy aggregates stale.
- Increment-only aggregates cannot recover from drift and are not a trustworthy student view.
- Hidden parent content can remain visible through mistake or saved collections.
- Returning raw saved entities exposes persistence details and creates an unstable API contract.
- A progress integration retry outside the current happy-path flow could double counters.

## Source of Truth

- `QuizAnswer` is the immutable answer-event source of truth.
- `StudentQuestionProgress` is a rebuildable derived aggregate.
- Lesson, unit, and subject progress are rebuildable derived aggregates.
- `SavedQuestion` is independent user-owned state.
- Mistakes are a projection of visible `StudentQuestionProgress` rows with `wrongCount > 0`.

## Migration Decision

One new migration is required. Existing applied migrations will not be edited. The current schema cannot persist a deterministic question rebuild contract (`firstAnsweredAt`, last answer/time/selection), the documented first-mastery timestamp, or saved-note update time. The migration will add only those missing fields and supporting indexes; it will not duplicate existing models or counters.

## Planned Fixes

- Introduce one central Prisma transaction-client type and keep all Quiz answer effects on that client.
- Recompute question progress from persisted Quiz answers, making retries and reconciliation deterministic.
- Recompute hierarchy aggregates from current question progress and visible eligible questions in stable sequence.
- Add bounded serializable retry where Progress owns the transaction; retain Quiz's existing serializable retry for integrated writes.
- Add explicit reconciliation methods for question, lesson, unit, subject, and user.
- Apply full hierarchy visibility and safe mappers to mistakes and saved questions.
- Make saved writes and deletes idempotent, derive hierarchy server-side, normalize notes, and implement deterministic filters/sorts.
- Keep `mark-mastered` as review acknowledgement only; calculated mastery remains immutable from HTTP.
- Delegate MISTAKES and SAVED quiz creation to the existing Quiz engine.

## Test Gaps and Acceptance Criteria

- Unit tests must cover counters, sequences, averages, mastery transitions, hierarchy definitions, visibility, ownership, note policy, sorts, idempotency, and rebuild correction.
- Real PostgreSQL E2E must cover Auth/JWT, Quiz-to-Progress integration, two users, mistakes/saved safety, collection quizzes, hidden content, corrupted-aggregate reconciliation, and concurrent writes.
- All prior unit/E2E suites, Prisma drift gates, format, lint, build, runtime Health, and Swagger must remain successful.

## Implemented Integrity Model

### Source of truth and transaction contract

- `QuizAnswer` is the immutable answer-event source. Every question aggregate is deterministically rebuilt from the current user's persisted answers.
- `PrismaTransactionClient` is centralized in `progress-types.ts`. Quiz answer creation, Progress, daily activity, and Gamification continue on the same serializable transaction client.
- Progress no longer opens nested transactions or reads from the root client inside a Quiz transaction. Hierarchy rebuilds run Lesson, then Unit, then Subject sequentially.
- The direct Progress/Quiz path no longer shares a transaction client through `Promise.all`. The same correction was applied to the directly invoked achievement evaluation query sequence.

### Idempotency, counters, time and mastery

- `recordQuestionAnswer` verifies its internal input against the persisted `QuizAnswer`, then derives all counters from answer history. Repeating it for the same answer writes identical values rather than incrementing twice.
- `attemptsCount` is the persisted answer count; correct/wrong counts partition it. Consecutive counters are calculated from the newest uninterrupted answer suffix.
- `averageTimeMs` is the rounded arithmetic mean of persisted answer times; `lastTimeMs` is the latest persisted time. Negative or unsafe integer time input is rejected before integration.
- Mastery remains centralized: accuracy 50, repetition 15, streak 15, recency 10, speed 10; score is bounded 0–100. Mastery requires score >= 80, at least three attempts, and at least two consecutive correct answers.
- `masteredAt` records the first demonstrated mastery and is retained as historical evidence if later answers make `isMastered=false`. Manual review never changes calculated mastery.

### Hierarchy aggregate definitions

- `answeredQuestions`: distinct currently visible questions with at least one answer.
- `correctAnswers` / `wrongAnswers`: distinct visible questions whose latest answer is correct / wrong.
- `accuracyPercent`: all correct persisted attempts divided by all persisted attempts for visible questions.
- `masteryPercent`: mastered visible questions divided by all eligible READY, active, published, fully visible questions.
- `averageTimeMs`: attempts-weighted mean across included question aggregates.
- Hidden/inactive/unpublished/deleted questions or hidden parents remain in history but are excluded from student collections and rebuilt visible aggregates.

### Reconciliation

- `ProgressReconciliationService` provides internal question, lesson, unit, subject, and user rebuild methods. User rebuild unions answer-backed question IDs with existing aggregate IDs, so corrupt or orphaned derived rows are corrected or removed.
- Reconciliation is internal only, uses bounded Serializable retries, and is never run automatically from student GET endpoints or globally in production.

### Mistakes and saved questions

- Mistakes are visible question-progress rows with `wrongCount > 0`; filters, pagination, and deterministic sorts are implemented. Detail and review acknowledgement are ownership-safe and solution-free.
- The legacy `mark-mastered` route is retained for compatibility but only sets `manualReviewedAt` idempotently. It cannot change `isMastered`.
- Saved writes derive hierarchy from the visible Question, normalize notes, preserve creation time, expose update time, return mapped student contracts, and use the user/question unique key for idempotency.
- Saved deletion is idempotent. Update/delete races return only success or a stable non-disclosing not-found response; the source Question is never deleted.
- MISTAKES and SAVED quizzes delegate to `QuizAttemptsService` and reuse owner-scoped selection, hierarchy visibility, snapshots, and shortage behavior.
- No public Progress overview routes existed before this phase, so none were duplicated; Education/Statistics consumers retain the hardened derived models.

## Applied Migration Record

The phase introduced one structural schema change split into two applied Prisma migration steps:

1. `20260718180000_student_progress_hardening`: adds deterministic rebuild/last-answer/mastery fields and `SavedQuestion.updatedAt`, with safe backfill for historical first-answer/mastery dates.
2. `20260718183047_student_progress_hardening`: Prisma-generated normalization that removes the temporary database default from `updatedAt` so database behavior exactly matches Prisma `@updatedAt`.

Previously applied migrations were not modified. Migration count changed from 12 to 14, both development and `question_bank_test` are current, and migrate diff reports no difference.

## Verification Evidence

- Unit: 23 suites / 118 tests, all pass; 0 snapshots.
- E2E: 9 suites / 51 tests, all pass; 0 snapshots.
- New PostgreSQL suite: 1 suite / 5 scenario tests covering real Nest/Auth/JWT/Prisma/PostgreSQL/HTTP, concurrent answers, retries, ownership, leakage, collection quizzes, hidden content, reconciliation, and concurrent Saved operations.
- Prisma format, validate, generate, migrate status and migrate diff: pass; 14 migrations; no drift.
- Targeted Progress PostgreSQL run emits only the expected Node VM Modules warning and no `pg` transaction-client deprecation.
- Runtime: port 3100 Health and database connection HTTP 200; Swagger UI/JSON HTTP 200; all Mistakes/Saved paths documented and guarded requests return 401; no duplicate public Progress routes exist.

## Remaining Honest Limits

- The full legacy E2E regression run still emits one `pg@8` deprecation from Prisma adapter transaction batching in older non-Progress suites. A traced run points to Prisma's batched query interpreter; the new Progress suite and Quiz suite do not emit it in isolation. Removing every legacy `$transaction([...])` call is outside this selected phase.
- Reconciliation is intentionally internal and operator-driven; no admin job/CLI scheduling surface was added.
- Historical rows receive conservative migration backfills. Running user reconciliation is the authoritative way to populate all newly added last-answer fields from old Quiz answers.

## Completion

`SELECTED_NEXT_PHASE=Student Progress + Mistakes + Saved Questions Hardening`

`STATUS=COMPLETE_FOR_SELECTED_PHASE`

The next logical phase is **Statistics + Recommendations Hardening** and is intentionally not implemented here.
