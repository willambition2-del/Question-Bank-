import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatisticsRange } from './dto/statistics-query.dto';
import { StatisticsService } from './statistics.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('StatisticsService', () => {
  it('builds overview from daily summaries and completed quiz aggregates', async () => {
    const prisma = {
      studentDailyActivity: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            answeredQuestions: 10,
            correctAnswers: 7,
            wrongAnswers: 3,
            pointsEarned: 70,
            studyTimeSeconds: 200,
          },
        }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { date: new Date('2026-07-16T00:00:00.000Z') },
            { date: new Date('2026-07-17T00:00:00.000Z') },
            { date: new Date('2026-07-18T00:00:00.000Z') },
          ]),
      },
      quizAttempt: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { id: 2 },
          _avg: { scorePercent: 75 },
        }),
      },
      userPoints: {
        findUnique: jest.fn().mockResolvedValue({ totalPoints: 500, level: 4 }),
        count: jest.fn().mockResolvedValue(2),
      },
      studentQuestionProgress: {
        count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(2),
      },
      question: { count: jest.fn().mockResolvedValue(5) },
    };
    const service = new StatisticsService(
      prisma as unknown as PrismaService,
      {
        getJson: jest.fn().mockResolvedValue(null),
        setJson: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    const result = await service.overview('user-1', {
      range: StatisticsRange.ALL,
    });
    expect(result).toEqual(
      expect.objectContaining({
        totalAnswered: 10,
        totalAttempts: 10,
        totalQuestions: 4,
        totalAvailableQuestions: 5,
        totalCorrect: 7,
        totalWrong: 3,
        accuracyPercent: 70,
        completedQuizzes: 2,
        averageAnswerTimeMs: 20000,
        studyTimeSeconds: 200,
        masteryPercent: 40,
        bestStreakDays: 3,
        totalPoints: 500,
        level: 4,
        rank: 3,
      }),
    );
  });

  it('rejects an inverted custom date range', async () => {
    const service = new StatisticsService(
      {} as PrismaService,
      {
        getJson: jest.fn().mockResolvedValue(null),
        setJson: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    await expect(
      service.overview('user-1', {
        range: StatisticsRange.ALL,
        from: '2026-07-18T00:00:00.000Z',
        to: '2026-07-17T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
