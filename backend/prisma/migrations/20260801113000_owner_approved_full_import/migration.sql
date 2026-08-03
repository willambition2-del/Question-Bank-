CREATE TYPE "QuestionImportApprovalMode" AS ENUM ('OWNER_APPROVED_FULL_IMPORT');
CREATE TYPE "ImportedSourceEntityType" AS ENUM ('SUBJECT', 'UNIT', 'LESSON', 'SOURCE', 'PASSAGE', 'QUESTION', 'OPTION');

ALTER TABLE "QuestionImportJob"
  ADD COLUMN "approvalMode" "QuestionImportApprovalMode",
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE TABLE "ImportedSourceRecord" (
  "id" TEXT NOT NULL,
  "importJobId" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "entityType" "ImportedSourceEntityType" NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "targetRecordId" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportedSourceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportedSourceRecord_sourceChecksum_entityType_sourceRecordId_key" ON "ImportedSourceRecord"("sourceChecksum", "entityType", "sourceRecordId");
CREATE INDEX "ImportedSourceRecord_importJobId_entityType_idx" ON "ImportedSourceRecord"("importJobId", "entityType");
CREATE INDEX "ImportedSourceRecord_entityType_targetRecordId_idx" ON "ImportedSourceRecord"("entityType", "targetRecordId");
CREATE INDEX "QuestionImportJob_approvedById_approvedAt_idx" ON "QuestionImportJob"("approvedById", "approvedAt");

ALTER TABLE "QuestionImportJob" ADD CONSTRAINT "QuestionImportJob_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportedSourceRecord" ADD CONSTRAINT "ImportedSourceRecord_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "QuestionImportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;