# Statistics + Recommendations Hardening Audit

Date: 2026-07-19
Status: COMPLETE_FOR_SELECTED_PHASE

## Baseline and findings

The existing modules and `StudentDailyActivity` model were reused. The starting implementation exposed basic overview/activity/progress endpoints and question/lesson recommendations, but the dashboard omitted unique/available question counts, study time and overall mastery; it had no consolidated time, performance or question analytics; recommendation visibility did not enforce the complete published hierarchy; and there was no real PostgreSQL E2E suite for this phase.

## Implemented hardening

- Dashboard now reports attempts, distinct attempted questions, available visible questions, correct/wrong totals, accuracy, study time, quiz aggregates, current/best streak, overall mastery, points, level and rank.
- Added persisted daily/time analytics with aggregate totals.
- Added deterministic best/weak Subject, Unit and Lesson performance projections.
- Added difficulty distribution, weighted average response time and mistake-frequency analytics.
- Reused the central `visibleQuestionWhere` policy so analytics and recommendations exclude draft, inactive, unpublished, deleted or hidden-ancestor content.
- Added explainable `REVIEW_LESSON`, `TAKE_UNIT_QUIZ` and `FOCUS_SUBJECT` actions based on mastery, accuracy, mistakes and activity-derived progress.
- Subject-scoped recommendations now reject hidden or unavailable subjects and remain JWT-owner scoped.
- Student payloads continue to omit answer keys and internal correctness fields.

## API additions

- `GET /api/v1/statistics/performance`
- `GET /api/v1/statistics/questions`
- `GET /api/v1/statistics/time-analytics`
- `GET /api/v1/recommendations/actions`

Existing Statistics and Recommendations APIs remain compatible.

## Migration decision

No migration was required. The existing progress, activity and quiz records are sufficient sources of truth. All 14 migrations remain unchanged and applied; Prisma validate/status/diff report a valid schema, current database and no difference.

## Verification

- Format, lint and build: pass.
- Unit: 23 suites / 118 tests, all pass.
- PostgreSQL E2E: 10 suites / 54 tests, all pass, including the new real Nest/Auth/JWT/Prisma Statistics + Recommendations suite.
- The new suite proves persisted calculations, owner isolation, explainable recommendations, hidden-subject rejection, answer-key safety and Swagger registration.

## Remaining honest limits

- Analytics are computed on demand from normalized progress/activity rows; large deployments may later add asynchronous rollups without changing the API contract.
- Recommendation scoring is deterministic and explainable rather than ML-based; the current data volume does not justify a separate model.