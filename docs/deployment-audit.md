# Deployment Audit Report (Coolify)

## البنية الحالية
- مستودع واحد (Monorepo) يحتوي على:
  - `backend`: مجلد واجهة برمجة التطبيقات (Question Bank API).
  - `admin`: مجلد لوحة التحكم الإدارية (Admin Dashboard).

## التقنيات والإصدارات
- **Node.js**: 22.17.1 لكلا المشروعين.
- **إدارة الحزم**: `npm`.
- **Backend Framework**: NestJS.
- **Frontend Framework**: Next.js 16 (App Router).
- **قواعد البيانات**: PostgreSQL (مع `pgvector`) و Redis.
- **ORM**: Prisma.

## أوامر البناء والتشغيل
- **Backend**: البناء عبر `npm run build` والتشغيل عبر `node dist/src/main.js`.
- **Admin**: البناء عبر `npm run build` والتشغيل عبر نمط `standalone` بـ `node server.js`.
- **Worker**: مساره المكتشف `dist/src/question-import-worker.js`.

## تفاصيل أخرى مهمة
- **عدد ملفات التهجير (Migrations)**: 24 ملف هجرة مسجّل.
- **نقاط التحقق من الصحة (Health Endpoints)**:
  - Backend: `GET /api/v1/health/live`
  - Admin: `GET /login`
- **المنافذ (Ports)**: 
  - Backend: `3000` (داخلي).
  - Admin: `3000` (داخلي).

## متغيرات البيئة المطلوبة
- **Build-time**: `NEXT_PUBLIC_API_URL` و `BACKEND_INTERNAL_URL`.
- **Runtime**: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, `DATABASE_URL`, `JWT_ACCESS_SECRET` وغيرها (مذكورة بوضوح في `.env.example`).

## أمن المعلومات (Security)
تم استبعاد كافة الملفات الحساسة بما في ذلك:
- جميع ملفات `.env` و `.env.local` الأصلية.
- مجلدات `node_modules` و `dist` و `.next`.
- ملفات النسخ الاحتياطية `.dump`, `.sql`, `.sqlite`.
- المفاتيح الحساسة أو (Android Keystore).

## المشكلات التي تم إصلاحها أثناء التجهيز
1. أخطاء عدم تطابق الـ `Template Literals` (`SyntaxError`) في `admin-dashboard/src/app/exam-models/page.tsx` و `sources/page.tsx`.
2. فشل الـ `npm ci` في الـ `backend` بسبب الحزم المترجمة (`node-gyp`)، حيث تم حله بتخطيها عبر `--ignore-scripts`.
3. خطأ تعريفات `Prisma` المستدعاة بالخطأ في `admin-users.service.ts` بالخادم.
4. نقص في حزمة `@playwright/test` أثناء التحقق من بناء Next.js، حيث تم تثبيتها بـ `npm install -D`.
