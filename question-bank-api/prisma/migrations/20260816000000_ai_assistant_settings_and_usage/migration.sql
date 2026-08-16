-- CreateEnum
CREATE TYPE "AiResetPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'NEVER');

-- CreateTable
CREATE TABLE "AiAssistantSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "providerId" TEXT,
    "modelId" TEXT,
    "fallbackModelId" TEXT,
    "userMessageLimit" INTEGER NOT NULL DEFAULT 20,
    "resetPeriod" "AiResetPeriod" NOT NULL DEFAULT 'DAILY',
    "limitMessage" TEXT NOT NULL DEFAULT 'لقد وصلت إلى الحد المسموح للمساعد الذكي.',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAssistantSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUserUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUserUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiUserUsage_userId_periodKey_key" ON "AiUserUsage"("userId", "periodKey");

-- CreateIndex
CREATE INDEX "AiUserUsage_periodKey_idx" ON "AiUserUsage"("periodKey");

-- CreateIndex
CREATE INDEX "AiUserUsage_userId_idx" ON "AiUserUsage"("userId");

-- AddForeignKey
ALTER TABLE "AiUserUsage" ADD CONSTRAINT "AiUserUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
