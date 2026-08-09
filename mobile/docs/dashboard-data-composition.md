# Dashboard Data Composition

Contract source: backend commit `9734ec8`. Paths are relative to `/api/v1`.

`HomeDashboardNotifier` loads each server concern independently. A failure in one request updates only that card/section and never replaces successful user, statistics, recommendation, points, or daily-task data.

| Dashboard concern | Endpoint | Status |
| --- | --- | --- |
| Identity and companion | `GET /auth/me` (restored auth state) | CONNECTED |
| Overview, streak and rank | `GET /statistics/overview` | CONNECTED (repository-tested) |
| Recommended lessons/weaknesses | `GET /recommendations` | CONNECTED (repository-tested) |
| Weakness quiz | `POST /recommendations/weakness-quiz` | CONNECTED (repository-tested) |
| Level and points policy | `GET /gamification/points` | CONNECTED (repository-tested) |
| Points history | `GET /gamification/points/history` | CONNECTED (repository-tested pagination) |
| Daily tasks and claims | `GET /daily-tasks/today`, `POST /daily-tasks/:id/claim` | CONNECTED (repository-tested) |
| Notification unread count | `GET /notifications/unread-count` | CONNECTED |
| Recent progress | No dedicated endpoint used by the current UI | NOT_USED_BY_CURRENT_UI |

The Statistics screen uses typed models for overview, accuracy trend, heatmap, subject progress, question difficulty and answer time. It supports `week`, `month`, `all`, and validated custom `from`/`to` UTC ranges. Empty timelines and zero denominators render empty/zero states; no chart contains fallback sample points.

Gamification level and progress are not calculated in Flutter. Achievement unlocks are server-only; Flutter lists them and resolves `iconKey` through `AchievementAssetResolver` with a stable fallback. The UI does not expose the unsupported friends leaderboard scope because backend commit `9734ec8` supports only `global`, `subject`, and `school`.

Runtime device verification is pending a Backend test environment. CONNECTED denotes exact controller/DTO implementation plus repository tests.