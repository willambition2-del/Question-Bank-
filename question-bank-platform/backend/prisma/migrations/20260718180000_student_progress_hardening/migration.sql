ALTER TABLE "StudentQuestionProgress"
ADD COLUMN "lastTimeMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAnswerCorrect" BOOLEAN,
ADD COLUMN "lastSelectedOptionId" TEXT,
ADD COLUMN "lastSelectedBoolean" BOOLEAN,
ADD COLUMN "firstAnsweredAt" TIMESTAMP(3),
ADD COLUMN "masteredAt" TIMESTAMP(3);

UPDATE "StudentQuestionProgress"
SET "firstAnsweredAt" = "createdAt"
WHERE "attemptsCount" > 0 AND "firstAnsweredAt" IS NULL;

UPDATE "StudentQuestionProgress"
SET "masteredAt" = "updatedAt"
WHERE "isMastered" = true AND "masteredAt" IS NULL;

ALTER TABLE "SavedQuestion"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
