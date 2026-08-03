import { PrismaService } from '../prisma/prisma.service';
import {
  LeaderboardMetric,
  LeaderboardPeriod,
  LeaderboardScope,
} from './dto/leaderboard-query.dto';
import { LeaderboardsService } from './leaderboards.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../generated/prisma/client', () => ({
  Prisma: {
    sql: jest.fn(),
    join: jest.fn(),
  },
}));

describe('LeaderboardsService', () => {
  it('returns privacy-safe players and stable shared ranks', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ schoolName: 'School' }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            name: 'First',
            schoolName: 'School',
            companion: 'MALE',
            points: { totalPoints: 100, level: 2 },
          },
          {
            id: 'user-2',
            name: 'Second',
            schoolName: 'School',
            companion: 'FEMALE',
            points: { totalPoints: 100, level: 2 },
          },
        ]),
      },
      studentQuestionProgress: {
        groupBy: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            _sum: { correctCount: 8, attemptsCount: 10 },
          },
          {
            userId: 'user-2',
            _sum: { correctCount: 8, attemptsCount: 10 },
          },
        ]),
      },
    };
    const service = new LeaderboardsService(
      prisma as unknown as PrismaService,
      {
        getJson: jest.fn().mockResolvedValue(null),
        setJson: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    const result = await service.list('user-1', {
      period: LeaderboardPeriod.ALL,
      scope: LeaderboardScope.GLOBAL,
      metric: LeaderboardMetric.XP,
      page: 1,
      limit: 20,
    });
    expect(result.topPlayers.map((player) => player.rank)).toEqual([1, 1]);
    expect(result.currentUser?.displayName).toBe('First');
    expect(JSON.stringify(result)).not.toContain('phone');
    expect(JSON.stringify(result)).not.toContain('username');
  });
});
