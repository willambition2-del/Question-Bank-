# تقرير التدقيق الفني لواجهات وتفاعل التطبيق (Frontend Audit)

يسجل هذا التقرير جميع المشكلات المكتشفة في المشروع الحالي المتعلقة بـ Overflow، وتوقف مؤشرات التحميل، والأزرار والمسارات غير الفعالة، والرموز التصميمية غير المتناسقة.

---

## 1. أخطاء Overflow والقياسات الثابتة (Responsive Issues)

*   **المشكلة 1**: خطأ `BOTTOM OVERFLOWED BY 6.0 PIXELS` في بطاقات الإجراءات السريعة بالصفحة الرئيسية.
    *   *الملف*: [home_screen.dart](file:///d:/app_app/lib/features/home/presentation/home_screen.dart)
    *   *السبب*: استخدام `GridView.count` بـ `childAspectRatio: 1.6` ثابت وثابت الارتفاع، مما يضغط النصوص والصناديق على عروض الشاشة الصغيرة (320px - 360px).
    *   *الإصلاح*: استخدام `SliverGridDelegateWithMaxCrossAxisExtent` مع حساب الأبعاد ديناميكياً لتوفير مساحة كافية.

*   **المشكلة 2**: التفاف الأزرار والنصوص غير المرن واستخدام الارتفاعات الثابتة.
    *   *الملفات*: 
        *   [subject_details_screen.dart](file:///d:/app_app/lib/features/subjects/presentation/subject_details_screen.dart)
        *   [lesson_details_screen.dart](file:///d:/app_app/lib/features/lessons/presentation/lesson_details_screen.dart)
        *   [quiz_screen.dart](file:///d:/app_app/lib/features/quiz/presentation/quiz_screen.dart)
    *   *السبب*: استخدام `SizedBox` بأطوال عرض وارتفاع ثابتة بدلاً من استخدام `Flexible` و `Expanded` في الصفوف (`Row`) وبدون إتاحة إمكانية التمرير (`SingleChildScrollView`).
    *   *الإصلاح*: تعديل العناصر لتعتمد بالكامل على نظام تخطيط مرن وربط `SingleChildScrollView` للتمرير عند تجاوز الارتفاع.

*   **المشكلة 3**: قص تسميات ونصوص الـ Bottom Navigation على شاشات الهواتف الضيقة.
    *   *الملف*: [app_bottom_navigation.dart](file:///d:/app_app/lib/core/widgets/app_bottom_navigation.dart)
    *   *السبب*: قلة المساحة لعرض 5 أيقونات مع نصوصها بـ FontSize ثابت على عرض 320px.
    *   *الإصلاح*: استخدام `NavigationBar` مع ضبط حجم خط مرن وتقليله تلقائياً على الشاشات الضيقة.

---

## 2. شاشات متوقفة في مؤشر التحميل (Loading State Deadlocks)

*   **المشكلة 1**: صفحة المواد متوقفة دائماً عند مؤشر التحميل.
    *   *الملف*: [subjects_provider.dart](file:///d:/app_app/lib/features/subjects/providers/subjects_provider.dart)
    *   *السبب*: استدعاء `_loadSubjects()` بشكل متزامن داخل `build()` التابع لـ `SubjectsNotifier` مما يغير حالة الـ Provider قبل اكتمال مرحلة التهيئة، مسبباً إلقاء استثناء داخلي في Riverpod وتوقف عملية تحديث البيانات نهائياً.
    *   *الإصلاح*: تغليف الاستدعاء بـ `Future.microtask(() => _loadSubjects())`.

*   **المشكلة 2**: صفحة أخطائي السابقة، الأسئلة المحفوظة، والنماذج الوزارية متوقفة في التحميل.
    *   *الملفات*:
        *   [mistakes_provider.dart](file:///d:/app_app/lib/features/mistakes/providers/mistakes_provider.dart)
        *   [saved_questions_provider.dart](file:///d:/app_app/lib/features/saved_questions/providers/saved_questions_provider.dart)
        *   [exam_models_provider.dart](file:///d:/app_app/lib/features/exam_models/providers/exam_models_provider.dart)
    *   *السبب*: نفس مشكلة التحديث المتزامن لحالة الـ State داخل `build()`.
    *   *الإصلاح*: استخدام `Future.microtask` لجدولة جلب البيانات بعد اكتمال مرحلة البناء.

---

## 3. فحص المسارات وتماسك التدفق الدراسي (Navigation & Routes)

*   **المشكلة 1**: مسارات GoRouter مبنية باستخدام Query Parameters بدلاً من RESTful Paths متداخلة، مما يصعب تتبع تدفق "المادة -> الوحدة -> الدرس" ويخل بقواعد GoRouter.
    *   *الملف*: [app_router.dart](file:///d:/app_app/lib/app/router/app_router.dart)
    *   *الإصلاح*: إعادة تصميم المسارات لتتبع النمط المعياري:
        *   `/subjects/:subjectId`
        *   `/subjects/:subjectId/units/:unitId`
        *   `/subjects/:subjectId/units/:unitId/lessons/:lessonId`
        *   `/quiz/setup`
        *   `/quiz/play`
        *   `/quiz/result`
        *   `/saved`
        *   `/profile`
        *   `/settings`

*   **المشكلة 2**: عدم وجود شاشة خطأ مخصصة (Error Page) للتعامل مع المسارات غير الصحيحة.
    *   *الملف*: [app_router.dart](file:///d:/app_app/lib/app/router/app_router.dart)
    *   *الإصلاح*: إضافة `errorBuilder` إلى GoRouter ليعرض صفحة خطأ مرنة ومكتوبة بالعربية وتتيح العودة للرئيسية.

---

## 4. ملفات الأصول والشخصيات المفقودة (Assets & Characters)

*   **المشكلة 1**: صور الشخصيات التفاعلية (`male_*.webp` و `female_*.webp`) غير مدرجة في ملف `pubspec.yaml` ولا توجد المجلدات الخاصة بها في المشروع.
    *   *الملف*: [pubspec.yaml](file:///d:/app_app/pubspec.yaml)
    *   *الإصلاح*: تسجيل مسارات الشخصيات في ملف التكوين، وتجهيز دليل متكامل بالـ Prompts اللازمة لإنشاء الـ 21 حالة التعبيرية لكل شخصية عبر Nano Banana.
