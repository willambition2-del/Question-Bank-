-- CreateEnum
CREATE TYPE "ImportFileType" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY_TO_IMPORT', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "QuestionImportJob" (
    "id" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileType" "ImportFileType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "errorFileUrl" TEXT,
    "payload" JSONB NOT NULL,
    "validationErrors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamModel" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "year" INTEGER,
    "governorate" TEXT,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MIXED',
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExamModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamModelQuestion" (
    "id" TEXT NOT NULL,
    "examModelId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "points" DECIMAL(8,2) NOT NULL DEFAULT 1,

    CONSTRAINT "ExamModelQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionImportJob_uploadedById_createdAt_idx" ON "QuestionImportJob"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionImportJob_status_createdAt_idx" ON "QuestionImportJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamModel_slug_key" ON "ExamModel"("slug");

-- CreateIndex
CREATE INDEX "ExamModel_subjectId_isPublished_deletedAt_idx" ON "ExamModel"("subjectId", "isPublished", "deletedAt");

-- CreateIndex
CREATE INDEX "ExamModel_sourceId_idx" ON "ExamModel"("sourceId");

-- CreateIndex
CREATE INDEX "ExamModel_year_governorate_idx" ON "ExamModel"("year", "governorate");

-- CreateIndex
CREATE INDEX "ExamModel_sortOrder_idx" ON "ExamModel"("sortOrder");

-- CreateIndex
CREATE INDEX "ExamModelQuestion_questionId_idx" ON "ExamModelQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamModelQuestion_examModelId_questionId_key" ON "ExamModelQuestion"("examModelId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamModelQuestion_examModelId_sortOrder_key" ON "ExamModelQuestion"("examModelId", "sortOrder");

-- AddForeignKey
ALTER TABLE "QuestionImportJob" ADD CONSTRAINT "QuestionImportJob_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamModel" ADD CONSTRAINT "ExamModel_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamModel" ADD CONSTRAINT "ExamModel_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamModelQuestion" ADD CONSTRAINT "ExamModelQuestion_examModelId_fkey" FOREIGN KEY ("examModelId") REFERENCES "ExamModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamModelQuestion" ADD CONSTRAINT "ExamModelQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
