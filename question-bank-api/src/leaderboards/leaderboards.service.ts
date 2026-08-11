import { BadRequestException, Injectable } from '@nestjs/common';
import { createPageMeta } from '../common/pagination/pagination';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  LeaderboardMetric,
  LeaderboardPeriod,
  LeaderboardQueryDto,
  LeaderboardScope,
} from './dto/leaderboard-query.dto';

type RankedPlayer = {
  rank: number;
  userId: string;
  displayName: string;
  schoolName: string | null;
  points: number;
  level: number;
  companion: string;
  accuracyPercent: number;
};

@Injectable()
export class LeaderboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(userId: string, query: LeaderboardQueryDto) {
    const ranked = await this.ranked(userId, query);
    const start = (query.page - 1) * query.limit;
    return {
      period: query.period,
      scope: query.scope,
      metric: query.metric,
      currentUser: ranked.find((player) => player.userId === userId) ?? null,
      topPlayers: ranked.slice(start, start + query.limit),
      pagination: createPageMeta(query.page, query.limit, ranked.length),
    };
  }

  async me(userId: string, query: LeaderboardQueryDto) {
    const ranked = await this.ranked(userId, query);
    const index = ranked.findIndex((player) => player.userId === userId);
    return {
      currentUser: index >= 0 ? ranked[index] : null,
      surroundingPlayers:
        index < 0 ? [] : ranked.slice(Math.max(0, index - 2), index + 3),
      period: query.period,
      scope: query.scope,
      metric: query.metric,
    };
  }

  private async ranked(userId: string, query: LeaderboardQueryDto) {
    const cacheKey = `leaderboard:${query.period}:${query.scope}:${query.subjectId ?? 'all'}:${userId}`;
    const cached = await this.redis.getJson<RankedPlayer[]>(cacheKey);
    if (cached) return cached;

    if (query.scope === LeaderboardScope.SUBJECT && !query.subjectId) {
      throw new BadRequestException({
        code: 'SUBJECT_ID_REQUIRED',
        message: 'subjectId is required for subject leaderboards',
      });
    }
    const actor = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { schoolName: true },
    });
    const userWhere = {
      role: UserRole.STUDENT,
      isActive: true,
      deletedAt: null,
      ...(query.scope === LeaderboardScope.SCHOOL
        ? { schoolName: actor?.schoolName ?? '__NO_SCHOOL__' }
        : {}),
    };
    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        schoolName: true,
        companion: true,
        points: {
          select: { totalPoints: true, lifetimePoints: true, level: true },
        },
      },
    });
    const allowed = new Set(users.map((user) => user.id));
    const scores = new Map<string, number>();

    if (query.scope === LeaderboardScope.SUBJECT) {
      if (allowed.size > 0) {
        const userIds = [...allowed];
        const rows =
          query.period === LeaderboardPeriod.ALL
            ? await this.prisma.$queryRaw<
                Array<{ userId: string; points: bigint }>
              >`
                SELECT a."userId", COALESCE(SUM(qa."pointsEarned"), 0)::bigint AS points
                FROM "QuizAnswer" qa
                JOIN "QuizAttempt" a ON a.id = qa."attemptId"
                JOIN "Question" q ON q.id = qa."questionId"
                WHERE q."subjectId" = ${query.subjectId}
                  AND a."userId" = ANY(${userIds}::text[])
                GROUP BY a."userId"
              `
            : await this.prisma.$queryRaw<
                Array<{ userId: string; points: bigint }>
              >`
                SELECT a."userId", COALESCE(SUM(qa."pointsEarned"), 0)::bigint AS points
                FROM "QuizAnswer" qa
                JOIN "QuizAttempt" a ON a.id = qa."attemptId"
                JOIN "Question" q ON q.id = qa."questionId"
                WHERE q."subjectId" = ${query.subjectId}
                  AND qa."answeredAt" >= ${this.periodStart(query.period)}
                  AND a."userId" = ANY(${userIds}::text[])
                GROUP BY a."userId"
              `;
        for (const row of rows) scores.set(row.userId, Number(row.points));
      }
    } else if (query.period === LeaderboardPeriod.ALL) {
      for (const user of users)
        scores.set(
          user.id,
          query.metric === LeaderboardMetric.XP
            ? (user.points?.lifetimePoints ?? 0)
            : (user.points?.totalPoints ?? 0),
        );
    } else {
      const from = this.periodStart(query.period);
      const transactions = await this.prisma.pointTransaction.groupBy({
        by: ['userId'],
        where: {
          userId: { in: [...allowed] },
          createdAt: { gte: from },
          ...(query.metric === LeaderboardMetric.XP
            ? { amount: { gt: 0 } }
            : {}),
        },
        _sum: { amount: true },
      });
      for (const row of transactions) {
        scores.set(row.userId, row._sum.amount ?? 0);
      }
    }

    if (query.metric === LeaderboardMetric.WINS) {
      scores.clear();
      const wins = await this.prisma.challenge.groupBy({
        by: ['winnerUserId'],
        where: {
          winnerUserId: { in: [...allowed] },
          status: 'COMPLETED',
          ...(query.scope === LeaderboardScope.SUBJECT
            ? { subjectId: query.subjectId }
            : {}),
          ...(query.period === LeaderboardPeriod.ALL
            ? {}
            : { completedAt: { gte: this.periodStart(query.period) } }),
        },
        _count: { id: true },
      });
      for (const row of wins) {
        if (row.winnerUserId) scores.set(row.winnerUserId, row._count.id);
      }
    }

    const accuracy = await this.prisma.studentQuestionProgress.groupBy({
      by: ['userId'],
      where: { userId: { in: [...allowed] } },
      _sum: { correctCount: true, attemptsCount: true },
    });
    const accuracyByUser = new Map(
      accuracy.map((row) => [
        row.userId,
        row._sum.attemptsCount
          ? Number(
              (
                ((row._sum.correctCount ?? 0) / row._sum.attemptsCount) *
                100
              ).toFixed(2),
            )
          : 0,
      ]),
    );
    const sorted = users
      .map((user) => ({
        userId: user.id,
        displayName: user.name,
        schoolName: user.schoolName,
        points: scores.get(user.id) ?? 0,
        level: user.points?.level ?? 1,
        companion: user.companion,
        accuracyPercent: accuracyByUser.get(user.id) ?? 0,
      }))
      .sort(
        (left, right) =>
          right.points - left.points ||
          right.accuracyPercent - left.accuracyPercent ||
          left.userId.localeCompare(right.userId),
      );
    let previousPoints: number | undefined;
    let previousRank = 0;
    const ranked = sorted.map((player, index): RankedPlayer => {
      if (player.points !== previousPoints) previousRank = index + 1;
      previousPoints = player.points;
      return { rank: previousRank, ...player };
    });
    await this.redis.setJson(cacheKey, ranked, 30);
    return ranked;
  }
  private periodStart(period: LeaderboardPeriod) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    const days =
      period === LeaderboardPeriod.DAILY
        ? 0
        : period === LeaderboardPeriod.WEEKLY
          ? 6
          : 29;
    date.setUTCDate(date.getUTCDate() - days);
    return date;
  }
}
