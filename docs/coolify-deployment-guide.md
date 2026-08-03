# Coolify Deployment Guide (Docker Compose)

هذا الدليل خطوة بخطوة لنشر المنصة (Question Bank Platform) كـ Monorepo على خادم Coolify باستخدام Docker Compose.

## 1. إنشاء المشروع في Coolify
1. اذهب إلى لوحة تحكم Coolify واضغط على **Projects**.
2. أنشئ مشروعاً جديداً باسم `Question Bank Platform`.
3. أنشئ بيئة جديدة داخله (مثلاً `Production`).

## 2. ربط المستودع (Repository)
1. اختر **Add New Resource** ثم **Docker Compose**.
2. اختر المستودع الخاص بك (سواء عبر GitHub App أو Deploy Key).
3. اختر فرع `main`.

## 3. تحديد ملف الـ Docker Compose
في واجهة إعدادات المورد (Resource Settings)، ابحث عن حقل **Docker Compose Location** واكتب:
`docker-compose.coolify.yml`

## 4. إعداد متغيرات البيئة (Environment Variables)
في قسم **Environment Variables**، قم بإنشاء المتغيرات التالية بناءً على ملف `.env.example`:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `PROVIDER_CREDENTIALS_MASTER_KEY`

**مهم بخصوص Next.js (Admin Dashboard):**
يجب تحديد `NEXT_PUBLIC_API_URL` و `BACKEND_INTERNAL_URL` كمتغيرات ليتم تضمينها أثناء الـ Build-time.
- فعل خيار **Build Variable** للمتغيرين المذكورين في إعدادات Coolify إن وُجِدَ، لكي تمر عبر الـ Docker Args بنجاح.

## 5. ربط النطاقات (Domains)
في Coolify، سيتم التعرف على الخدمات (backend, admin). 
1. لخدمة **backend**، قم بتعيين النطاق مثلاً: `https://api.example.com`
2. لخدمة **admin**، قم بتعيين النطاق مثلاً: `https://admin.example.com`
- المنافذ الداخلية (Internal Ports) لكلتا الخدمتين هي `3000` (حسب الـ Dockerfile). سيتولى Coolify توجيه الترافيك لهما عبر Proxy.

## 6. قواعد البيانات والأمان
- تأكد أن حقلي `postgres` و `redis` ليس لديهما Domains مخصصة (لمنع الوصول من الإنترنت).
- الدومين الداخلي للـ DB هو `postgres:5432` وللـ Redis هو `redis:6379`.

## 7. النشر الأول (First Deploy)
اضغط على زر **Deploy**. سيقوم Coolify ببناء الصور باستخدام الـ Dockerfiles المتوفرة.
بمجرد اكتمال النشر، ستصبح الحاويات قيد العمل (Healthy).

## 8. إعداد قاعدة البيانات (PostgreSQL) وتفعيل pgvector
1. في Coolify، ادخل إلى حاوية الـ `postgres` الخاصة بالمشروع (Terminal).
2. فعّل إضافة `pgvector`:
   `CREATE EXTENSION IF NOT EXISTS vector;`
3. لاستعادة البيانات من نسخة احتياطية سابقة (دون رفعها لـ GitHub)، يمكنك استخدام أمر `pg_restore` من خادمك المحلي إلى قاعدة بيانات Coolify (يتطلب ذلك عمل Expose للمنفذ 5432 بشكل مؤقت جداً ثم إغلاقه بعد الانتهاء).
4. أو كبديل، إذا كانت قاعدة البيانات فارغة، يمكنك الدخول لـ terminal الخاص بحاوية `backend` وتنفيذ أمر:
   `npx prisma migrate deploy` 
   لبناء الهيكل البرمجي فقط.

## 9. الاختبار النهائي
- افتح نطاق الـ Admin الخاص بك (مثال: `https://admin.example.com`).
- تأكد أن الواجهة تعمل وتسجل الدخول بنجاح، مما يثبت أن الـ `backend` و الـ `admin` يتواصلان بشكل سليم داخلياً وخارجياً.
- قم بإعداد نسخ احتياطية (Backups) لـ `postgres` من خلال إعدادات الـ Volume المتوفرة في Coolify للحفاظ على سلامة البيانات.
