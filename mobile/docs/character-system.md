# نظام الشخصية التفاعلية الموحد (Character System Documentation)

**التطبيق**: بنك الأسئلة للثالث الثانوي  

---

## 🤖 1. حالات التعبير والتفاعل (CharacterEmotion - 24 Emotions)

يدعم نظام الشخصية التفاعلية 24 حالة شعورية معتمدة:

1. `welcome`: الترحيب في البداية والصفحة الرئيسية.
2. `neutral`: التواجد العادي والتنقل الساكن.
3. `thinking`: التفكير والتأمل قبل إجابة السؤال.
4. `waiting`: الانتظار في غرف المنافسة والتحدي.
5. `hint`: تقديم التلميح والمساعدة للطلاب.
6. `warning`: التحذير من الأسئلة المفخخة أو الانتباه للوقت.
7. `correct`: الإجابة الصحيحة والتشجيع.
8. `fastCorrect`: الإجابة السريرة والدقيقة جداً.
9. `wrong`: الإجابة الخاطئة والتعاطف المشجع.
10. `timeout`: انتهاء الوقت والتنبيه السريع.
11. `difficultQuestion`: عند مواجهة سؤال ذو صعوبة عالية.
12. `readyForChallenge`: الجاهزية لدخول التحدي المباشر.
13. `challengeExcited`: الحماس الشديد أثناء المبارزات المباشرة.
14. `victory`: الفوز والانتصار في الاختبارات والمنافسات.
15. `defeatSportsmanship`: تقبل الخسارة بروح رياضية وحث على الإعادة.
16. `revengeChallenge`: طلب مباراة إعادة الثأر.
17. `excellentResult`: الحصول على نتيجة ممتاز.
18. `mediumResult`: الحصول على نتيجة متوسطة.
19. `weakResult`: الحصول على نتيجة تحتاج إلى مراجعة.
20. `weaknessReview`: بدء مراجعة نقاط الضعف.
21. `recommendedLesson`: اقتراح درس مخصص للطالب.
22. `streak`: المحافظة على السلسلة اليومية.
23. `achievement`: فتح إنجاز جديد.
24. `teamCelebration`: احتفال الفريق في تحديات 2v2.

---

## 👕 2. مطابقة الشخصية والأصول (Character Asset Registry)

يتم اختيار أصول الشخصيات ديناميكياً بناءً على إعدادات الجنس المختار للطالب:
- **طالب (CompanionType.male)**: أصول `assets/male/male_X.jpg` و `assets/generated/male_welcome_character.png`.
- **طالبة (CompanionType.female)**: أصول `assets/female/female_X.jpg` و `assets/generated/female_welcome_character.png`.

تضمن الكلاس `CharacterAssetRegistry` عدم خلط أنماط رسم مختلفة والتأكد من مطابقة جميع الملامح والملابس في كافة أنحاء الواجهات.
