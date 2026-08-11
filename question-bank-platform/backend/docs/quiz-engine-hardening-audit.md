# Quiz Engine Hardening Audit

## Baseline

- Starting commit: `97927880742c901a29ccd1d7272b3600975a5941`.
- Existing `QuizAttempt`, `QuizAttemptQuestion`, and `QuizAnswer` models are reusable.
- Existing unique constraints cover attempt question/order and one answer per attempt question.

## Existing Implementation and Defects

1. Attempt creation used a nested write but did not explicitly centralize scope/hierarchy validation.
2. Scope validation only checked a subset of required/forbidden identifiers.
3. Selection checked question state and passage visibility but not the complete hierarchy.
4. The bounded candidate pool was reasonable, but ownership/filter behavior and shortage policy were incomplete.
5. Snapshots contained only the student projection, so evaluation read the mutable live question.
6. Student `get` and result mapping also read mutable question records instead of immutable snapshots.
7. Identical answer retries were rejected rather than returned idempotently.
8. Answer type/option errors used generic codes, and hint/elimination policy was incomplete.
9. Speed rewards trusted client-reported time.
10. Answer and completion concurrency relied on pre-transaction reads.
11. Completion trusted cached counters instead of recomputing from persisted answers.
12. Completion returned before the gamification event, making the event unreachable.
13. Repeated completion could duplicate progress and gamification side effects.
14. Abandonment was not idempotent and used an unconditional status update.
15. Zero hearts and the final answer did not auto-complete the attempt.
16. PER_QUESTION timing had no explicit DTO field or documented server policy.
17. History lacked the required deterministic sort modes.
18. Result breakdowns were shallow and did not prove snapshot consistency.
19. No real PostgreSQL Quiz lifecycle/concurrency E2E suite existed.

## Security and Integrity Risks

- Mutable-content evaluation could change historical scores after an editor changed a question.
- A client-controlled time value could obtain a speed bonus.
- Duplicate retries/races could cause conflicting UX or duplicate side effects.
- Incomplete scope and hierarchy validation could select hidden or unrelated content.
- Returning live question content could reveal state inconsistent with the attempt snapshot.

## Migration Decision

No schema change is currently required. JSON snapshots can store immutable internal evaluation data while student mappers remove solutions. Existing composite unique constraints and the point ledger idempotency key support the required concurrency policies.

## Planned Fixes and Acceptance Criteria

- Central scope validation and current hierarchy visibility.
- Bounded, ownership-safe selection with fixed Exam Model order and explicit shortage metadata.
- Internal immutable snapshots plus student-safe projections.
- Central server-side scoring, timing, hearts, hints, and answer validation.
- Serializable/retry-safe answer transactions and idempotent identical retries.
- Conditional, idempotent completion/abandonment and reachable transactional integrations.
- Snapshot-derived get/result contracts and deterministic history.
- Focused unit tests plus real Nest/JWT/Prisma/PostgreSQL E2E, including concurrency.

## Implemented Hardening

- `QuizScopeValidator` enforces the exact identifier combinations for SUBJECT, UNIT, LESSON, EXAM_MODEL, RANDOM, MISTAKES, WEAKNESS, and SAVED scopes. Unit/lesson ancestry, published exam models, and the complete active/published/non-deleted hierarchy are verified before selection.
- Selection is bounded to 500 candidates, filters the full visible hierarchy before choosing, avoids duplicates and recent questions where possible, preserves Exam Model order, and scopes saved/mistake/weakness sources to the authenticated owner.
- A non-empty undersized pool creates a partial attempt and returns `requestedCount`, `selectedCount`, and `isPartial`; an empty pool fails with `INSUFFICIENT_QUESTIONS`.
- Every attempt question stores a versioned internal snapshot containing the immutable answer key and explanations. Dedicated student and answered-result projections strip solution fields; evaluation never reads mutable live question content.
- `QuizScoringService` is the single scoring policy: answer correctness is computed server-side, speed uses server elapsed time, hint/elimination penalties are bounded, difficulty is applied centrally, and scores cannot be negative or exceed the configured cap.
- TOTAL and PER_QUESTION expiration are enforced lazily at authenticated attempt operations. TOTAL uses the attempt start time; PER_QUESTION uses server-maintained `lastActivityAt`. NONE has no deadline. No client time is trusted and no scheduler/cron was introduced.
- Hearts are decremented transactionally on wrong answers. Reaching zero hearts or answering the final question auto-completes the attempt and records the completion reason in attempt settings.
- Exact answer retries return the persisted answer. A different retry for the same attempt question returns HTTP 409. Unique-conflict recovery and serializable transaction retries cover concurrent identical submissions.
- Answer persistence, attempt counters, student progress, and gamification answer points execute in the same serializable transaction. Completion conditionally claims the ACTIVE attempt, recomputes persisted answers, and awards completion integrations once in that transaction.
- The previously unreachable completion gamification call is now reachable and transactional. Repeated completion returns the completed attempt without duplicating progress or points.
- Abandon is conditional and idempotent and never awards completion rewards. Expiration also awards no completion reward.
- Attempt, history, and result endpoints enforce authenticated ownership. History uses explicit deterministic sort modes. Result/get are snapshot-derived and reveal solutions only for completed attempts when the configured review mode permits it.

## Transaction and Failure Policy

The critical answer and completion effects use Prisma serializable transactions with bounded retries for PostgreSQL serialization conflicts. Database uniqueness remains the final guard for one answer per attempt question and one idempotent point-ledger event. There are no post-commit critical writes in this phase; a failed critical integration rolls back the state transition.

## Verification Record

| Gate | Result |
|---|---|
| Unit | 23 suites / 114 tests, all pass; 0 snapshots |
| E2E | 8 suites / 46 tests, all pass; 0 snapshots |
| Quiz PostgreSQL E2E | real Nest app, Auth/JWT, Prisma and PostgreSQL; lifecycle, ownership, leakage, snapshot immutability, shortage, timing and concurrency covered |
| Prisma format / validate / generate | pass |
| Prisma migrate status | 12 migrations applied and current |
| Prisma migrate diff | no difference detected |
| Prettier / ESLint / Nest build | pass |
| Runtime | port 3100; Health HTTP 200 and database connected |
| Swagger | `/api/docs` and `/api/docs-json` HTTP 200; all seven Quiz operations present |

## Remaining Honest Limits

- Hint and elimination usage is represented and scored safely by the answer contract, but dedicated hint/elimination interaction endpoints and persistent per-interaction state are outside this phase.
- Expiration is evaluated lazily on attempt access rather than by a background scheduler, so an untouched expired attempt remains ACTIVE in storage until the next relevant operation.
- PostgreSQL emits an upstream `pg` deprecation warning when some existing progress queries share a transaction client; correctness gates pass, but the broader progress flow should be serialized in its dedicated hardening phase.
- Multi-process load/stress testing is not part of this phase; concurrency is proven with real parallel PostgreSQL requests in E2E.

## Completion

`SELECTED_NEXT_PHASE=Quiz Engine Hardening`

`STATUS=COMPLETE_FOR_SELECTED_PHASE`

The next selected phase is **Student Progress + Mistakes + Saved Questions Hardening** and is intentionally not implemented here.
