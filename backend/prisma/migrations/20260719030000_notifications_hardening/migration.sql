ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT_UNLOCKED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WEAK_SUBJECT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHALLENGE_INVITE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHALLENGE_RESULT';

CREATE TYPE "PushDevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB');

ALTER TABLE "Notification"
ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "pushSentAt" TIMESTAMP(3),
ADD COLUMN "pushAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "platform" "PushDevicePlatform" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE UNIQUE INDEX "PushDevice_target_key" ON "PushDevice"("target");
CREATE INDEX "PushDevice_userId_isActive_idx" ON "PushDevice"("userId", "isActive");

ALTER TABLE "PushDevice"
ADD CONSTRAINT "PushDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;