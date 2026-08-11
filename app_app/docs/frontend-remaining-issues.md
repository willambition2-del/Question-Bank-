# 🔍 تقرير تدقيق المشاكل المتبقية والحقيقية (Frontend Remaining Issues Audit)

**التطبيق**: بنك الأسئلة للثالث الثانوي (اليمن)  
**تاريخ التدقيق**: 19 يوليو 2026  
**الفرع الخاضع للتدقيق**: `frontend-ux-completion`  

---

## 🛑 قائمة التدقيق الشامل للشاشات والمراحل المعيوبة

| الشاشة / المكون | المشكلة الفعلية (Overflow / UI Gap) | السبب التقني والبرمجي | هل الميزة حقيقية أم شكلية؟ | ملفات التنفيذ المسؤولة | الإصلاح المطلوب | حالة الاختبار (Test Status) |
|---|---|---|---|---|---|---|
| **HomeScreen** | `RIGHT OVERFLOWED BY 24 PIXELS` في بانر التحدي السريع والبطاقات | استخدام `Row` مع عرض ثابت للكتل وعدم إتاحة `Expanded` / `Wrap` للنصوص طويلة الأبعاد | حقيقية محتاجة مرونة | `lib/features/home/presentation/home_screen.dart` | التبديل لـ `Expanded` و `Wrap` واستخدام `LayoutBuilder` لمنع الـ Overflow عند `textScaleFactor = 1.3` | قيد الإصلاح |
| **HomeScreen** | الشخصية محصورة داخل `CircleAvatar` صغيرة | وضع الشخصية المرافقة في دائرة 46x46 دون إبراز قوامها | شكلية | `lib/core/widgets/app_header.dart`, `lib/features/home/presentation/home_screen.dart` | تكبير الشخصية إلى 130-180px وإخراجها من حدود البانر بـ `Stack` وتراكب بصري | قيد الإصلاح |
| **Onboarding** | غياب Onboarding حقيقي لأول تشغيل | التنقل المباشر من الـ Splash إلى الرئيسية أو تسجيل الدخول دون حفظ حالة الجولة التعريفية | شكلية وسابقة لأوانها | `lib/features/onboarding/presentation/onboarding_screen.dart` | إنشاء Onboarding كامل من 8 صفحات تفاعلية وحفظ الحالات في `SharedPreferences` | قيد الإصلاح |
| **SubjectCard / SubjectHubScreen** | النقر على المادة فتح شاشة بسيطة والرحلة غير مكتملة | عدم وجود شاشة Hub موحدة ومكتملة تجمع الإحصائيات والاختبارات والوحدات والنماذج | شكلية جزئياً | `lib/features/subjects/presentation/subject_details_screen.dart`, `lib/features/subjects/presentation/subject_hub_screen.dart` | بناء `SubjectHubScreen` شاملة تفتح عند النقر على `SubjectCard` | قيد الإصلاح |
| **UnitDetailsScreen & LessonDetailsScreen** | الانتقال المباشر للاختبار الافتراضي بدلاً من إعداد الاختبار | زر الدرس يفتح `/quiz` فوراً دون المرور بشاشة الإعداد والتحكم في الأسئلة | غير مكتملة الرحلة | `lib/features/lessons/presentation/lesson_details_screen.dart` | توجيه الزر إلى `LessonQuizSetupScreen` وضمان تدفق `SubjectHub` → `Unit` → `Lesson` → `Setup` | قيد الإصلاح |
| **ChallengesScreen (2v2)** | 2v2 يظهر كبطاقة ودوائر صغيرة فقط | ادعاء تشغيل 2v2 بدون سلك خدمات حقيقي وتراكب دوائر لاعبين صغيرة | شكلية بدون Backend | `lib/features/challenges/presentation/challenges_screen.dart`, `lib/features/challenges/presentation/challenge_waiting_screen.dart` | إنشاء تدفق الشاشات الـ 6 لـ 2v2 وتفعيل `teamChallengeEnabled = false` لعدم الوداع ببيانات وهمية | قيد الإصلاح |
| **StatisticsScreen** | ازدحام الرسوم البيانية في صفحة Scroll واحدة طويلة | تجميع 11 قسماً تحليلياً في قائمة عمودية ممتدة | مزدحمة بصرياً | `lib/features/statistics/presentation/statistics_screen.dart` | تقسيم الشاشة إلى 4 تبويبات منظمة (نظرة عامة، المواد، النشاط، نقاط الضعف) | قيد الإصلاح |
| **CharacterCustomizationScreen** | استخدام الـ Emojis واستدعاء أصول مولدة غير معتمدة | الاعتماد على رموز التعبير والاعتماد على أصول خارج المجلد المعتمد | غير معتمدة بصرياً | `lib/features/profile/presentation/character_customization_screen.dart`, `lib/core/utils/character_asset_registry.dart` | اعتماد الأصول الأصلية فقط (`assets/male/`, `assets/female/`) ونقلها لـ `assets/characters/approved/` وتكبير المعاينة | قيد الإصلاح |
| **Empty / Error / Loading States** | رسائل نصية جافة بدون شخصيات تفاعلية | غياب المساعد العلمي في أخطاء الشبكة والأسئلة الفارغة | جافة بدون تحفيز | `lib/core/widgets/empty_state.dart`, `lib/core/widgets/error_state.dart` | إعادة بناء الكائنات المرافقة وتضمين الشخصيات بحجم 140px على الأقل | قيد الإصلاح |
