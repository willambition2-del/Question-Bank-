# Gamification + Achievements + Leaderboards Hardening Audit

Date: 2026-07-19
Status: COMPLETE_FOR_SELECTED_PHASE

## Baseline and defects

The existing points, achievement, daily-task, streak and leaderboard models were reused. The initial ledger used a read-before-create sequence that could fail under concurrent duplicates; achievement unlocks had the same race; challenge wins were hardcoded to zero; zero-reward achievements did not notify; the seed omitted several required badges; and leaderboards exposed only a points-like score without explicit XP/points/wins metrics.

## Implemented hardening

- `PointTransaction.idempotencyKey` is now claimed with `createMany(skipDuplicates)` before any balance increment, making duplicate awards atomic across processes.
- `UserAchievement(userId, achievementId)` is claimed in the same database-driven way, so badge, notification and reward side effects execute once.
- Achievement metrics now include persisted challenge wins, lifetime points and fast-answer ledger events.
- Achievement notifications are created for every unlock, including badges with no points reward.
- The seed defines first quiz, 100 questions, 1000 lifetime points, seven-day streak, subject mastery, fast answers and challenge wins, while retaining existing badges and daily tasks.
- XP/levels use the centralized level thresholds and lifetime positive ledger totals; spendable/current points remain separately available.
- Leaderboards support `metric=xp|points|wins` across daily, weekly, monthly and all-time periods, global/school/subject scopes, stable shared ranks and privacy-safe student projections.
- Periodic XP/points derive from `PointTransaction`; wins derive from completed Challenges. The client cannot submit score totals.

## Migration

Added `20260719010000_gamification_hardening`, which only appends `TOTAL_POINTS` and `FAST_ANSWERS` to `AchievementConditionType`. The SQL was reviewed before deploy. All 15 migrations are applied to development and test databases; Prisma status is current and diff is empty.

## Verification

- Format, lint and build: pass.
- Unit: 23 suites / 118 tests, all pass.
- PostgreSQL E2E: 11 suites / 57 tests, all pass.
- Real concurrency tests prove one point transaction/balance increment and one achievement/notification under competing transactions.
- Real HTTP tests prove XP and win leaderboards use server-owned persisted ledgers.

## Remaining honest limits

- Level thresholds remain application configuration rather than database-managed seasons.
- Leaderboard cache invalidation is TTL-based; Phase 5 provides production Redis and multi-instance behavior.