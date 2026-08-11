# Flutter Feature Inventory

| Feature | Screen | Route | Provider | Backend Endpoint | Offline Behavior | Auth Required | Feature Flag / Admin Control | Status |
|---|---|---|---|---|---|---|---|---|
| **Auth** | Login, Register | `/login`, `/register` | `authProvider`, `googleAuthStateProvider` | `/auth/login`, `/auth/register`, `/auth/google` | None (Requires network) | No | None | LIVE_AND_VERIFIED |
| **Home / Dashboard** | HomeScreen, MainShellScreen | `/home` | `homeDashboardProvider` | Multiple (Progress, Subjects) | Cached UI | Yes | None | LIVE_AND_VERIFIED |
| **Subjects** | SubjectsScreen, SubjectHubScreen, SubjectDetailsScreen | `/subjects`, `/subjects/:id` | `subjectsProvider`, `subjectDetailsProvider` | `/education/subjects`, `/education/subjects/:id` | Cached API data | Yes | None | LIVE_AND_VERIFIED |
| **Units & Lessons** | UnitDetailsScreen, LessonDetailsScreen | `/units/:id`, `/lessons/:id` | `subjectDetailsProvider` | `/education/units/:id`, `/education/lessons/:id` | Cached API data | Yes | None | LIVE_AND_VERIFIED |
| **Quiz** | QuizSetupScreen, QuizScreen, QuizResultScreen | `/quiz/setup`, `/quiz/live`, `/quiz/result` | `quizProvider` | `/quiz/generate`, `/quiz/submit` | Partial (Offline attempt saving pending) | Yes | None | LIVE_AND_VERIFIED |
| **Progress & Stats** | StatisticsScreen | `/statistics` | `statisticsDashboardProvider` | `/statistics/student/summary` | Cached UI | Yes | None | LIVE_AND_VERIFIED |
| **Mistakes & Saved** | MistakesScreen, SavedQuestionsScreen | `/mistakes`, `/saved` | `mistakesProvider`, `savedQuestionsProvider` | `/progress/mistakes`, `/progress/saved` | Cached UI | Yes | None | LIVE_AND_VERIFIED |
| **Leaderboard** | LeaderboardScreen | `/leaderboard` | N/A | `/leaderboards/global` | Network only | Yes | LEADERBOARD | IMPLEMENTED_NOT_CONFIGURED |
| **1v1 Challenge** | ChallengesScreen, ChallengeWaitingScreen, ChallengeLiveScreen | `/challenges`, `/challenges/live` | `challengeProvider`, `challengeSocketService` | `/challenges/matchmaking` (WebSocket) | None | Yes | CHALLENGE_1V1 | PARTIAL |
| **2v2 Challenge** | ChallengesScreen (Cards only) | N/A | N/A | N/A | None | Yes | CHALLENGE_2V2 | MISSING / COMING_SOON |
| **Intelligent Assistant** | Assistant Overlay / Chat | Dialog / Sheet | `assistantProvider` | `/intelligent-services/assistant/chat` | None | Yes | AI_ASSISTANT, IMAGE_ANALYSIS | IMPLEMENTED_NOT_CONFIGURED |
| **Notifications** | NotificationsScreen | `/notifications` | `notificationsProvider`, `fcmNotificationService` | `/notifications` | Cached list | Yes | NOTIFICATIONS | IMPLEMENTED_NOT_CONFIGURED |
| **Profile & Settings** | ProfileScreen, SettingsScreen, CharacterCustomization | `/profile`, `/settings`, `/character` | `authProvider` | `/users/me` | Cached | Yes | None | LIVE_AND_VERIFIED |
