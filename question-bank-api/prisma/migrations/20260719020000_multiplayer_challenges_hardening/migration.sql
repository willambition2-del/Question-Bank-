ALTER TYPE "ChallengeMode" ADD VALUE IF NOT EXISTS 'TWO_VS_TWO';

ALTER TABLE "ChallengeParticipant" ADD COLUMN "team" INTEGER;
ALTER TABLE "Challenge" ADD COLUMN "winnerTeam" INTEGER;

CREATE INDEX "ChallengeParticipant_challengeId_team_status_idx"
ON "ChallengeParticipant"("challengeId", "team", "status");

