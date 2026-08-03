import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, UserAchievement } from '../generated/prisma/client';
import {
  AchievementConditionType,
  NotificationType,
  PointType,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PointsService } from './points.service';

@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string) {
    const rows = await this.prisma.achievement.findMany({
      where: { isActive: true },
      include: {
        users: {
          where: { userId },
          select: { unlockedAt: true, isSeen: true },
        },
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    return rows.map(({ users, ...achievement }) => ({
      ...achievement,
      name:
        achievement.isSecret && !users.length
          ? 'Secret achievement'
          : achievement.name,
      description:
        achievement.isSecret && !users.length
          ? 'Complete the hidden condition to reveal it'
          : achievement.description,
      unlocked: users.length > 0,
      unlockedAt: users[0]?.unlockedAt ?? null,
      isSeen: users[0]?.isSeen ?? false,
    }));
  }

  my(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  async markSeen(userId: string, achievementId: string) {
    const row = await this.prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId } },
    });
    if (!row) throw new NotFoundException('Achievement not found');
    return this.prisma.userAchievement.update({
      where: { id: row.id },
      data: { isSeen: true },
      include: { achievement: true },
    });
  }

  async evaluate(tx: Prisma.TransactionClient, userId: string) {
    const questionTotals = await tx.studentQuestionProgress.aggregate({
      where: { userId },
      _sum: { correctCount: true, attemptsCount: true },
    });
    const quizzes = await tx.quizAttempt.count({
      where: { userId, status: 'COMPLETED' },
    });
    const streak = await tx.userStreak.findUnique({ where: { userId } });
    const reviewed = await tx.studentQuestionProgress.count({
      where: { userId, manualReviewedAt: { not: null } },
    });
    const challengeWins = await tx.challenge.count({
      where: { winnerUserId: userId, status: 'COMPLETED' },
    });
    const fastAnswers = await tx.pointTransaction.count({
      where: { userId, type: PointType.FAST_ANSWER },
    });
    const points = await tx.userPoints.findUnique({ where: { userId } });
    const masteredSubjects = await tx.studentSubjectProgress.count({
      where: { userId, masteryPercent: { gte: 80 } },
    });
    const metrics: Record<AchievementConditionType, number> = {
      [AchievementConditionType.CORRECT_ANSWERS]:
        questionTotals._sum.correctCount ?? 0,
      [AchievementConditionType.ANSWERED_QUESTIONS]:
        questionTotals._sum.attemptsCount ?? 0,
      [AchievementConditionType.QUIZZES_COMPLETED]: quizzes,
      [AchievementConditionType.CURRENT_STREAK]: streak?.currentDays ?? 0,
      [AchievementConditionType.MISTAKES_REVIEWED]: reviewed,
      [AchievementConditionType.SUBJECT_MASTERY]: masteredSubjects,
      [AchievementConditionType.CHALLENGES_WON]: challengeWins,
      [AchievementConditionType.TOTAL_POINTS]: points?.lifetimePoints ?? 0,
      [AchievementConditionType.FAST_ANSWERS]: fastAnswers,
    };
    const definitions = await tx.achievement.findMany({
      where: { isActive: true },
    });
    const unlocked: UserAchievement[] = [];
    for (const achievement of definitions) {
      const progress = metrics[achievement.conditionType];
      if (progress < achievement.conditionValue) continue;
      const created = await tx.userAchievement.createMany({
        data: [{ userId, achievementId: achievement.id, progress }],
        skipDuplicates: true,
      });
      if (created.count === 0) continue;
      const userAchievement = await tx.userAchievement.findUniqueOrThrow({
        where: {
          userId_achievementId: { userId, achievementId: achievement.id },
        },
      });
      await this.notifications.create(tx, {
        userId,
        type: NotificationType.ACHIEVEMENT_UNLOCKED,
        title: 'Achievement unlocked',
        body: achievement.name,
        data: { achievementId: achievement.id },
      });
      if (achievement.pointsReward > 0) {
        await this.points.award(tx, userId, {
          amount: achievement.pointsReward,
          type: PointType.ACHIEVEMENT,
          idempotencyKey: `achievement:${userId}:${achievement.id}`,
          referenceType: 'Achievement',
          referenceId: achievement.id,
          description: achievement.name,
        });
      }
      unlocked.push(userAchievement);
    }
    return unlocked;
  }
}
