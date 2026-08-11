# خريطة الربط مع الخدمات وواجهات البرمجة (Frontend API Mapping)

**التطبيق**: بنك الأسئلة للثالث الثانوي  

---

## 🔗 1. ربط واجهات البرمجة والـ REST DTOs

| الميزة / الشاشة | المزود (Provider) | المستودع (Repository) | نقاط النهاية (Endpoints / REST DTOs) |
|---|---|---|---|
| المواد الدراسية | `subjectsNotifierProvider` | `SubjectsRepository` | `GET /api/v1/subjects` → `List<SubjectModel>` |
| تفاصيل المادة | `subjectDetailsProvider` | `SubjectsRepository` | `GET /api/v1/subjects/:subjectId` |
| وحدات المادة | `subjectUnitsProvider` | `UnitsRepository` | `GET /api/v1/subjects/:subjectId/units` → `List<UnitModel>` |
| دروس الوحدة | `unitLessonsProvider` | `LessonsRepository` | `GET /api/v1/units/:unitId/lessons` → `List<LessonModel>` |
| أسئلة الاختبار | `quizNotifierProvider` | `QuizRepository` | `GET /api/v1/quiz/questions` → `List<QuestionModel>` |
| تسليم الاختبار | `quizNotifierProvider` | `QuizRepository` | `POST /api/v1/quiz/submit` → `QuizAttempt` |
| سجل الأخطاء | `mistakesNotifierProvider` | `MistakesRepository` | `GET /api/v1/mistakes`, `POST /api/v1/mistakes/resolve` |
| الأسئلة المحفوظة | `savedQuestionsNotifierProvider` | `SavedQuestionsRepository` | `GET /api/v1/saved`, `POST /api/v1/saved/toggle` |
| الإحصائيات الشاملة | `statisticsProvider` | `StatisticsRepository` | `GET /api/v1/statistics/user` |
| أوسمة الإنجاز | `achievementsListProvider` | `AchievementsRepository` | `GET /api/v1/achievements` |
| تحديات 1v1 و 2v2 | `challengeSimulationProvider` & `teamChallengeNotifierProvider` | `ChallengeRepository` & `ChallengeSocketService` | `POST /api/v1/challenges/create`, `POST /api/v1/challenges/join`, `WebSocket /socket.io/challenges` |
