-- Extend the achievement ledger metrics without replacing existing enum values.
ALTER TYPE "AchievementConditionType" ADD VALUE IF NOT EXISTS 'TOTAL_POINTS';
ALTER TYPE "AchievementConditionType" ADD VALUE IF NOT EXISTS 'FAST_ANSWERS';