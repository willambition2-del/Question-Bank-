import { BadRequestException, Injectable } from '@nestjs/common';
import { educationNotFound } from '../education/education-errors';
import { QuizAttemptStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { visibleQuestionWhere } from '../progress/progress-visibility';
import { RedisService } from '../redis/redis.service';
import {
  StatisticsPeriod,
  StatisticsQueryDto,
  StatisticsRange,
} from './dto/statistics-query.dto';

type StatisticsOverview = {
  totalAnswered: number;
  totalAttempts: number;
  totalQuestions: number;
  totalAvailableQuestions: number;
  totalCorrect: number;
  totalWrong: number;
  accuracyPercent: number;
  completedQuizzes: number;
  averageQuizScore: number;
  averageAnswerTimeMs: number;
  studyTimeSeconds: number;
  masteryPercent: number;
  currentStreakDays: number;
  bestStreakDays: number;
  totalPoints: number;
  level: number;
  rank: number | null;
};
@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async overview(userId: string, query: StatisticsQueryDto) {
    const cacheKey = `statistics:overview:${userId}:${query.range}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = await this.redis.getJson<StatisticsOverview>(cacheKey);
    if (cached) return cached;
    const period = this.period(query);
    const date = this.dateFilter(period);
    const visibleQuestions = visibleQuestionWhere();
    const [
      daily,
      quizzes,
      activity,
      points,
      attemptedQuestions,
      availableQuestions,
      masteredQuestions,
    ] = await Promise.all([
      this.prisma.studentDailyActivity.aggregate({
        where: { userId, ...(date ? { date } : {}) },
        _sum: {
          answeredQuestions: true,
          correctAnswers: true,
          wrongAnswers: true,
          pointsEarned: true,
          studyTimeSeconds: true,
        },
      }),
      this.prisma.quizAttempt.aggregate({
        where: {
          userId,
          status: QuizAttemptStatus.COMPLETED,
          ...(date ? { completedAt: date } : {}),
        },
        _count: { id: true },
        _avg: { scorePercent: true },
      }),
      this.prisma.studentDailyActivity.findMany({
        where: { userId, answeredQuestions: { gt: 0 } },
        select: { date: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.userPoints.findUnique({ where: { userId } }),

      this.prisma.studentQuestionProgress.count({
        where: {
          userId,
          question: { is: visibleQuestions },
          ...(date ? { lastAnsweredAt: date } : {}),
        },
      }),
      this.prisma.question.count({ where: visibleQuestions }),
      this.prisma.studentQuestionProgress.count({
        where: {
          userId,
          isMastered: true,
          question: { is: visibleQuestions },
        },
      }),
    ]);
    const totalAnswered = daily._sum.answeredQuestions ?? 0;
    const totalAttempts = totalAnswered;
    const totalCorrect = daily._sum.correctAnswers ?? 0;
    const totalWrong = daily._sum.wrongAnswers ?? 0;
    const streak = this.streaks(activity.map((item) => item.date));
    const rank = points
      ? (await this.prisma.userPoints.count({
          where: { totalPoints: { gt: points.totalPoints } },
        })) + 1
      : null;
    const result: StatisticsOverview = {
      totalAnswered,
      totalAttempts,
      totalQuestions: attemptedQuestions,
      totalAvailableQuestions: availableQuestions,
      totalCorrect,
      totalWrong,
      accuracyPercent: this.percent(totalCorrect, totalAnswered),
      completedQuizzes: quizzes._count.id,
      averageQuizScore: Number(quizzes._avg.scorePercent ?? 0),
      averageAnswerTimeMs:
        totalAnswered === 0
          ? 0
          : Math.round(
              ((daily._sum.studyTimeSeconds ?? 0) * 1000) / totalAnswered,
            ),
      studyTimeSeconds: daily._sum.studyTimeSeconds ?? 0,
      masteryPercent: this.percent(masteredQuestions, availableQuestions),
      currentStreakDays: streak.current,
      bestStreakDays: streak.best,
      totalPoints: points?.totalPoints ?? 0,
      level: points?.level ?? 1,
      rank,
    };
    await this.redis.setJson(cacheKey, result, 60);
    return result;
  }
  async activity(userId: string, query: StatisticsQueryDto) {
    const date = this.dateFilter(this.period(query));
    return this.prisma.studentDailyActivity.findMany({
      where: { userId, ...(date ? { date } : {}) },
      select: {
        date: true,
        answeredQuestions: true,
        correctAnswers: true,
        wrongAnswers: true,
        quizzesCompleted: true,
        challengesPlayed: true,
        pointsEarned: true,
        studyTimeSeconds: true,
      },
      orderBy: { date: 'asc' },
    });
  }

  async timeAnalytics(userId: string, query: StatisticsQueryDto) {
    const activity = await this.activity(userId, query);
    const totals = activity.reduce(
      (result, item) => ({
        answeredQuestions: result.answeredQuestions + item.answeredQuestions,
        correctAnswers: result.correctAnswers + item.correctAnswers,
        wrongAnswers: result.wrongAnswers + item.wrongAnswers,
        quizzesCompleted: result.quizzesCompleted + item.quizzesCompleted,
        challengesPlayed: result.challengesPlayed + item.challengesPlayed,
        studyTimeSeconds: result.studyTimeSeconds + item.studyTimeSeconds,
      }),
      {
        answeredQuestions: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        quizzesCompleted: 0,
        challengesPlayed: 0,
        studyTimeSeconds: 0,
      },
    );
    return {
      range: query.range,
      totals: {
        ...totals,
        accuracyPercent: this.percent(
          totals.correctAnswers,
          totals.answeredQuestions,
        ),
      },
      daily: activity,
    };
  }

  async performance(userId: string) {
    const [subjects, units, lessons] = await Promise.all([
      this.subjects(userId),
      this.prisma.studentUnitProgress.findMany({
        where: {
          userId,
          unit: {
            is: {
              isActive: true,
              isPublished: true,
              deletedAt: null,
              subject: {
                is: { isActive: true, isPublished: true, deletedAt: null },
              },
            },
          },
        },
        include: {
          unit: {
            select: { id: true, name: true, slug: true, subjectId: true },
          },
        },
      }),
      this.prisma.studentLessonProgress.findMany({
        where: {
          userId,
          lesson: {
            is: {
              isActive: true,
              isPublished: true,
              deletedAt: null,
              unit: {
                is: { isActive: true, isPublished: true, deletedAt: null },
              },
              subject: {
                is: { isActive: true, isPublished: true, deletedAt: null },
              },
            },
          },
        },
        include: {
          lesson: {
            select: {
              id: true,
              name: true,
              slug: true,
              subjectId: true,
              unitId: true,
            },
          },
        },
      }),
    ]);
    const mappedUnits = units.map((row) => this.mapProgress(row, row.unit));
    const mappedLessons = lessons.map((row) =>
      this.mapProgress(row, row.lesson),
    );
    const rank = <T extends { mastery: number; accuracy: number }>(rows: T[]) =>
      [...rows].sort(
        (left, right) =>
          right.mastery - left.mastery || right.accuracy - left.accuracy,
      );
    return {
      bestSubjects: rank(subjects).slice(0, 5),
      weakSubjects: rank(subjects).reverse().slice(0, 5),
      bestUnits: rank(mappedUnits).slice(0, 5),
      weakUnits: rank(mappedUnits).reverse().slice(0, 5),
      bestLessons: rank(mappedLessons).slice(0, 5),
      weakLessons: rank(mappedLessons).reverse().slice(0, 5),
    };
  }

  async questionAnalytics(userId: string, query: StatisticsQueryDto) {
    const period = this.period(query);
    const rows = await this.prisma.studentQuestionProgress.findMany({
      where: {
        userId,
        question: { is: visibleQuestionWhere() },
        ...(period.from || period.to
          ? {
              lastAnsweredAt: {
                ...(period.from ? { gte: period.from } : {}),
                ...(period.to ? { lte: period.to } : {}),
              },
            }
          : {}),
      },
      select: {
        questionId: true,
        attemptsCount: true,
        wrongCount: true,
        averageTimeMs: true,
        masteryScore: true,
        question: {
          select: {
            difficulty: true,
            subjectId: true,
            unitId: true,
            lessonId: true,
          },
        },
      },
    });
    const difficultyDistribution = rows.reduce<Record<string, number>>(
      (result, row) => {
        result[row.question.difficulty] =
          (result[row.question.difficulty] ?? 0) + row.attemptsCount;
        return result;
      },
      {},
    );
    const attempts = rows.reduce((sum, row) => sum + row.attemptsCount, 0);
    const weightedTime = rows.reduce(
      (sum, row) => sum + row.averageTimeMs * row.attemptsCount,
      0,
    );
    return {
      difficultyDistribution,
      averageAnswerTimeMs: attempts ? Math.round(weightedTime / attempts) : 0,
      mistakeFrequency: [...rows]
        .filter((row) => row.wrongCount > 0)
        .sort(
          (left, right) =>
            right.wrongCount - left.wrongCount ||
            left.questionId.localeCompare(right.questionId),
        )
        .slice(0, 20)
        .map((row) => ({
          questionId: row.questionId,
          wrongCount: row.wrongCount,
          attemptsCount: row.attemptsCount,
          masteryPercent: Number(row.masteryScore),
          ...row.question,
        })),
    };
  }
  async subjects(userId: string) {
    const rows = await this.prisma.studentSubjectProgress.findMany({
      where: {
        userId,
        subject: { isActive: true, isPublished: true, deletedAt: null },
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            slug: true,
            iconKey: true,
            colorHex: true,
          },
        },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    return rows.map((row) => this.mapProgress(row, row.subject));
  }

  async subject(userId: string, subjectId: string) {
    const progress = await this.prisma.studentSubjectProgress.findFirst({
      where: {
        userId,
        subjectId,
        subject: { isActive: true, isPublished: true, deletedAt: null },
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            slug: true,
            iconKey: true,
            colorHex: true,
          },
        },
      },
    });
    if (!progress) {
      throw educationNotFound(
        'SUBJECT_STATISTICS_NOT_FOUND',
        'Subject statistics not found',
      );
    }
    const lessons = await this.prisma.studentLessonProgress.findMany({
      where: {
        userId,
        lesson: {
          subjectId,
          isActive: true,
          isPublished: true,
          deletedAt: null,
        },
      },
      include: { lesson: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ masteryPercent: 'asc' }, { answeredQuestions: 'desc' }],
    });
    const mapped = lessons.map((row) => this.mapProgress(row, row.lesson));
    return {
      ...this.mapProgress(progress, progress.subject),
      weakLessons: mapped.slice(0, 5),
      strongLessons: [...mapped]
        .sort((left, right) => right.mastery - left.mastery)
        .slice(0, 5),
    };
  }

  async unit(userId: string, unitId: string) {
    const progress = await this.prisma.studentUnitProgress.findFirst({
      where: {
        userId,
        unitId,
        unit: { isActive: true, isPublished: true, deletedAt: null },
      },
      include: {
        unit: { select: { id: true, name: true, slug: true, subjectId: true } },
      },
    });
    if (!progress) {
      throw educationNotFound(
        'UNIT_STATISTICS_NOT_FOUND',
        'Unit statistics not found',
      );
    }
    return this.mapProgress(progress, progress.unit);
  }

  async lesson(userId: string, lessonId: string) {
    const progress = await this.prisma.studentLessonProgress.findFirst({
      where: {
        userId,
        lessonId,
        lesson: { isActive: true, isPublished: true, deletedAt: null },
      },
      include: {
        lesson: {
          select: {
            id: true,
            name: true,
            slug: true,
            unitId: true,
            subjectId: true,
          },
        },
      },
    });
    if (!progress) {
      throw educationNotFound(
        'LESSON_STATISTICS_NOT_FOUND',
        'Lesson statistics not found',
      );
    }
    return this.mapProgress(progress, progress.lesson);
  }

  async accuracyTrend(userId: string, query: StatisticsQueryDto) {
    const activity = await this.activity(userId, query);
    return activity.map((item) => ({
      date: item.date,
      answeredCount: item.answeredQuestions,
      accuracyPercent: this.percent(
        item.correctAnswers,
        item.answeredQuestions,
      ),
    }));
  }

  async timeDistribution(userId: string, query: StatisticsQueryDto) {
    const period = this.period(query);
    const rows = await this.prisma.studentQuestionProgress.findMany({
      where: {
        userId,
        ...(period.from || period.to
          ? {
              lastAnsweredAt: {
                ...(period.from ? { gte: period.from } : {}),
                ...(period.to ? { lte: period.to } : {}),
              },
            }
          : {}),
        question: { is: visibleQuestionWhere() },
      },
      select: { averageTimeMs: true },
    });
    const buckets = [
      { key: 'FAST', maxMs: 15000, count: 0 },
      { key: 'MEDIUM', minMs: 15000, maxMs: 30000, count: 0 },
      { key: 'SLOW', minMs: 30000, count: 0 },
    ];
    for (const row of rows) {
      if (row.averageTimeMs < 15000) buckets[0].count += 1;
      else if (row.averageTimeMs < 30000) buckets[1].count += 1;
      else buckets[2].count += 1;
    }
    return buckets;
  }

  async heatmap(userId: string, query: StatisticsQueryDto) {
    const activity = await this.activity(userId, query);
    const max = Math.max(1, ...activity.map((item) => item.answeredQuestions));
    return activity.map((item) => ({
      date: item.date,
      answeredCount: item.answeredQuestions,
      correctCount: item.correctAnswers,
      activityLevel:
        item.answeredQuestions === 0
          ? 0
          : Math.max(1, Math.ceil((item.answeredQuestions / max) * 4)),
    }));
  }

  private period(query: StatisticsQueryDto): StatisticsPeriod {
    const now = new Date();
    const to = query.to ? new Date(query.to) : now;
    let from = query.from ? new Date(query.from) : undefined;
    if (!from && query.range !== StatisticsRange.ALL) {
      const days = query.range === StatisticsRange.MONTH ? 30 : 7;
      from = new Date(to);
      from.setUTCDate(from.getUTCDate() - days + 1);
      from.setUTCHours(0, 0, 0, 0);
    }
    if (from && from > to) {
      throw new BadRequestException({
        code: 'INVALID_STATISTICS_RANGE',
        message: 'from must be earlier than or equal to to',
      });
    }
    return {
      from,
      to: query.to || query.range !== StatisticsRange.ALL ? to : undefined,
    };
  }

  private dateFilter(period: StatisticsPeriod) {
    if (!period.from && !period.to) return undefined;
    return {
      ...(period.from ? { gte: period.from } : {}),
      ...(period.to ? { lte: period.to } : {}),
    };
  }

  private percent(value: number, total: number) {
    return total === 0 ? 0 : Number(((value / total) * 100).toFixed(2));
  }

  private mapProgress(
    row: {
      answeredQuestions: number;
      correctAnswers: number;
      wrongAnswers: number;
      accuracyPercent: unknown;
      masteryPercent: unknown;
      averageTimeMs: number;
      lastActivityAt: Date | null;
    },
    entity: object,
  ) {
    return {
      ...entity,
      questionsAnswered: row.answeredQuestions,
      accuracy: Number(row.accuracyPercent),
      mastery: Number(row.masteryPercent),
      averageTime: row.averageTimeMs,
      mistakes: row.wrongAnswers,
      recentTrend: Number(row.accuracyPercent),
      lastActivityAt: row.lastActivityAt,
    };
  }

  private streaks(dates: Date[]) {
    const unique = [
      ...new Set(dates.map((date) => date.toISOString().slice(0, 10))),
    ];
    let best = 0;
    let run = 0;
    let previous: Date | undefined;
    for (const key of unique) {
      const current = new Date(key + 'T00:00:00.000Z');
      run =
        previous && current.getTime() - previous.getTime() === 86400000
          ? run + 1
          : 1;
      best = Math.max(best, run);
      previous = current;
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const last = previous?.getTime();
    const current =
      last === today.getTime() || last === today.getTime() - 86400000 ? run : 0;
    return { current, best };
  }
}
