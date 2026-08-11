# Frontend API Integration Audit

Date: 2026-07-26  
Flutter: `D:\three\app_app` on `flutter-production-api-integration` (started at `5012895`)  
Backend: `D:\three\question-bank-api` at `9734ec8`

At the starting commit every provider in `core/repositories/providers.dart` resolved to a `Mock*Repository`. There was no HTTP client, token storage, refresh handling, session restoration, or router authentication guard. Quiz correctness, scores, points, challenges, statistics, and dashboard values were calculated or stored locally. The character resolver, animated companion, emotion registry, RTL layout, colors, spacing, and navigation design are preserved.

| Feature | Screen | Starting data source | Backend contract | Auth | Pagination/socket | Status | Required action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth/session | Splash, Login, Register | Production Dio/Secure Storage | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` | Public then bearer | No | CONNECTED | Secure tokens, single-flight refresh, restoration and guarded navigation implemented |
| Profile | Profile, Settings | Mock student with combined stats | `/users/me`; statistics, points and rank are separate contracts | Bearer | No | CONNECTED | Profile composes identity with server overview and points profile |
| Subjects | Subjects, Home | `SubjectsApiRepository` | `/subjects`, `/subjects/:id`, favorite routes | Bearer | Page list | CONNECTED | Typed API data and mutation reload |
| Units | Subject/Unit details | `UnitsApiRepository` | `/subjects/:id/units`, `/units/:id` | Bearer | No | CONNECTED | Typed API data |
| Lessons | Unit/Lesson details | `LessonsApiRepository` | `/units/:id/lessons`, `/lessons/:id` | Bearer | No | CONNECTED | Typed API data |
| Exam models | Exam Models | `ExamModelsApiRepository` | `/exam-models`, `/exam-models/:id` | Bearer | Page list | CONNECTED | Typed answer-safe API data |
| Quiz | Setup, Play, Result | `mockQuestions`, local score/timer | `/quiz-attempts` lifecycle | Bearer | History page | CONNECTED | Server-authoritative lifecycle; repository tests cover safe parsing, partial attempts, retries and results |
| Mistakes | Mistakes | Local filtered questions | `/mistakes` and quiz/review routes | Bearer | Page list | CONNECTED | Safe typed page, review acknowledgement and direct collection quiz |
| Saved | Saved Questions | Local flags | `/saved-questions` and quiz/note/delete routes | Bearer | Page list | CONNECTED | Safe typed page, note update/clear, idempotent save/delete and direct collection quiz |
| Dashboard/statistics | Home, Statistics | Widget constants/mock student | `/statistics/*` | Bearer | Endpoint-dependent | CONNECTED | Typed charts and independent partial-failure state per data section |
| Recommendations | Home | Widget constants | `/recommendations/*` | Bearer | Contract-dependent | CONNECTED | Server score/reason/lesson data and direct weakness quiz |
| Gamification | Home/Profile | Local points/tasks | `/gamification/points`, `/achievements`, `/daily-tasks` | Bearer | History page | CONNECTED | Server-owned level/points/tasks/claims/unlocks with icon-key resolver |
| Leaderboards | Leaderboard | `mockLeaderboard` | `/leaderboards`, `/leaderboards/me` | Bearer | Page list | CONNECTED | Period/scope/metric pagination and off-page current rank |
| Challenges | Challenge screens | REST plus Socket.IO | `/challenges/*`, Socket.IO `/challenges` | Bearer/socket token | `challenge:*` | CONNECTED | Server-owned scoring/winner, reconnect and sync |
| Notifications/FCM | Inbox, Home badge | REST plus Firebase Messaging | `/notifications/*` | Bearer | Page list | CONNECTED_REST / BLOCKED_NATIVE_CONFIG | Firebase deployment files are required for native push |
| Updates | No current update screen | None | `/updates`, `/updates/:id` | Bearer | Contract-dependent | NOT_USED_BY_CURRENT_UI | No production UI consumes updates |

Mock fixtures may remain for tests only. Production providers must not resolve to them when the integration is complete.

## Challenges REST and Socket.IO (2026-07-22)

Status: CONNECTED. Matchmaking, invitation lobby lifecycle, history/results, exact namespace events, authenticated reconnect/sync, heartbeat, answer submission, server-owned score/correctness/winner, and logout/token-refresh hooks are implemented. See `docs/challenge-socket-contract.md`.


## Notifications and FCM (2026-07-22)

Status: REST CONNECTED / native delivery BLOCKED_BY_DEPLOYMENT_CONFIG. Inbox, unread count, read/read-all/delete, FCM device registration and rotation, logout removal, foreground refresh, and allow-listed tap routing are implemented. Firebase project files are absent and must be supplied by the deployment owner; see `docs/fcm-frontend-setup.md`.

