-- CreateTable
CREATE TABLE "UserSubjectFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubjectFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSubjectFavorite_userId_createdAt_idx" ON "UserSubjectFavorite"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSubjectFavorite_subjectId_idx" ON "UserSubjectFavorite"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubjectFavorite_userId_subjectId_key" ON "UserSubjectFavorite"("userId", "subjectId");

-- AddForeignKey
ALTER TABLE "UserSubjectFavorite" ADD CONSTRAINT "UserSubjectFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubjectFavorite" ADD CONSTRAINT "UserSubjectFavorite_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
