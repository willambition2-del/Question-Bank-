import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AppDateService } from './app-date.service';
import { LevelService } from './level.service';
import { PointsService } from './points.service';
import { StreakService } from './streak.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('Gamification phase G', () => {
  it('uses centralized level thresholds', () => {
    const levels = new LevelService();
    expect(levels.progress(99).currentLevel).toBe(1);
    expect(levels.progress(100).currentLevel).toBe(2);
    expect(levels.progress(250).currentLevel).toBe(3);
  });

  it('does not award the same idempotency key twice', async () => {
    const existing = {
      id: 'transaction-1',
      idempotencyKey: 'quiz-complete:attempt-1',
    };
    const tx = {
      pointTransaction: {
        createMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(existing),
      },
      userPoints: {
        upsert: jest.fn().mockResolvedValue({
          totalPoints: 120,
          lifetimePoints: 120,
          level: 1,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new PointsService({} as PrismaService, new LevelService());
    const input = {
      amount: 20,
      type: 'QUIZ_COMPLETE' as const,
      idempotencyKey: 'quiz-complete:attempt-1',
    };
    const first = await service.award(tx as never, 'user-1', input);
    const second = await service.award(tx as never, 'user-1', input);
    expect(first.awarded).toBe(true);
    expect(second.awarded).toBe(false);
    expect(tx.pointTransaction.createMany).toHaveBeenCalledTimes(2);
    expect(tx.pointTransaction.findUniqueOrThrow).toHaveBeenCalledTimes(2);
    expect(tx.userPoints.upsert).toHaveBeenCalledTimes(1);
  });

  it('increments a streak only once per application day', async () => {
    const config = { get: jest.fn().mockReturnValue('Asia/Aden') };
    const dates = new AppDateService(config as unknown as ConfigService);
    const current = {
      id: 'streak-1',
      userId: 'user-1',
      currentDays: 2,
      bestDays: 2,
      lastActiveDate: new Date('2026-07-17T00:00:00.000Z'),
      updatedAt: new Date(),
    };
    const tx = {
      userStreak: {
        findUnique: jest.fn().mockResolvedValue(current),
        upsert: jest.fn().mockResolvedValue({ ...current, currentDays: 3 }),
      },
    };
    const service = new StreakService(dates);
    const result = await service.recordActivity(
      tx as never,
      'user-1',
      new Date('2026-07-18T12:00:00.000Z'),
    );
    expect(result.currentDays).toBe(3);
    expect(tx.userStreak.upsert).toHaveBeenCalledTimes(1);
  });
});
