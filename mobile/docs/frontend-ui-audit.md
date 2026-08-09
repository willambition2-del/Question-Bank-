# تقرير التدقيق الفني الأولي لواجهات وتجربة المستخدم (Frontend UI Audit Report)

**التطبيق**: بنك الأسئلة للثالث الثانوي (الجمهورية اليمنية)  
**تاريخ التدقيق**: 19 يوليو 2026  
**الفرع (Branch)**: `frontend-experience-hardening`  

---

## 1. الصفحات والأقسام الميدانية (Existing & Missing Pages)

### الصفحات الموجودة حالياً (Existing Screens)
1. `SplashScreen` (`lib/features/splash/presentation/splash_screen.dart`)
2. `OnboardingScreen` (`lib/features/onboarding/presentation/onboarding_screen.dart`)
3. `LoginScreen` & `RegisterScreen` (`lib/features/auth/presentation/`)
4. `MainShellScreen` & `HomeScreen` (`lib/features/home/presentation/`)
5. `SubjectsScreen` & `SubjectDetailsScreen` (`lib/features/subjects/presentation/`)
6. `UnitDetailsScreen` (`lib/features/units/presentation/`)
7. `LessonDetailsScreen` (`lib/features/lessons/presentation/`)
8. `ExamModelsScreen` (`lib/features/exam_models/presentation/`)
9. `QuizSetupScreen` & `QuizScreen` (`lib/features/quiz/presentation/`)
10. `QuizResultScreen` (`lib/features/results/presentation/`)
11. `MistakesScreen` (`lib/features/mistakes/presentation/`)
12. `SavedQuestionsScreen` (`lib/features/saved_questions/presentation/`)
13. `ChallengesScreen`, `ChallengeWaitingScreen`, `ChallengeLiveScreen` (`lib/features/challenges/presentation/`)
14. `LeaderboardScreen` (`lib/features/leaderboard/presentation/`)
15. `AchievementsScreen`, `ProfileScreen`, `SettingsScreen` (`lib/features/profile/presentation/`)
16. `StatisticsScreen` (`lib/features/statistics/presentation/`)

### الصفحات والتدفقات الناقصة (Missing Screens & Journeys)
1. `LessonQuizSetupScreen`: شاشة مخصصة لإعداد اختبار درس محدد بجميع الخيارات (عدد الأسئلة، الصعوبة، المؤقت، نوع الأسئلة، التفسيرات، القلوب، استبعاد المتقن).
2. `UnitsScreen` & `LessonsScreen`: التصفح التسلسلي المستقل ضمن رحلة المادة.
3. `CharacterCustomizationScreen`: شاشة اختيار الطالب أو الطالبة ومعاينة مجموعة التعبيرات وتخصيص المؤثرات.
4. **تدفق تحدي 1 ضد 1 الكامل**:
   - `CompetitionModeScreen`
   - `ChallengeSetupScreen`
   - `OpponentSelectionScreen`
   - `ChallengeLobbyScreen`
   - `ChallengeResultScreen`
5. **تدفق تحدي 2 ضد 2 الكامل (Team Challenge)**:
   - `TeamChallengeSetupScreen`
   - `TeamFormationScreen`
   - `TeamInviteScreen`
   - `TeamLobbyScreen`
   - `TeamChallengeLiveScreen`
   - `TeamChallengeResultScreen`

---

## 2. مشاكل التصميم والهوية البصرية (Design System Issues)

1. **عدم مطابقة الألوان المعتمدة**:
   - استخدام لون الأزرق القديم `#315BE8` بدلاً من اللون الرئيسي المعتمد `#2F5BEA` و `#173EA8`.
   - قيم الألوان والمسافات والظلال متناثرة يدوياً داخل الصفحات بدلاً من استخدام Design System موحد.
2. **انحراف زوايا البطاقات (Border Radius)**:
   - بعض العناصر تستخدم زوايا 10 و 16 بدلاً من المعيار المطلوب (18px إلى 24px).
3. **غياب المكونات التفاعلية الموحدة**:
   - عدم وجود مكونات موحدة مثل: `AppHeader`, `AppChip`, `ProgressCard`, `StatCard`, `SubjectCard`, `LessonCard`, `QuizTypeCard`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `CharacterSpeechBubble`, `CharacterReactionOverlay`.

---

## 3. مشاكل الاتجاهات والرسم (RTL & Responsive Issues)

1. **الاستجابة للشاشات الصغيرة (Responsive)**:
   - حدوث طفح بصري (Overflow) على الشاشات بعرض 320px و 360px بسبب الأبعاد الثابتة للشبكات والأزرار.
   - عدم وجود دعم مرن لمنطقة الأمان (`SafeArea`) ودعم تكبير خطوط الجهاز دون كسر الواجهة.
2. **محاذاة RTL**:
   - وجود عناصر تعتمد محاذاة يسارية افتراضية دون مراعاة لغة الواجهة العربية، أو استخدام `Transform` غير صحيح بدلاً من اتجاهية النمط `Directionality`.

---

## 4. مشاكل التصفح والتنقل (Navigation Issues)

1. **الربط بين الأقسام**:
   - أشرطة التنقل السفلية تعيد بناء الشاشات عند الانتقال بدلاً من الحفاظ على الحالة وحفظ موقع التمرير (`Scroll Position`) باستخدام `IndexedStack` أو `ShellRoute`.
2. **رحلة المادة غير المكتملة**:
   - غياب الانتقال الهرمي المباشر: `SubjectsScreen` → `SubjectDetailsScreen` → `UnitsScreen` → `UnitDetailsScreen` → `LessonsScreen` → `LessonDetailsScreen` → `LessonQuizSetupScreen`.

---

## 5. مشاكل نظام الشخصية (Character System Issues)

1. **قصور حالات الشخصية**:
   - الاقتصار على حالات بسيطة مثل `welcome`, `idle`, `correct`, `wrong` بدلاً من دعم الـ 24 حالة شعورية (`CharacterEmotion`) المحددة في المطلب.
2. **غياب مكونات حوار الشخصية**:
   - الشخصية تعرض كصورة مربعة مقصوصة في بعض البانرات بدلاً من دمجها بحركة دخول وبابل حواري مخصص (`CharacterSpeechBubble` & `CharacterReactionOverlay`).

---

## 6. مشاكل الربط البرمجي والبيانات (API Integration & State Management)

1. **غياب عميل Dio الموحد**:
   - الاعتماد الكامل على بيانات شرفية محاكية (`Mock Repository`) دون تجميع طبقة REST و WebSocket لميزات التحدي.
2. **عزل المزودات (Riverpod Providers)**:
   - تداخل وظائف Provider وحاجة إلى إعادة تجميعها إلى مزودات مستقلة لكل ميزة.

---

## 7. مشاكل الاختبارات (Testing Issues)

1. **ضعف التغطية**:
   - الملف `test/widget_test.dart` هو الاختبار الوحيد بالمشروع وغير محدث مع الهيكل الجديد.
   - عدم وجود اختبارات وحدة (Unit Tests) أو اختبارات واجهة (Widget Tests) أو اختبارات صور ذهبية (Golden Tests).

---

## 8. خطة التنفيذ الموحدة (Phase-by-Phase Implementation Plan)

- **المرحلة A**: بناء نظام Design System والـ Theme ونظام الشخصية الموحد (`CharacterEmotion`, `CharacterAssetRegistry`) وضبط التصفح الموحد `ShellRoute`/`IndexedStack`.
- **المرحلة B**: إعادة صياغة الشاشة الرئيسية (`HomeScreen`) وشاشات رحلة المادة (`Subjects`, `SubjectDetails`, `Units`, `Lessons`, `LessonQuizSetupScreen`).
- **المرحلة C**: تطوير شاشات الاختبار والنتائج ومراجعة الأخطاء والأسئلة المحفوظة وفق معايير UI/UX المتقدمة.
- **المرحلة D**: إعادة بناء شاشة الإحصائيات الشاملة (`StatisticsScreen`) مع الرسوم البيانية التفاعلية وموزعات الأداء وشاشة الإنجازات (`AchievementsScreen`).
- **المرحلة E**: تطوير قسم المنافسات، وتدفق تحدي 1v1، وتدفق تحدي 2v2 الكامل مع العقود الخاصة بـ REST و Socket.IO وعلم الميزات (`Feature Flag`).
- **المرحلة F**: شاشة الحساب والتخصيص (`AccountScreen` و `CharacterCustomizationScreen`) ومعالجة الاستجابة على الشاشات الصغيرة وتغطية جميع حالات Loading/Error/Empty.
- **المرحلة G**: إضافة الاختبارات البرمجية (`Unit`, `Widget`, `Golden tests`) وتشغيل الفحص وتحزيم المشروع.
