# Current Backend Audit

> Audit date: 2026-07-18 (Asia/Riyadh)
> Baseline: `b792ebe0c3198b01c41a03bb22da87e0392f61cc`
> Audit branch: `audit-and-next-phase`
> Stack observed: Node.js 22.17.1; NestJS common/core 11.1.28; Prisma/Client 7.8.0; PostgreSQL 16.13; TypeScript 5.9.3; pg 8.22.0; Jest 30.4.2; Supertest 7.2.2; Socket.IO 4.8.3; optional Redis.

## Executive summary

The repository is a substantial modular backend rather than a skeleton: 15 feature modules, 38 Prisma models, 22 enums, 12 linear migrations after this phase, and 165 documented HTTP operations across 133 Swagger paths. The baseline compiled and all baseline tests passed. PostgreSQL was reachable, all baseline migrations were applied, and Prisma reported no schema drift.

The first incomplete dependency level is **Education Foundation Hardening**. The existing Education CRUD worked, but student-facing data contained placeholders, favorites were non-persistent, advertised sorting modes were not implemented, hierarchy visibility was incomplete, and reorder/publish invariants allowed cross-parent or orphan-visible states. This branch implements only that dependency level.

The codebase remains unsuitable for an unqualified production-readiness claim. Four legacy E2E suites still replace feature services or Prisma with mocks, but this phase adds a fail-closed PostgreSQL runner and a real Education HTTP/Prisma suite against question_bank_test. Cross-module database integration, distributed Redis/Socket.IO behavior, restrictive CORS, and production configuration validation remain future work.

## Top findings

| Priority | Finding | Evidence / impact | Disposition |
|---|---|---|---|
| P1 | Most non-Education E2E surfaces remain mocked | The guarded PostgreSQL suite proves Education/Auth registration paths, but Content, Quiz, Progress, Gamification and Challenges still lack comparable DB integration | Extend integration coverage by dependency level |
| P1 | Quiz completion event is unreachable | `QuizAttemptsService.complete` returns before the gamification call | Next Quiz hardening phase |
| P1 | Education student projections were placeholders | question totals, progress, and favorite state were hard-coded | Fixed in selected phase |
| P1 | Education hierarchy visibility was porous | child visibility did not consistently require active/non-deleted/published parents | Fixed in selected phase |
| P1 | Education publishing/reorder invariants were incomplete | children could be published under inactive parents; reorder could cross parents | Fixed in selected phase |
| P1 | Production Redis can silently degrade to process memory | missing `REDIS_HOST` logs a warning and continues; unsafe for multi-instance state/rate coordination | Production infrastructure phase |
| P1 | CORS is permissive | HTTP and Socket.IO accept `origin: true` | Production infrastructure phase |
| P2 | Challenge real-time state is process-local | reconnect/multi-instance guarantees depend on memory/optional Redis behavior | Challenge hardening phase |
| P2 | Seed/source Arabic text contains mojibake/question marks | corrupt fixtures can enter development/test data | Data-quality remediation |
| P2 | TypeScript strictness is partial | `noImplicitAny: false`, `strictBindCallApply: false` | Incremental infrastructure hardening |

## Audit method and evidence

- Read the complete Prisma schema, migrations, AppModule registration, controllers, services, DTOs, guards, tests, configuration, seed, and package scripts.
- Ran `prisma format`, `prisma validate`, `prisma generate`, `prisma migrate status`, and migrate diff.
- Queried the local PostgreSQL catalog without printing credentials.
- Built and started the production artifact on port 3100.
- Verified `GET /api/v1/health` returned HTTP 200 with `database: connected`.
- Verified `/api/docs` returned HTTP 200 and `/api/docs-json` exposed 133 paths / 165 operations.
- Ran formatting, lint, build, unit tests, and E2E tests.
- No migrations were reset, edited, squashed, or deleted. No `db push` was used.

## Dependency-level decision

| Level | Capability | Audit state | Key reason |
|---:|---|---|---|
| 1 | Auth and Users | FUNCTIONAL_WITH_GAPS | Robust service/guard coverage and real registration/JWT use in Education E2E; full auth lifecycle DB E2E remains incomplete |
| 2 | Education Foundation | INCOMPLETE at baseline -> IMPLEMENTED in this branch | Placeholder projections and missing hierarchy/persistence invariants |
| 3 | Content / Questions / Exams | FUNCTIONAL_WITH_GAPS | Broad CRUD/workflows; mostly mocked E2E and synchronous import concerns |
| 4 | Quiz Engine | PARTIAL | Unreachable gamification side effect; no HTTP/DB E2E |
| 5 | Student Progress | FUNCTIONAL_WITH_GAPS | Service coverage present; no real DB E2E |
| 6 | Statistics / Recommendations | FUNCTIONAL_WITH_GAPS | Query services exist; limited integration/performance evidence |
| 7 | Gamification | FUNCTIONAL_WITH_GAPS | Core services exist; quiz event integration defect |
| 8 | Updates / Notifications / Redis | PARTIAL | Memory fallback and provider/distributed-delivery gaps |
| 9 | Challenges REST / Realtime | PARTIAL | REST/gateway exist; distributed and reconnect guarantees unproven |
| 10 | Production Infrastructure | NOT_COMPLETE | No strict environment validation, restrictive CORS, broad cross-module DB E2E, or multi-instance operational proof |

`SELECTED_NEXT_PHASE=Education Foundation Hardening`

## Module matrix

| Module | Prisma models | Controllers | Services | Routes | Unit tests | E2E tests | Swagger | Security | Persistence | Status | Problems | Recommended action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| App / Common / Health | none | AppController, HealthController | AppService | root/health; see route matrix | App + Health | app mock E2E + runtime health | documented | health public; global JWT otherwise | live Prisma health query | FUNCTIONAL_WITH_GAPS | shallow dependency health; production config gaps | add deep health/config validation in infrastructure phase |
| Auth | User | AuthController | AuthService, JwtStrategy | 6 operations | service + guards | mock lifecycle; real register/JWT path in PG suite | documented | public register/login/refresh; JWT elsewhere | PostgreSQL users and hashed refresh state | FUNCTIONAL_WITH_GAPS | full lifecycle not yet real-DB E2E | extend guarded PG coverage |
| Users | User | UsersController | UsersService | 2 operations | service | mock Auth/Users E2E | documented | JWT self only | PostgreSQL | FUNCTIONAL_WITH_GAPS | no standalone real-DB profile E2E | add cross-user/profile DB tests |
| Education Foundation | Grade, Curriculum, CurriculumGrade, Subject, Unit, Lesson, UserSubjectFavorite plus progress reads | EducationController, SubjectsController, UnitsController, LessonsController, EducationAdminController | 7 Education services | student and admin hierarchy routes; see route matrix | 11 phase tests | 7 mock + 1 real PostgreSQL | documented | JWT students; ADMIN/SUPER_ADMIN writes | PostgreSQL, transactions, unique favorite key | COMPLETE | broader load/concurrency coverage remains | proceed to Question Bank dependency level |
| Content / Question Bank | Source, ReadingPassage, Question, QuestionOption, QuestionReview, QuestionImportJob | source, passage, question and import controllers | corresponding services | public/student/admin content routes | question/import tests | mock content E2E | documented | JWT; reviewer/admin workflow roles | PostgreSQL | FUNCTIONAL_WITH_GAPS | imports are synchronous; no real DB E2E | harden Question Bank as next phase |
| Exam Models | ExamModel, ExamModelQuestion | ExamModelsController, ExamModelsAdminController | ExamModelsService | student/admin model routes | service | mock content E2E | documented | JWT student; admin writes | PostgreSQL transactions/unique joins | FUNCTIONAL_WITH_GAPS | no real DB E2E | include after Question Bank hardening |
| Quiz | QuizAttempt, QuizAttemptQuestion, QuizAnswer | QuizAttemptsController | QuizAttemptsService, QuestionSelectionService | 7 operations | service | none | documented | JWT ownership | PostgreSQL transactions | PARTIAL | unreachable gamification call after return; no DB E2E | Quiz Engine hardening after content/exams |
| Progress | StudentQuestionProgress, StudentLessonProgress, StudentUnitProgress, StudentSubjectProgress, SavedQuestion | MistakesController, SavedQuestionsController | progress/mastery/mistakes/saved services | 9 operations | phase tests | none | documented | JWT ownership | PostgreSQL upserts/aggregates | FUNCTIONAL_WITH_GAPS | integration/concurrency proof absent | add guarded PG tests in its phase |
| Statistics | StudentDailyActivity plus progress aggregates | StatisticsController | StatisticsService | 9 operations | service | none | documented | JWT self | PostgreSQL aggregates | FUNCTIONAL_WITH_GAPS | performance/query-plan evidence absent | load-test after progress |
| Recommendations | reads content/progress | RecommendationsController | RecommendationService | 4 operations | service | none | documented | JWT self | PostgreSQL reads | FUNCTIONAL_WITH_GAPS | algorithm integration coverage limited | validate after progress/statistics |
| Gamification | UserPoints, PointTransaction, Achievement, UserAchievement, DailyTaskDefinition, UserDailyTask, UserStreak | GamificationController, AchievementsController, DailyTasksController | points/levels/events/tasks/streak services | 7 operations | phase tests | none | documented | JWT self | PostgreSQL ledger/idempotency keys | FUNCTIONAL_WITH_GAPS | Quiz completion event defect | repair during Quiz/Gamification phase |
| Leaderboards | UserPoints/User | LeaderboardsController | LeaderboardsService | 2 operations | service | none | documented | JWT | PostgreSQL + optional cache | FUNCTIONAL_WITH_GAPS | scale/cache behavior unproven | load-test and Redis harden |
| Updates | AppUpdate | UpdatesController, UpdatesAdminController | UpdatesService | 8 operations | service | none | documented | JWT readers; admin writes | PostgreSQL soft delete/publish | FUNCTIONAL_WITH_GAPS | no HTTP/DB E2E | add in Updates phase |
| Notifications | Notification | NotificationsController | NotificationsService, provider abstraction | 5 operations | service | none | documented | JWT ownership | PostgreSQL | FUNCTIONAL_WITH_GAPS | delivery/retry provider incomplete | add outbox/retry in its phase |
| Redis | none | none | RedisService | no direct route | service | indirect runtime | n/a | configuration based | Redis or process-memory fallback | PARTIAL | silent production memory fallback | fail closed/configure health |
| Challenges / Socket.IO | Challenge, ChallengeParticipant, ChallengeQuestion, ChallengeAnswer | ChallengesController, ChallengeGateway | challenge/gameplay/scoring/matchmaking services | 11 REST + 6 socket messages | REST/matchmaking/gateway | none | REST documented | JWT REST and socket auth | PostgreSQL plus process/Redis state | PARTIAL | reconnect and multi-instance persistence unproven | Challenge hardening |
## Prisma and migration audit

### Migration matrix

| Migration | Models affected | Applied status | Schema match | Risk | Notes |
|---|---|---|---|---|---|
| 20260716101645_init_users | User | development + test | yes | MEDIUM | baseline identity table and indexes |
| 20260716105419_auth_refresh_tokens | User auth/token fields | development + test | yes | LOW | additive refresh revocation fields |
| 20260717000000_education_content | Grade, Curriculum, CurriculumGrade, Subject, Unit, Lesson | development + test | yes | HIGH | hierarchy, soft delete and publishing foundation |
| 20260717010000_questions_and_passages | Source, ReadingPassage, Question, QuestionOption, QuestionReview | development + test | yes | HIGH | content/review relations and constraints |
| 20260717020000_imports_and_exam_models | QuestionImportJob, ExamModel, ExamModelQuestion | development + test | yes | MEDIUM | import jobs and ordered exam membership |
| 20260717030000_quiz_engine | QuizAttempt, QuizAttemptQuestion, QuizAnswer | development + test | yes | HIGH | attempt ownership, snapshots and answers |
| 20260717040000_student_progress_and_saved | four progress models, SavedQuestion | development + test | yes | HIGH | user aggregates, mastery and saved content |
| 20260717050000_statistics_daily_activity | StudentDailyActivity | development + test | yes | LOW | daily unique aggregate |
| 20260717060000_gamification | points, transactions, achievements, tasks, streak | development + test | yes | MEDIUM | idempotent ledger and daily uniqueness |
| 20260717070000_updates_and_notifications | AppUpdate, Notification | development + test | yes | MEDIUM | publish lifecycle and user-owned notifications |
| 20260717080000_challenges_rest | Challenge, ChallengeParticipant, ChallengeQuestion, ChallengeAnswer | development + test | yes | HIGH | multiplayer lifecycle and ordered questions |
| 20260718090000_education_foundation_hardening | UserSubjectFavorite | development + test | yes | LOW | additive table; unique user+subject; cascade FKs; generated from schema diff |

Verification: prisma migrate dev reported already in sync; migrate status reported 12 migrations and an up-to-date development database; the guarded E2E runner reported the same 12 migrations current on question_bank_test; migrate diff reported **No difference detected**. No reset, db push, migration deletion, or migration rewrite occurred.
### Model inventory

All **38 models** have UUID/string primary keys. "Soft" denotes a deletedAt lifecycle; otherwise deletion behavior is relational/hard unless a service adds policy.

| Model | Enums | Relations | Unique constraints | Indexes | Soft delete | Created by migration | Services using it | Tests covering it | Risk |
|---|---|---|---|---|---|---|---|---|---|
| User | UserRole, CompanionType | parent of auth, progress, gamification, notifications, challenges, favorites | username; phone | role+active | yes | init_users / auth_refresh_tokens | Auth, Users and most user-scoped services | Auth/Users units, mock E2E, real PG registration | HIGH |
| Grade | none | CurriculumGrade, Subject | slug | name+deleted; order+active+deleted | yes | education_content | Grades, Subjects, EducationContext | Education unit/mock/real PG | MEDIUM |
| Curriculum | none | CurriculumGrade, Subject | slug | country+active+deleted; name+deleted | yes | education_content | Curricula, Subjects, EducationContext | Education unit/mock/real PG | MEDIUM |
| CurriculumGrade | none | Curriculum, Grade | curriculum+grade | grade+active | no | education_content | Subjects, EducationContext | Education unit/real PG | LOW |
| Subject | none | curriculum, grade, units, lessons, content, progress, favorites, challenges | curriculum+grade+slug | hierarchy+order; publish state; name | yes | education_content | Education, Content, Quiz, Progress, Challenges | Education unit/mock/real PG | HIGH |
| Unit | none | subject, lessons, questions, progress, quiz, challenges | subject+slug | subject+order; publish state | yes | education_content | Units, Lessons, Content, Quiz, Progress | Education unit/mock/real PG | MEDIUM |
| Lesson | none | subject, unit, questions, progress, quiz, challenges | unit+slug | subject/unit order; publish state | yes | education_content | Lessons, Content, Quiz, Progress | Education unit/mock/real PG | MEDIUM |
| Source | SourceType | passages, questions, exam models | none | type+year; active+deleted; name | yes | questions_and_passages | Sources, Content | content unit/mock E2E | MEDIUM |
| ReadingPassage | QuestionDifficulty | subject, source, creator/reviewer, questions | none | subject+publish; source | yes | questions_and_passages | ReadingPassages, Questions | indirect content tests/mock E2E | MEDIUM |
| Question | QuestionType, QuestionDifficulty, QuestionReviewStatus, QuestionOrigin | hierarchy, source, passage, options, reviews, quiz/progress/challenge | none | hierarchy; review/type/difficulty; publish; fingerprint/date | yes | questions_and_passages | Questions, Imports, Exams, Quiz, Progress, Challenges | Questions units, mock content E2E, real PG fixture | HIGH |
| QuestionImportJob | ImportFileType, ImportStatus | uploader User | none | uploader+date; status+date | no | imports_and_exam_models | QuestionImports | import units/mock content E2E | MEDIUM |
| ExamModel | QuestionDifficulty | subject, source, ordered questions, attempts | slug | subject+publish; source; year+governorate; order | yes | imports_and_exam_models | ExamModels, Quiz | exam units/mock E2E | MEDIUM |
| ExamModelQuestion | none | ExamModel, Question | model+question; model+order | question | no | imports_and_exam_models | ExamModels | exam units/mock E2E | LOW |
| QuestionOption | none | Question, selected QuizAnswers | question+order | question | no | questions_and_passages | Questions, Quiz | question/quiz units | MEDIUM |
| QuestionReview | QuestionReviewStatus | Question, reviewer User | none | question+date; reviewer+date | no | questions_and_passages | Questions | question units | MEDIUM |
| QuizAttempt | QuizScope, QuizAttemptStatus, QuizTimingMode, ExplanationMode | user, optional scope nodes/model, questions, answers | none | user+status+date; user+subject+date; expiry+status | status lifecycle | quiz_engine | QuizAttempts, Progress/Gamification integration | quiz units | HIGH |
| QuizAttemptQuestion | none | attempt, question | attempt+question; attempt+order | question | no | quiz_engine | QuizAttempts, QuestionSelection | quiz units | HIGH |
| QuizAnswer | none | attempt, question, selected option | attempt+question | question+date; selected option | no | quiz_engine | QuizAttempts, Progress | quiz units | HIGH |
| StudentQuestionProgress | none | user, question | user+question | mastery/wrong; question; user+last answer | no | student_progress_and_saved | Progress, Mistakes, Recommendations | progress units | MEDIUM |
| StudentLessonProgress | none | user, lesson | user+lesson | lesson; user+activity | no | student_progress_and_saved | Progress, Education projections | progress + Education unit/real PG | MEDIUM |
| StudentUnitProgress | none | user, unit | user+unit | unit; user+activity | no | student_progress_and_saved | Progress, Education projections | progress + Education unit/real PG | MEDIUM |
| StudentSubjectProgress | none | user, subject | user+subject | subject; user+activity | no | student_progress_and_saved | Progress, Education, Statistics, Recommendations | progress + Education unit/real PG | MEDIUM |
| SavedQuestion | none | user, question, optional hierarchy | user+question | user+date; question | no | student_progress_and_saved | SavedQuestions, Quiz collections | progress units | MEDIUM |
| StudentDailyActivity | none | user | user+date | user+date | no | statistics_daily_activity | Statistics | statistics units | LOW |
| UserPoints | none | user | user | none beyond unique | no | gamification | Points, Levels, Leaderboards | gamification/leaderboard units | MEDIUM |
| PointTransaction | PointType | user | idempotencyKey | user+date; type+date | ledger | gamification | Points, GamificationEvents | gamification units | HIGH |
| Achievement | AchievementCategory, AchievementConditionType | user achievements | key | category+active+order | active flag | gamification | Achievements, GamificationEvents | gamification units | LOW |
| UserAchievement | none | user, achievement | user+achievement | user+unlock | no | gamification | Achievements | gamification units | LOW |
| DailyTaskDefinition | DailyTaskType | user daily tasks | key | active+type | active flag | gamification | DailyTasks | gamification units | LOW |
| UserDailyTask | none | user, task definition | user+definition+date | user+date+complete | daily lifecycle | gamification | DailyTasks | gamification units | MEDIUM |
| UserStreak | none | user | user | none beyond unique | no | gamification | Streak, GamificationEvents | gamification units | MEDIUM |
| AppUpdate | UpdateCategory | creator User | none | publish+date+deleted; category+date | yes | updates_and_notifications | Updates | updates units | LOW |
| Notification | NotificationType | user | none | user+read+date; user+date | no | updates_and_notifications | Notifications | notification units | MEDIUM |
| Challenge | ChallengeMode, ChallengeStatus, QuestionDifficulty | creator, winner, subject/unit/lesson, participants/questions/answers | inviteCode | status+mode+date; subject+difficulty+status; expiry+status | status lifecycle | challenges_rest | Challenges, Matchmaking, Gameplay, Scoring | challenge units/gateway | HIGH |
| ChallengeParticipant | ChallengeParticipantStatus | challenge, user, answers | challenge+user | user+join; challenge+status | no | challenges_rest | Challenges, Matchmaking, Gameplay | challenge units | HIGH |
| ChallengeQuestion | none | challenge, question | challenge+question; challenge+order | question | no | challenges_rest | ChallengeGameplay | challenge units | HIGH |
| ChallengeAnswer | none | challenge, participant, question | participant+question | challenge+date; question | no | challenges_rest | ChallengeGameplay, Scoring | challenge units | HIGH |
| UserSubjectFavorite | none | user, subject with cascade delete | user+subject | user+createdAt; subject | no | education_foundation_hardening | SubjectsService | Education unit/mock/real PG | LOW |
### Enum inventory

22 enums: `UserRole`, `CompanionType`, `SourceType`, `QuestionType`, `QuestionDifficulty`, `QuestionReviewStatus`, `ImportFileType`, `ImportStatus`, `QuizScope`, `QuizAttemptStatus`, `QuizTimingMode`, `ExplanationMode`, `QuestionOrigin`, `PointType`, `AchievementCategory`, `AchievementConditionType`, `DailyTaskType`, `UpdateCategory`, `NotificationType`, `ChallengeMode`, `ChallengeStatus`, and `ChallengeParticipantStatus`.

## Route matrix

Runtime source of truth: Swagger from the built production artifact on port 3100. It exposed **133 paths and 165 operations**. Every operation below was registered during boot; access and role columns combine Swagger security metadata with controller role decorators.

| Method | Path | Controller | Required role | Public/protected | DTO / query | Ownership check | Swagger | Unit test | E2E test | Runtime verification | Completion |
|---|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/quiz-attempts` | QuizAttemptsController | Authenticated user | Protected | CreateQuizAttemptDto | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| GET | `/api/v1/quiz-attempts` | QuizAttemptsController | Authenticated user | Protected | Query: page, limit, status, scope, subjectId, from, to | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| POST | `/api/v1/quiz-attempts/{attemptId}/answers` | QuizAttemptsController | Authenticated user | Protected | SubmitQuizAnswerDto | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| POST | `/api/v1/quiz-attempts/{attemptId}/complete` | QuizAttemptsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| POST | `/api/v1/quiz-attempts/{attemptId}/abandon` | QuizAttemptsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| GET | `/api/v1/quiz-attempts/{attemptId}/result` | QuizAttemptsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| GET | `/api/v1/quiz-attempts/{id}` | QuizAttemptsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| GET | `/api/v1/mistakes` | MistakesController | Authenticated user | Protected | Query: page, limit, subjectId, unitId, lessonId, difficulty, minWrongCount, mastered, reviewed, sort | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/mistakes/quiz` | MistakesController | Authenticated user | Protected | CreateCollectionQuizDto | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/mistakes/{questionId}` | MistakesController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/mistakes/{questionId}/mark-mastered` | MistakesController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/saved-questions` | SavedQuestionsController | Authenticated user | Protected | Query: page, limit, subjectId, unitId, lessonId, difficulty, search | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/saved-questions/quiz` | SavedQuestionsController | Authenticated user | Protected | CreateCollectionQuizDto | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/saved-questions/{questionId}` | SavedQuestionsController | Authenticated user | Protected | SavedQuestionNoteDto | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| PATCH | `/api/v1/saved-questions/{questionId}` | SavedQuestionsController | Authenticated user | Protected | SavedQuestionNoteDto | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| DELETE | `/api/v1/saved-questions/{questionId}` | SavedQuestionsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/gamification/points` | GamificationController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/gamification/points/history` | GamificationController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/achievements` | AchievementsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/achievements/my` | AchievementsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/achievements/{id}/mark-seen` | AchievementsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/daily-tasks/today` | DailyTasksController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/daily-tasks/{id}/claim` | DailyTasksController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/notifications` | NotificationsController | Authenticated user | Protected | Query: page, limit | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/notifications/unread-count` | NotificationsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/notifications/read-all` | NotificationsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/notifications/{id}/read` | NotificationsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| DELETE | `/api/v1/notifications/{id}` | NotificationsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/health` | HealthController | Authenticated user | Protected | None | Authenticated published read | Documented | Covered | Mock app suite + runtime | HTTP 200 + DB connected | COMPLETE |
| GET | `/api/v1/users/me` | UsersController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | Mock; register/JWT also real PG | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| PATCH | `/api/v1/users/me` | UsersController | Authenticated user | Protected | UpdateProfileDto | JWT user / service ownership | Documented | Covered | Mock; register/JWT also real PG | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/auth/register` | AuthController | Authenticated user | Protected | RegisterDto | Authenticated published read | Documented | Covered | Mock; register/JWT also real PG | Real PostgreSQL E2E | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/auth/login` | AuthController | Authenticated user | Protected | LoginDto | Authenticated published read | Documented | Covered | Mock; register/JWT also real PG | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/auth/refresh` | AuthController | Authenticated user | Protected | RefreshTokenDto | Authenticated published read | Documented | Covered | Mock; register/JWT also real PG | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/auth/logout` | AuthController | Authenticated user | Protected | None | Authenticated published read | Documented | Covered | Mock; register/JWT also real PG | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/auth/me` | AuthController | Authenticated user | Protected | None | Authenticated published read | Documented | Covered | Mock; register/JWT also real PG | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/auth/change-password` | AuthController | Authenticated user | Protected | ChangePasswordDto | Authenticated published read | Documented | Covered | Mock; register/JWT also real PG | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/education/context` | EducationController | Authenticated user | Protected | None | JWT user + published hierarchy | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| GET | `/api/v1/subjects` | SubjectsController | Authenticated user | Protected | Query: page, limit, search, favorite, sort | JWT user + published hierarchy | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/subjects/{subjectId}` | SubjectsController | Authenticated user | Protected | None | JWT user + published hierarchy | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| GET | `/api/v1/subjects/{subjectId}/units` | SubjectsController | Authenticated user | Protected | None | JWT user + published hierarchy | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/subjects/{subjectId}/favorite` | SubjectsController | Authenticated user | Protected | None | JWT user + published hierarchy | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| DELETE | `/api/v1/subjects/{subjectId}/favorite` | SubjectsController | Authenticated user | Protected | None | JWT user + published hierarchy | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/units/{unitId}` | UnitsController | Authenticated user | Protected | None | JWT user + published hierarchy | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| GET | `/api/v1/units/{unitId}/lessons` | UnitsController | Authenticated user | Protected | None | JWT user + published hierarchy | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| GET | `/api/v1/lessons/{lessonId}` | LessonsController | Authenticated user | Protected | None | JWT user + published hierarchy | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/grades` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | CreateGradeDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/admin/grades` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/admin/grades/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| PATCH | `/api/v1/admin/grades/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | UpdateGradeDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| DELETE | `/api/v1/admin/grades/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/grades/{id}/restore` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/curricula` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | CreateCurriculumDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/admin/curricula` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| PATCH | `/api/v1/admin/curricula/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | UpdateCurriculumDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| DELETE | `/api/v1/admin/curricula/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/curricula/{id}/restore` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/subjects` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | CreateSubjectDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/admin/subjects` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit, search, favorite, sort | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/admin/subjects/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| PATCH | `/api/v1/admin/subjects/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | UpdateSubjectDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| DELETE | `/api/v1/admin/subjects/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/subjects/{id}/restore` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/subjects/{id}/publish` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| POST | `/api/v1/admin/subjects/{id}/unpublish` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| POST | `/api/v1/admin/units` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | CreateUnitDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/admin/units` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| POST | `/api/v1/admin/units/reorder` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | ReorderItemsDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| PATCH | `/api/v1/admin/units/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | UpdateUnitDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| DELETE | `/api/v1/admin/units/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/units/{id}/restore` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/units/{id}/publish` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| POST | `/api/v1/admin/units/{id}/unpublish` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| POST | `/api/v1/admin/lessons` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | CreateLessonDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/admin/lessons` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| POST | `/api/v1/admin/lessons/reorder` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | ReorderItemsDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| PATCH | `/api/v1/admin/lessons/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | UpdateLessonDto | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| DELETE | `/api/v1/admin/lessons/{id}` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/lessons/{id}/restore` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Boot + Swagger registration | COMPLETE |
| POST | `/api/v1/admin/lessons/{id}/publish` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| POST | `/api/v1/admin/lessons/{id}/unpublish` | EducationAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered (phase) | Mock + real PG phase suite | Real PostgreSQL E2E | COMPLETE |
| GET | `/api/v1/sources` | SourcesController | Authenticated user | Protected | Query: page, limit, search, subjectId, unitId, lessonId, sourceId, readingPassageId, type, difficulty, reviewStatus, origin, isPublished, isActive, hasLesson, hasPassage, createdById, reviewedById, year, sort | Authenticated published read | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/sources` | SourcesAdminController | ADMIN/SUPER_ADMIN | Protected | CreateSourceDto | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/sources` | SourcesAdminController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit, search, subjectId, unitId, lessonId, sourceId, readingPassageId, type, difficulty, reviewStatus, origin, isPublished, isActive, hasLesson, hasPassage, createdById, reviewedById, year, sort | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/sources/{id}` | SourcesAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| PATCH | `/api/v1/admin/sources/{id}` | SourcesAdminController | ADMIN/SUPER_ADMIN | Protected | UpdateSourceDto | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| DELETE | `/api/v1/admin/sources/{id}` | SourcesAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/sources/{id}/restore` | SourcesAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/reading-passages` | ReadingPassagesController | ADMIN/SUPER_ADMIN | Protected | CreateReadingPassageDto | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/reading-passages` | ReadingPassagesController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit, search, subjectId, unitId, lessonId, sourceId, readingPassageId, type, difficulty, reviewStatus, origin, isPublished, isActive, hasLesson, hasPassage, createdById, reviewedById, year, sort | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/reading-passages/{id}` | ReadingPassagesController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| PATCH | `/api/v1/admin/reading-passages/{id}` | ReadingPassagesController | ADMIN/SUPER_ADMIN | Protected | UpdateReadingPassageDto | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| DELETE | `/api/v1/admin/reading-passages/{id}` | ReadingPassagesController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/reading-passages/{id}/restore` | ReadingPassagesController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/reading-passages/{id}/publish` | ReadingPassagesController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/reading-passages/{id}/unpublish` | ReadingPassagesController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Partial/indirect | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/questions/{id}` | QuestionsController | Authenticated user | Protected | None | Authenticated published read | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/questions/{id}/similar` | QuestionsController | Authenticated user | Protected | None | Authenticated published read | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/questions` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | CreateQuestionDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/questions` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit, search, subjectId, unitId, lessonId, sourceId, readingPassageId, type, difficulty, reviewStatus, origin, isPublished, isActive, hasLesson, hasPassage, createdById, reviewedById, year, sort | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/questions/{id}` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| PATCH | `/api/v1/admin/questions/{id}` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | UpdateQuestionDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| DELETE | `/api/v1/admin/questions/{id}` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/questions/{id}/restore` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/questions/{id}/submit-review` | QuestionsAdminController | REVIEWER/ADMIN/SUPER_ADMIN | Protected | ReviewNoteDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/questions/{id}/approve` | QuestionsAdminController | REVIEWER/ADMIN/SUPER_ADMIN | Protected | ReviewNoteDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/questions/{id}/reject` | QuestionsAdminController | REVIEWER/ADMIN/SUPER_ADMIN | Protected | RejectQuestionDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/questions/{id}/archive` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | ReviewNoteDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/questions/{id}/publish` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/questions/{id}/unpublish` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/questions/bulk-action` | QuestionsAdminController | ADMIN/SUPER_ADMIN | Protected | QuestionBulkActionDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/exam-models` | ExamModelsController | Authenticated user | Protected | Query: page, limit, subjectId, sourceId, year, governorate, difficulty, isOfficial, search | Authenticated published read | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/exam-models/{id}` | ExamModelsController | Authenticated user | Protected | None | Authenticated published read | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/exam-models` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | CreateExamModelDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/exam-models` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit, subjectId, sourceId, year, governorate, difficulty, isOfficial, search | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/exam-models/{id}` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| PATCH | `/api/v1/admin/exam-models/{id}` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | UpdateExamModelDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| DELETE | `/api/v1/admin/exam-models/{id}` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/exam-models/{id}/restore` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/exam-models/{id}/publish` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/exam-models/{id}/unpublish` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/exam-models/{id}/questions` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | AddExamQuestionDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/exam-models/{id}/questions/bulk` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | BulkAddExamQuestionsDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| PATCH | `/api/v1/admin/exam-models/{id}/questions/reorder` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | ReorderExamQuestionsDto | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| DELETE | `/api/v1/admin/exam-models/{id}/questions/{questionId}` | ExamModelsAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/question-imports/upload` | QuestionImportsController | ADMIN/SUPER_ADMIN | Protected | Inline body | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/question-imports/{id}/validate` | QuestionImportsController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/question-imports/{id}/execute` | QuestionImportsController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/question-imports` | QuestionImportsController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/question-imports/{id}/errors` | QuestionImportsController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/question-imports/{id}` | QuestionImportsController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | Mock content suite | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/statistics/overview` | StatisticsController | Authenticated user | Protected | Query: range, from, to | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/statistics/activity` | StatisticsController | Authenticated user | Protected | Query: range, from, to | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/statistics/subjects` | StatisticsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/statistics/subjects/{subjectId}` | StatisticsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/statistics/units/{unitId}` | StatisticsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/statistics/lessons/{lessonId}` | StatisticsController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/statistics/accuracy-trend` | StatisticsController | Authenticated user | Protected | Query: range, from, to | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/statistics/time-distribution` | StatisticsController | Authenticated user | Protected | Query: range, from, to | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/statistics/heatmap` | StatisticsController | Authenticated user | Protected | Query: range, from, to | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/recommendations` | RecommendationsController | Authenticated user | Protected | Query: subjectId, limit | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/recommendations/weaknesses` | RecommendationsController | Authenticated user | Protected | Query: subjectId, limit | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/recommendations/lessons` | RecommendationsController | Authenticated user | Protected | Query: subjectId, limit | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/recommendations/weakness-quiz` | RecommendationsController | Authenticated user | Protected | CreateCollectionQuizDto | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/leaderboards` | LeaderboardsController | Authenticated user | Protected | Query: page, limit, period, scope | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/leaderboards/me` | LeaderboardsController | Authenticated user | Protected | Query: page, limit, period, scope | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/updates` | UpdatesController | Authenticated user | Protected | Query: page, limit | Authenticated published read | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/updates/{id}` | UpdatesController | Authenticated user | Protected | None | Authenticated published read | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/admin/updates` | UpdatesAdminController | ADMIN/SUPER_ADMIN | Protected | Query: page, limit | Role-gated admin resource | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/updates` | UpdatesAdminController | ADMIN/SUPER_ADMIN | Protected | CreateAppUpdateDto | Role-gated admin resource | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| PATCH | `/api/v1/admin/updates/{id}` | UpdatesAdminController | ADMIN/SUPER_ADMIN | Protected | UpdateAppUpdateDto | Role-gated admin resource | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| DELETE | `/api/v1/admin/updates/{id}` | UpdatesAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/updates/{id}/publish` | UpdatesAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| POST | `/api/v1/admin/updates/{id}/unpublish` | UpdatesAdminController | ADMIN/SUPER_ADMIN | Protected | None | Role-gated admin resource | Documented | Covered | None | Boot + Swagger registration | FUNCTIONAL_WITH_GAPS |
| GET | `/api/v1/challenges/modes` | ChallengesController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| POST | `/api/v1/challenges/matchmaking` | ChallengesController | Authenticated user | Protected | MatchmakingDto | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| GET | `/api/v1/challenges/history` | ChallengesController | Authenticated user | Protected | Query: page, limit, status, mode | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| POST | `/api/v1/challenges` | ChallengesController | Authenticated user | Protected | CreateChallengeDto | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| GET | `/api/v1/challenges` | ChallengesController | Authenticated user | Protected | Query: page, limit, status, mode | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| GET | `/api/v1/challenges/{id}` | ChallengesController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| POST | `/api/v1/challenges/{id}/join` | ChallengesController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| POST | `/api/v1/challenges/{id}/leave` | ChallengesController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| POST | `/api/v1/challenges/{id}/ready` | ChallengesController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| GET | `/api/v1/challenges/{id}/result` | ChallengesController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |
| POST | `/api/v1/challenges/{id}/rematch` | ChallengesController | Authenticated user | Protected | None | JWT user / service ownership | Documented | Covered | None | Boot + Swagger registration | PARTIAL |

Selected-phase Swagger assertions explicitly cover subject favorites and unit/lesson publish/unpublish routes. The real PostgreSQL suite exercises admin hierarchy creation/publishing, personalized subject reads, persisted favorites, hierarchy hiding, and cross-parent reorder rejection.

## Security audit
### Finding matrix

| Area | Finding | Evidence | Severity | Action |
|---|---|---|---|---|
| IDOR | No confirmed IDOR in audited self-scoped services; later modules rely on service ownership checks | JWT user IDs are injected, not accepted from bodies; quiz/progress/notifications/challenges check ownership | MEDIUM residual | add real cross-user E2E per later phase |
| Answer leakage | Student-safe question/quiz mappers exist; full real-DB leakage proof is absent outside Education | content/quiz mapper and unit coverage | HIGH residual | add published/unpublished and correct-answer leakage PG tests |
| Role guards | Admin Education/content/update/import routes are role-gated | controller Roles decorators and 401/403 tests | LOW | retain guard regression tests |
| Ownership | Education personalization uses JWT user ID; no body userId trust | CurrentUser decorator through controllers/services | LOW selected phase | continue pattern |
| Raw Prisma errors | Education unique failures map to safe conflict errors; consistency across all modules is not fully proven | education error helpers/services | MEDIUM | centralize Prisma error mapping later |
| Rate limiting | Global throttler exists; distributed behavior is unproven with memory Redis fallback | AppModule/Redis runtime warning | MEDIUM | Redis-backed production verification |
| Overexposed fields | Student Education mappers return curated fields, counts and progress only | education.mapper.ts | LOW selected phase | maintain separate admin/student DTO contracts |
| Unsafe logging | No secrets/tokens were printed during audit; structured redaction policy is absent | source/runtime review | MEDIUM | structured logger and redaction |
| Socket authentication | Challenge gateway verifies JWT plus current user/tokenVersion before accepting | gateway connection handler and unit test | MEDIUM | add reconnect/multi-instance E2E |
| CORS | HTTP and Socket.IO use origin: true | app.setup.ts and ChallengeGateway | HIGH production | configurable allowlist |
| Upload risks | Question imports enforce admin role, 2 MB, CSV/JSON extension and 1000 rows; MIME/signature scanning and async isolation remain absent | FileInterceptor and QuestionImportsService | MEDIUM | validate MIME/signature and move processing to jobs |

### Strengths

- Global JWT guard with explicit public metadata.
- Role guard for admin surfaces.
- Access and refresh secrets are separated.
- Refresh tokens are hashed, token versioning supports revocation, and password changes invalidate sessions.
- Argon2 password hashing.
- DTO validation uses transform/whitelist/forbid-non-whitelisted.
- Helmet, compression, cookie parsing, and throttling are configured.
- Ownership checks exist throughout quiz, progress, notifications, and challenge services.
- Soft-deleted/inactive Education parents are now enforced on student reads and publish transitions.

### Gaps

- Production startup does not fail closed when Redis is absent.
- HTTP and Socket.IO CORS are permissive.
- No verified production secrets/config schema beyond runtime reads.
- Real PostgreSQL E2E now covers Education and registration/JWT use, but not the full auth lifecycle or later dependency levels.
- No documented request correlation, structured audit logging, or centralized exception contract.
- TypeScript allows implicit any globally (no new explicit `any` was introduced in this phase).
- Rate limiting and real-time coordination have not been proven across multiple instances.
- Seed Arabic encoding corruption can compromise test/data quality.

## Selected phase implementation audit

The Education hardening implementation:

1. Persists subject favorites in `UserSubjectFavorite` with idempotent favorite/unfavorite behavior.
2. Implements `favorite=true` filtering.
3. Returns real unit, lesson, and question counts.
4. Returns real subject/unit/lesson progress projections.
5. Returns per-user favorite state.
6. Implements all advertised subject sorts: name, question count, progress, and recent activity.
7. Requires active, non-deleted, published parent hierarchy for student visibility.
8. Prevents publishing a subject under inactive/deleted grade or curriculum.
9. Prevents publishing units/lessons beneath invalid or unpublished parents.
10. Automatically unpublishes Education nodes when they are deactivated.
11. Rejects reorder requests containing resources from different parents.
12. Validates lesson subject ownership against its unit.
13. Adds explicit unit/lesson publish and unpublish admin routes.
14. Passes the authenticated user ID through all personalized student reads.
15. Adds focused unit and E2E coverage and Swagger assertions.

No Auth or Users behavior was changed.

## Test audit and verification record

| Gate | Result |
|---|---|
| Prisma validate/format/generate | pass |
| Migration deploy/status/diff | pass; 12 applied; no drift |
| Prettier | pass |
| ESLint | pass |
| Nest build | pass |
| Unit | 21 suites, 74 tests, all pass |
| Unit execution | 10.666 s; 0 skipped; 0 snapshots; no open-handle warning |
| E2E (guarded test database) | 5 suites, 32 tests, all pass |
| E2E execution | 12.7 s; 0 skipped; 0 snapshots; no open-handle warning |
| Mock-only E2E | app, auth/users, content, and Education module suites (4 suites / 31 tests before the real suite) |
| Real database E2E | Education PostgreSQL suite (1 test) through a real Nest app, Auth registration/JWT and Prisma |
| Warnings | Node experimental VM Modules warning for Prisma 7 WASM; runtime warns Redis falls back to memory when REDIS_HOST is absent |
| Education E2E coverage | 11 mock HTTP tests + 1 real PostgreSQL HTTP/Prisma test, all pass |
| Runtime health | HTTP 200, status ok, database connected |
| Swagger UI / JSON | HTTP 200; 133 paths / 165 operations |
| PostgreSQL migration gate | 12 migrations applied/current on question_bank_test |

The E2E command is fail-closed: it requires DATABASE_URL_TEST, rejects the development database and non-_test database names, deploys migrations, enables the Prisma 7 VM-module runtime, and runs Jest serially. The real Education suite exercises Auth registration/JWT, Prisma, HTTP, persisted favorites, progress/count projections, hierarchy visibility, and cross-parent reorder rejection, with cleanup afterward.

## Environment verification

Verified without exposing credentials:

- DATABASE_URL, DATABASE_URL_TEST, and SHADOW_DATABASE_URL are configured locally.
- question_bank_test exists and received all 12 migrations through the guarded runner.
- question_bank_shadow is usable: prisma migrate dev completed with the schema already in sync.
- The runner refuses a missing test URL, a development-database match, or a database name that does not end in _test.
- Test data is created with unique identifiers and removed after the real PostgreSQL suite.

## Recommended backlog after the selected phase

1. Extend the guarded PostgreSQL E2E pattern across Auth lifecycle, Content, Quiz, Progress, Gamification, Notifications, and Challenges.
2. Fix the unreachable Quiz gamification call transactionally and add attempt-completion integration tests.
3. Make production Redis/config/CORS fail closed and environment-specific.
4. Add Content import transaction/load tests and asynchronous job execution.
5. Prove Progress/Gamification idempotency under concurrency.
6. Harden Challenge reconnect and multi-instance Socket.IO coordination.
7. Repair seed Arabic encoding and add fixture validation.
8. Enable stricter TypeScript settings incrementally.

## Scope integrity

Only **Education Foundation Hardening** was implemented. Auth/Users and later dependency levels were audited but not modified. All requested gates, isolated database verification, runtime checks, documentation, and the single feature commit are the completed delivery for this phase.

## Question Bank + Review Workflow Hardening update

The selected Question Bank dependency level is now
COMPLETE_FOR_SELECTED_PHASE. Existing models/controllers/enums were reused.
Central hierarchy, normalization/fingerprint and review-transition policies
were added; Source and Passage contracts were hardened; MCQ/TRUE_FALSE writes,
review history, publication and bulk operations are transactional; and student
question/similar answer safety is proven through real PostgreSQL HTTP E2E.

Prisma reports 12 applied migrations and no schema difference, so no migration
was required. Verification: 22 unit suites / 91 tests; 6 E2E suites / 36 tests
on guarded question_bank_test; Health and Swagger HTTP 200. Full evidence is in
docs/question-bank-hardening-audit.md. The next phase is Exam Models Hardening
and is not implemented.

## Exam Models Hardening update

`SELECTED_NEXT_PHASE=Exam Models Hardening`

`STATUS=COMPLETE_FOR_SELECTED_PHASE`

Exam Models now enforce transactional membership and ordering, stable conflict codes, complete publication prerequisites, published-model immutability, soft delete/restore semantics, current parent/question visibility, and separate student-safe/admin response contracts. Student counts and total points are computed only from currently valid memberships, and answer leakage is covered by real PostgreSQL HTTP E2E.

No schema change was needed: the existing membership and order unique constraints are sufficient. All 12 migrations are applied and Prisma reports no drift. Verification completed with 22 unit suites / 98 tests and 7 E2E suites / 40 tests, plus successful port 3100 Health and Swagger checks. Detailed evidence is in `docs/exam-models-hardening-audit.md`.

The next phase is Quiz Engine Hardening and is intentionally not implemented.

## Quiz Engine Hardening update

`SELECTED_NEXT_PHASE=Quiz Engine Hardening`

`STATUS=COMPLETE_FOR_SELECTED_PHASE`

Quiz attempts now enforce exact scope/ancestry rules, full current hierarchy visibility, bounded owner-safe selection, deterministic Exam Model order, explicit shortage semantics, and immutable versioned question snapshots. Answers are evaluated and scored from those snapshots using server time; identical retries are idempotent, conflicting retries fail safely, and answer/completion effects run transactionally with PostgreSQL concurrency guards.

Completion, auto-completion, expiration, hearts, abandon, results, ownership, progress, and gamification were hardened. The previously unreachable completion gamification path is now reachable and once-only. Student projections and pre-completion/disabled-review results are covered against answer leakage.

No schema change was needed. All 12 migrations are applied and Prisma reports no drift. Verification completed with 23 unit suites / 114 tests and 8 E2E suites / 46 tests, including a real Nest/Auth/JWT/Prisma/PostgreSQL Quiz lifecycle and concurrency suite. Port 3100 Health, Swagger UI, Swagger JSON, and all seven Quiz operations were verified. Detailed evidence is in `docs/quiz-engine-hardening-audit.md`.

The next phase is Student Progress + Mistakes + Saved Questions Hardening and is intentionally not implemented.

## Student Progress + Mistakes + Saved Questions Hardening update

`SELECTED_NEXT_PHASE=Student Progress + Mistakes + Saved Questions Hardening`

`STATUS=COMPLETE_FOR_SELECTED_PHASE`

QuizAnswer is now the repairable answer source of truth. Question progress is deterministically rebuilt from persisted answers, hierarchy aggregates use distinct current question states and visible eligible totals, and the Quiz integration uses the same transaction client sequentially. Internal reconciliation can repair question, lesson, unit, subject, or complete user aggregates without public student rebuild endpoints.

Mistakes and Saved Questions now enforce complete hierarchy visibility, JWT ownership, safe mapped responses, pagination and deterministic filters/sorts. Manual mistake review remains separate from calculated mastery; Saved writes are idempotent, derive hierarchy server-side, normalize notes, and delegate collection quizzes to Quiz Engine.

One structural change was applied as two Prisma migration steps, taking the project from 12 to 14 migrations without modifying prior migrations. Prisma reports no drift. Verification completed with 23 unit suites / 118 tests and 9 E2E suites / 51 tests, including a real PostgreSQL Progress lifecycle/reconciliation/concurrency suite. Detailed evidence is in `docs/student-progress-hardening-audit.md`.

The next phase is Statistics + Recommendations Hardening and is intentionally not implemented.

## Statistics + Recommendations Hardening update

`STATUS=COMPLETE_FOR_SELECTED_PHASE`

Statistics now expose persisted dashboard, time, performance and question analytics, and Recommendations enforce the complete visible-content hierarchy while returning deterministic, explainable lesson/unit/subject actions. No schema change was required. Verification completed with 23 unit suites / 118 tests and 10 PostgreSQL E2E suites / 54 tests. Detailed evidence is in `docs/statistics-recommendations-hardening-audit.md`.

The next phase is Gamification + Achievements + Leaderboards.
## Gamification + Achievements + Leaderboards Hardening update

`STATUS=COMPLETE_FOR_SELECTED_PHASE`

Point and achievement ledgers are now database-idempotent under concurrency. Required badge metrics and seed definitions were completed, zero-reward unlocks notify correctly, and Leaderboards support server-owned XP, points and wins for daily/weekly/monthly/all-time periods. Migration `20260719010000_gamification_hardening` safely extends the achievement enum. Verification: 23 unit suites / 118 tests and 11 PostgreSQL E2E suites / 57 tests. See `docs/gamification-hardening-audit.md`.

The next phase is Challenges Multiplayer Hardening.
## Multiplayer Challenges Hardening update

`STATUS=COMPLETE_FOR_SELECTED_PHASE`

Challenges now support persisted invitations, cancellation, reconnect/sync, race-safe ready transitions, server-timed answers/timeouts, answer-safe state projections and deterministic 2v2 team scoring. Migration `20260719020000_multiplayer_challenges_hardening` adds the team model without modifying history. Verification passed with 23 unit suites / 119 tests and 12 real PostgreSQL E2E suites / 60 tests. See `docs/challenges-hardening-audit.md`.

The next phase is Notifications Hardening.
## Notifications + FCM Hardening update

`STATUS=COMPLETE_FOR_SELECTED_PHASE`

Notifications now provide the five required persisted event families, deterministic deduplication, owner-safe PATCH/read/DELETE APIs, secret-safe device registration and an isolated Firebase Admin provider with disabled-by-default credential gating and invalid-target handling. Migration `20260719030000_notifications_hardening` adds device and delivery state without changing prior migrations. Verification passed with 24 unit suites / 122 tests and 13 PostgreSQL E2E suites / 63 tests. See `docs/notifications-hardening-audit.md`.

The next phase is Production Infrastructure Hardening.
## Production Infrastructure Hardening update

`STATUS=COMPLETE_WITH_EXTERNAL_DOCKER_BUILD_LIMIT`

Production is now fail-closed for secrets, Redis and CORS; distributed throttling and Socket.IO Redis scaling are wired; structured request/error logging and dependency/memory health are active; and Docker/Compose/CI artifacts are present. Verification passed with 25 unit suites / 126 tests, 13 PostgreSQL E2E suites / 63 tests, 17 current migrations/no drift, and live Health/Swagger HTTP 200. Compose configuration validates, while image build remains externally unverified because the local Docker Desktop daemon could not be started. See `docs/production-infrastructure-hardening-audit.md` and `docs/final-backend-audit.md`.