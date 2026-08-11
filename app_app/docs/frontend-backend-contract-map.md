# Frontend–Backend Contract Map

Contract source: NestJS controllers, DTOs, services and mappers at backend commit `9734ec8`. Paths are relative to `/api/v1`.

| Method/path | Flutter data source | Request | Response | Provider/screen | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /auth/register` | `AuthApiRepository` | `RegisterDto` | `AuthResponseDto` | Auth/Register | Connected | Secure tokens; exact companion enum |
| `POST /auth/login` | `AuthApiRepository` | `LoginDto` | `AuthResponseDto` | Auth/Login | Connected | Uses `identifier`; password is never stored/logged |
| POST /auth/google | AuthApiRepository / GoogleSignInService | {idToken} | AuthResponseDto + isNewUser | Auth/Login | Connected | Backend verifies signature, audience, expiry and verified email; no silent linking |
| `POST /auth/refresh` | `AuthInterceptor` | `RefreshTokenDto` | `AuthResponseDto` | Global | Connected | Single-flight and one retry |
| `POST /auth/logout` | `AuthApiRepository` | None | `MessageResponseDto` | Auth/Profile | Connected | Local session always clears |
| `GET /auth/me` | `AuthApiRepository` | None | `PublicUserDto` | Auth/Splash | Connected | Startup restoration |
| `GET/PATCH /users/me` | Profile/Auth data sources | `UpdateProfileDto` | `PublicUserDto` | Profile | Partial | Companion connected; composed stats pending |
| `GET /subjects` | `SubjectsApiRepository` | `SubjectQueryDto` | `{data,meta}` | Subjects/Home | Connected | Typed student projection |
| `GET /subjects/:id` | `SubjectsApiRepository` | UUID | Student subject | Subject details | Connected | Server progress |
| `POST/DELETE /subjects/:id/favorite` | `SubjectsApiRepository` | UUID | Favorite state | Subjects | Connected | Reload after mutation |
| `GET /subjects/:id/units` | `UnitsApiRepository` | UUID | Student units | Subject details | Connected | Typed mapping |
| `GET /units/:id` | `UnitsApiRepository` | UUID | Student unit | Unit details | Connected | Typed mapping |
| `GET /units/:id/lessons` | `LessonsApiRepository` | UUID | Student lessons | Unit details | Connected | Typed mapping |
| `GET /lessons/:id` | `LessonsApiRepository` | UUID | Student lesson | Lesson details | Connected | Typed mapping |
| `GET /exam-models` | `ExamModelsApiRepository` | `ExamModelQueryDto` | `{data,meta}` | Exam Models | Connected | Answer-safe list |
| `GET /exam-models/:id` | `ExamModelsApiRepository` | UUID | Answer-safe detail | Exam/Quiz setup | Connected | No solution mapping |
| `/quiz-attempts/*` | `DioQuizRemoteDataSource` | Exact quiz DTO fields | Attempt/answer/result/history | Quiz Setup/Play/Result | CONNECTED | Repository-tested; server owns correctness, score, points and expiry |
| `/mistakes`, `/saved-questions` | `DioProgressRemoteDataSource` | Progress queries/notes/collection quiz DTO | Safe `{data,meta}` and mutations | Mistakes/Saved/Quiz | CONNECTED | Repository-tested pagination, notes, review, idempotent delete and collection quizzes |
| `/statistics/overview`, `/activity`, `/subjects*`, `/units/:id`, `/lessons/:id`, `/accuracy-trend`, `/time-distribution`, `/heatmap`, `/questions` | `StatisticsApiRepository` | range/from/to and hierarchy IDs | Typed overview/charts/progress | Home/Statistics/Profile | CONNECTED | Repository-tested zero-safe chart parsing and custom UTC ranges |
| `/statistics/performance`, `/statistics/time-analytics` | None | — | Additional aggregate views | None | NOT_USED_BY_CURRENT_UI | Current UI composes the documented endpoints above |
| `/recommendations/*` | `RecommendationsApiRepository` | subject/limit and weakness quiz DTO | Typed bundle/lists/attempt | Home/Statistics/Quiz | CONNECTED | Server-generated reasons/scores; direct weakness quiz endpoint |
| `/gamification/points`, `/gamification/points/history`, `/daily-tasks/today`, `/daily-tasks/:id/claim`, `/achievements`, `/achievements/:id/mark-seen` | Typed API repositories | Pagination/claim/mark-seen | Points/tasks/achievements | Home/Profile/Achievements | CONNECTED | Backend owns level, progress, rewards and unlocks |
| `/achievements/my` | None | — | User-achievement rows | None | NOT_USED_BY_CURRENT_UI | `/achievements` already returns unlocked state for the current UI |
| `/leaderboards`, `/leaderboards/me` | `LeaderboardsApiRepository` | period/scope/metric/page | Page/current rank | Leaderboard/Home | CONNECTED | Current user appended when outside current page |
| `/challenges/*`, Socket.IO `/challenges` | `ChallengeApiRepository` / `ChallengeSocketService` | Exact REST DTOs and socket events | Typed lobby/round/result state | Challenges | CONNECTED | One authenticated socket; refresh/logout hooks; reconnect sync; server-only scoring |
| `/notifications`, `/notifications/unread-count`, `/notifications/:id/read`, `/notifications/read-all`, `/notifications/:id`, `/notifications/devices*` | `NotificationsApiRepository` / `FcmNotificationService` | Exact query/device DTOs | Typed page/count/mutations/device | Inbox/Home badge | CONNECTED | REST complete; native Firebase credentials are deployment-blocked and documented |

| /updates, /updates/:id | None | — | Update list/detail | None | NOT_USED_BY_CURRENT_UI | No current production screen consumes updates |
