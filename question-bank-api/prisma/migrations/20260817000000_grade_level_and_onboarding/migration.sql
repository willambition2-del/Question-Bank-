-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "GradeLevel" AS ENUM ('NINTH', 'THIRD_SECONDARY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "governorate" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gradeLevel" "GradeLevel" DEFAULT 'THIRD_SECONDARY';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN IF NOT EXISTS "code" "GradeLevel";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Grade_code_key" ON "Grade"("code");

-- Backfill existing Grade 12 code
UPDATE "Grade"
SET "code" = 'THIRD_SECONDARY'
WHERE "slug" = 'grade-12' AND ("code" IS NULL OR "code" != 'THIRD_SECONDARY');

-- Insert 9th Grade record
INSERT INTO "Grade" ("id", "name", "slug", "code", "description", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES ('a9b9c9d9-0456-442f-97f1-9da5fd3fcd09', 'الصف التاسع', 'grade-9', 'NINTH', 'الصف التاسع الأساسي', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "code" = 'NINTH', "name" = 'الصف التاسع';

-- Link 9th Grade to Yemeni Curriculum in CurriculumGrade
INSERT INTO "CurriculumGrade" ("id", "curriculumId", "gradeId", "isActive", "createdAt")
SELECT 'cg-yemen-grade-9-uuid', c."id", g."id", true, CURRENT_TIMESTAMP
FROM "Curriculum" c, "Grade" g
WHERE c."slug" = 'yemeni-curriculum' AND g."slug" = 'grade-9'
ON CONFLICT ("curriculumId", "gradeId") DO NOTHING;

-- Backfill existing users with schoolName or admin roles
UPDATE "User"
SET "onboardingCompleted" = true, "gradeLevel" = 'THIRD_SECONDARY'
WHERE "role" IN ('SUPER_ADMIN', 'ADMIN', 'REVIEWER') OR "schoolName" IS NOT NULL;