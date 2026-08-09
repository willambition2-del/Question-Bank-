# دليل توليد وتصميم شخصيات المستشار المساعد الافتراضي (Character Prompts)

يوضح هذا الدليل موجهات وتعبيرات الـ 21 حالة التعبيرية المطلوبة لشخصيتي التطبيق: **وضاح** (طالب يمني) و**بلقيس** (طالبة يمنية). 
يتم استخدام هذه الموجهات لتوليد صور الـ WebP بخلفية شفافة وتسميتها بصيغة `male_*.webp` و `female_*.webp` ثم وضعها في مجلدات الأصول المقابلة.

---

## 📌 المظهر العام للشخصيتين (Base Style & Identity)

### 1. بلقيس (طالبة يمنية) - `female`
*   **الوصف الأساسي**: فتاة يمنية في سن الـ 17، ملامح وجه ذكية وبشوشة، عيون عربية واسعة، بشرة حنطية فاتحة.
*   **الملابس**: ترتدي حجاباً أزرقاً سماوياً منسقاً، وقميصاً أبيضاً محتشماً، وتنورة كحلية أو زرقاء طويلة. نمط الفن مسطح (Flat 2D Vector) بأسلوب كرتوني تعليمي حديث.

### 2. وضاح (طالب يمني) - `male`
*   **الوصف الأساسي**: فتى يمني في سن الـ 18، ملامح بشوشة ومحفزة، بشرة حنطية، عيون واسعة سوداء.
*   **الملابس**: يرتدي ثوباً أبيضاً ناصعاً، وصديرياً تقليدياً بلون كحلي أو رمادي، وحزام الجنبية اليمني المذهب مع عمامة (شال يمني) ملفوفة بأناقة على الرأس. أسلوب الفن مسطح (2D Vector).

---

## 🎨 جدول الحالات التعبيرية والـ Prompts الـ 21

لكل حالة، يتم صياغة الـ Prompt الخاص بـ **بلقيس** و **وضاح** كالتالي:

| اسم الحالة ومفتاح الأصول | التعبير البصري والحركة | Prompt توليد الصورة المقترح (Nano Banana / AI) |
| :--- | :--- | :--- |
| **welcome** | تحية وترحيب، تبتسم وتلوح بيدها اليمين. | `Cute cartoon character, waving hand, happy smile, welcoming gesture, flat 2D vector, transparent background` |
| **idle** | وضع الاستعداد، وقفة هادئة وثقة مبتسمة خفيفة. | `Cute cartoon character, calm standing pose, gentle smile, forward looking, flat 2D vector, transparent background` |
| **thinking** | التفكير والتركيز، وضع اليد على الذقن مع نظرة للأعلى. | `Cartoon character thinking pose, hand on chin, looking upwards, thoughtful expression, flat 2D vector, transparent background` |
| **hint** | إشارة ذكية، مصباح مضيء بجانب الرأس وإصبع مرفوع. | `Cartoon character holding a tiny glowing lightbulb, smart hint gesture, smile, flat 2D vector, transparent background` |
| **dangerKeyword** | تحذير خفيف، يفتح عينيه بتركيز ويشير للأسفل (انتبه!). | `Cartoon character with focused alert expression, warning pointing finger gesture, flat 2D vector, transparent background` |
| **correct** | نجاح مبهج، قفزة خفيفة مع علامة الـ V باليدين. | `Jumping cartoon character celebrating, V sign, joyful victory expression, flat 2D vector, transparent background` |
| **fastCorrect** | تفوق سرعة، إشارة الإبهام لأعلى (Thumbs Up) مع بريق تفوق. | `Cartoon character thumbs up gesture, fast success, sparkling eyes, super happy, flat 2D vector, transparent background` |
| **wrong** | حزن خفيف ووقفة متعاطفة، يد خلف الرأس وابتسامة خجولة. | `Cartoon character feeling slightly apologetic, hand behind head, supportive warm expression, flat 2D vector, transparent background` |
| **timeUp** | انتهاء الوقت، يشير لساعة يد وهمية بنظرة متفاجئة. | `Cartoon character pointing to wrist watch, surprised time-up expression, flat 2D vector, transparent background` |
| **encouragement** | تحفيز، يد على الصدر بنظرة مليئة بالأمل والثقة. | `Cartoon character with hand on chest, inspiring confident expression, encouraging smile, flat 2D vector, transparent background` |
| **excellentResult** | نتيجة ممتازة، يرفع كأساً ذهبياً صغيراً ببهجة. | `Joyful cartoon character holding a golden trophy, maximum celebration, flat 2D vector, transparent background` |
| **weakResult** | نتيجة ضعيفة، يحمل دفتراً ويشير للدروس بنظرة حانية. | `Cartoon character holding open notebook, caring supportive encouraging expression, flat 2D vector, transparent background` |
| **challengeReady** | استعداد للتحدي، وقفة الملاكم التفاعلية بثقة ومنافسة. | `Cartoon character in confident stance, eyes focused on challenge, determination, flat 2D vector, transparent background` |
| **waitingOpponent**| انتظار الخصم، يشبك يديه ويقف بنظرة انتظار بشوشة. | `Cartoon character folding arms, waiting patiently, gentle expectation smile, flat 2D vector, transparent background` |
| **winning** | متفوق بالتحدي، يبتسم ويرفع قبضة يده للأعلى بنصر. | `Cartoon character raising fist, win progression, positive competitive smile, flat 2D vector, transparent background` |
| **losing** | متأخر بالتحدي، يد على الجبين بنظرة تركيز ومثابرة. | `Cartoon character looking determined despite trailing, sweating drop, focus, flat 2D vector, transparent background` |
| **victory** | فوز بالبطولة، قبعة تخرج طائرة أو أكاليل ورد يمنية. | `Cartoon character wearing traditional Yemeni jasmine collar, ultimate victory joy, flat 2D vector, transparent background` |
| **achievement** | فتح وسام، يحمل ميدالية ذهبية كبيرة بفخر وابتسامة عريضة. | `Cartoon character wearing a gold medal around neck, proud achievement smile, flat 2D vector, transparent background` |
| **update** | تحديث، ممسك بلوح كتابة (Clipboard) وقلم بنظرة تخطيط. | `Cartoon character holding clipboard and pen, checking off lists, flat 2D vector, transparent background` |
| **emptyState** | حالة فارغة، يفتح يديه جانباً باستغراب خفيف مبتسم. | `Cartoon character with shrugging gesture, hands spread out, empty list state, flat 2D vector, transparent background` |
| **error** | خطأ بالشبكة، يمسك بهاتف مائل ويهزه باستغراب حائر. | `Cartoon character looking confused at a smartphone, signal error expression, flat 2D vector, transparent background` |

---

## 📢 ملاحظة هامة حول التنفيذ العملي:
بيئة التطوير الحالية تدعم **المكونات المتجهة الفيكتور (Vector Placeholders) عالية الجودة** كبديل محايد ومصمم خصيصاً بالهوية اليمينية التقليدية عبر `CharacterCompanion` في حال عدم توليد الصور فعلياً. يتم تفعيل صور WebP تلقائياً بمجرد إدراج الملفات المنتجة من أداة الرسم في المسار:
`assets/characters/{male|female}/{male|female}_{mood}.webp`
