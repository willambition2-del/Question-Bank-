CREATE TABLE "StudentDailyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "answeredQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "wrongAnswers" INTEGER NOT NULL DEFAULT 0,
    "quizzesCompleted" INTEGER NOT NULL DEFAULT 0,
    "challengesPlayed" INTEGER NOT NULL DEFAULT 0,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "studyTimeSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudentDailyActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentDailyActivity_userId_date_key"
ON "StudentDailyActivity"("userId", "date");

CREATE INDEX "StudentDailyActivity_userId_date_idx"
ON "StudentDailyActivity"("userId", "date");

ALTER TABLE "StudentDailyActivity"
ADD CONSTRAINT "StudentDailyActivity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
