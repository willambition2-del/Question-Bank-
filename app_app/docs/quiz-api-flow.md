# Quiz API Flow

Contract source: backend commit `9734ec8`. All paths are relative to `/api/v1`; every route requires the bearer access token.

## Lifecycle

| Operation | Endpoint | Flutter implementation | Status |
| --- | --- | --- | --- |
| Create | `POST /quiz-attempts` | `DioQuizRemoteDataSource.create` | CONNECTED (repository-tested) |
| Restore/detail | `GET /quiz-attempts/:id` | Active attempt ID only is persisted; detail is refetched | CONNECTED (repository-tested) |
| Submit answer | `POST /quiz-attempts/:id/answers` | Duplicate taps blocked; server response owns correctness and points | CONNECTED (repository-tested) |
| Complete | `POST /quiz-attempts/:id/complete` | Skipped when answer response already completed the attempt | CONNECTED (repository-tested) |
| Abandon | `POST /quiz-attempts/:id/abandon` | Existing confirmation UI calls server then clears active ID | CONNECTED (repository-tested) |
| Result | `GET /quiz-attempts/:id/result` | Result screen reads server summary and gamification points | CONNECTED (repository-tested) |
| History | `GET /quiz-attempts` | Typed pagination and filters | CONNECTED (repository-tested) |
| Mistakes quiz | `POST /mistakes/quiz` | Uses scope `MISTAKES`; no local ID aggregation | CONNECTED (repository-tested) |
| Saved quiz | `POST /saved-questions/quiz` | Uses scope `SAVED`; no local attempt construction | CONNECTED (repository-tested) |

## Safety and authority

`QuizQuestion` maps only the student-safe projection. It does not retain `isCorrect`, `correctBoolean`, `correctOptionId`, `whyWrong`, fingerprints, review state, or internal snapshots. Correctness, score, points, remaining hearts, completion and expiry are accepted only from Backend responses. The Flutter timer is display-only and refreshes the attempt when it reaches zero.

Only `quiz.active_attempt_id` is stored locally. No question snapshot, submitted answer, or answer key is persisted.

## Partial availability

Backend commit `9734ec8` returns `requestedQuestionCount`, `actualQuestionCount`, `shortageCount`, and `warningCode`. Flutter derives `selectedCount` from `actualQuestionCount` and `isPartial` from `shortageCount > 0`, then displays the required Arabic shortage notice. A zero-question selection remains a Backend error (`INSUFFICIENT_QUESTIONS`); Flutter does not create a local fallback quiz.

## Contract notes

- Interactive option elimination is `BLOCKED_BY_CONTRACT`: the create DTO supports `eliminationEnabled` and answer submission supports `eliminatedOptionUsed`, but no endpoint/payload supplies which incorrect option may safely be removed. Flutter therefore never guesses an option.
- Runtime device verification remains pending until a Backend test environment and test account are available. CONNECTED here means the exact controller/DTO contract is implemented and covered by repository tests, not that device runtime was claimed.