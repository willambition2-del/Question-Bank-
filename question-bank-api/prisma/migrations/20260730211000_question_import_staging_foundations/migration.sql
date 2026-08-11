-- CreateEnum
CREATE TYPE "QuestionImportMode" AS ENUM ('DRY_RUN', 'IMPORT');

-- CreateEnum
CREATE TYPE "QuestionImportRowStatus" AS ENUM ('VALID', 'WARNING', 'INVALID', 'DUPLICATE', 'IMPORTED', 'UPDATED', 'SKIPPED', 'REQUIRES_REVIEW', 'FAILED', 'REVIEW_CONFLICT');

-- CreateEnum
CREATE TYPE "QuestionImportSourceType" AS ENUM ('CSV', 'JSON', 'XLSX', 'SQLITE', 'POSTGRES_DUMP', 'ZIP', 'PDF', 'MANUAL');

-- CreateEnum
CREATE TYPE "QuestionImportConflictPolicy" AS ENUM ('SKIP_EXISTING', 'CREATE_NEW_VERSION', 'UPDATE_MISSING_FIELDS_ONLY', 'MERGE_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "QuestionImportRollbackStatus" AS ENUM ('REQUESTED', 'COMPLETED', 'COMPLETED_WITH_BLOCKS', 'BLOCKED_BY_DEPENDENCIES', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ImportFileType" ADD VALUE 'XLSX';
ALTER TYPE "ImportFileType" ADD VALUE 'SQLITE';
ALTER TYPE "ImportFileType" ADD VALUE 'POSTGRES_DUMP';
ALTER TYPE "ImportFileType" ADD VALUE 'ZIP';
ALTER TYPE "ImportFileType" ADD VALUE 'PDF';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ImportStatus" ADD VALUE 'UPLOADED';
ALTER TYPE "ImportStatus" ADD VALUE 'ANALYZING';
ALTER TYPE "ImportStatus" ADD VALUE 'MAPPING_REQUIRED';
ALTER TYPE "ImportStatus" ADD VALUE 'READY_FOR_DRY_RUN';
ALTER TYPE "ImportStatus" ADD VALUE 'DRY_RUNNING';
ALTER TYPE "ImportStatus" ADD VALUE 'DRY_RUN_COMPLETED';
ALTER TYPE "ImportStatus" ADD VALUE 'IMPORTING';
ALTER TYPE "ImportStatus" ADD VALUE 'PAUSED';
ALTER TYPE "ImportStatus" ADD VALUE 'COMPLETED_WITH_WARNINGS';
ALTER TYPE "ImportStatus" ADD VALUE 'ROLLED_BACK';

-- AlterTable
ALTER TABLE "QuestionImportJob" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "conflictPolicy" "QuestionImportConflictPolicy" NOT NULL DEFAULT 'SKIP_EXISTING',
ADD COLUMN     "cursor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errorSummary" JSONB,
ADD COLUMN     "failedRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mode" "QuestionImportMode" NOT NULL DEFAULT 'DRY_RUN',
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "processedRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settingsJson" JSONB,
ADD COLUMN     "skippedRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceType" "QuestionImportSourceType",
ADD COLUMN     "storagePath" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "updatedRows" INTEGER NOT NULL DEFAULT 0;

UPDATE "QuestionImportJob" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP);
ALTER TABLE "QuestionImportJob" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "QuestionImportRow" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sheetName" TEXT,
    "externalId" TEXT,
    "sourcePayloadJson" JSONB NOT NULL,
    "normalizedPayloadJson" JSONB,
    "destinationQuestionId" TEXT,
    "status" "QuestionImportRowStatus" NOT NULL,
    "errorCodes" JSONB,
    "warningCodes" JSONB,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSourceReference" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "importJobId" TEXT,
    "sourceType" "QuestionImportSourceType" NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceRow" INTEGER,
    "externalId" TEXT,
    "sourceChecksum" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionImportRollback" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "status" "QuestionImportRollbackStatus" NOT NULL DEFAULT 'REQUESTED',
    "deletedRows" INTEGER NOT NULL DEFAULT 0,
    "blockedRows" INTEGER NOT NULL DEFAULT 0,
    "blockedReason" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionImportRollback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionExportAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "filtersJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionExportAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionImportRow_importJobId_status_rowNumber_idx" ON "QuestionImportRow"("importJobId", "status", "rowNumber");

-- CreateIndex
CREATE INDEX "QuestionImportRow_fingerprint_idx" ON "QuestionImportRow"("fingerprint");

-- CreateIndex
CREATE INDEX "QuestionImportRow_destinationQuestionId_idx" ON "QuestionImportRow"("destinationQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionImportRow_importJobId_rowNumber_sheetName_key" ON "QuestionImportRow"("importJobId", "rowNumber", "sheetName");

-- CreateIndex
CREATE INDEX "QuestionSourceReference_questionId_importedAt_idx" ON "QuestionSourceReference"("questionId", "importedAt");

-- CreateIndex
CREATE INDEX "QuestionSourceReference_importJobId_idx" ON "QuestionSourceReference"("importJobId");

-- CreateIndex
CREATE INDEX "QuestionSourceReference_externalId_idx" ON "QuestionSourceReference"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSourceReference_sourceType_sourceChecksum_sourceRow_key" ON "QuestionSourceReference"("sourceType", "sourceChecksum", "sourceRow", "externalId");

-- CreateIndex
CREATE INDEX "QuestionImportRollback_importJobId_createdAt_idx" ON "QuestionImportRollback"("importJobId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionImportRollback_actorId_createdAt_idx" ON "QuestionImportRollback"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionExportAudit_actorId_createdAt_idx" ON "QuestionExportAudit"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionImportJob_checksum_key" ON "QuestionImportJob"("checksum");

-- CreateIndex
CREATE INDEX "QuestionImportJob_sourceType_createdAt_idx" ON "QuestionImportJob"("sourceType", "createdAt");

-- AddForeignKey
ALTER TABLE "QuestionImportRow" ADD CONSTRAINT "QuestionImportRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "QuestionImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSourceReference" ADD CONSTRAINT "QuestionSourceReference_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSourceReference" ADD CONSTRAINT "QuestionSourceReference_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "QuestionImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionImportRollback" ADD CONSTRAINT "QuestionImportRollback_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "QuestionImportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionImportRollback" ADD CONSTRAINT "QuestionImportRollback_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionExportAudit" ADD CONSTRAINT "QuestionExportAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
