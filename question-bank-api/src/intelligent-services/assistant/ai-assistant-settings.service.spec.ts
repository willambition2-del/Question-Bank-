import { HttpStatus } from '@nestjs/common';
import { AiResetPeriod } from '../../generated/prisma/enums';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import {
  AiAssistantSettingsService,
  getPeriodKeyAndReset,
} from './ai-assistant-settings.service';

describe('AiAssistantSettingsService', () => {
  let service: AiAssistantSettingsService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = {
      aiAssistantSetting: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      serviceModel: {
        findUnique: jest.fn(),
      },
      featureUsagePolicy: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      routingPolicy: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      routingCandidate: {
        deleteMany: jest.fn(),
      },
      aiUserUsage: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => {
        if (typeof callback === 'function') {
          return callback(mockPrisma);
        }
        return Promise.all(callback);
      }),
    };
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
    };

    service = new AiAssistantSettingsService(mockPrisma, mockRedis);
  });

  describe('Period calculation', () => {
    it('calculates DAILY period key and reset timestamp', () => {
      const fixedDate = new Date('2026-08-16T10:00:00Z');
      const result = getPeriodKeyAndReset(AiResetPeriod.DAILY, fixedDate);
      expect(result.periodKey).toBe('day:2026-08-16');
      expect(result.resetAt).toBe('2026-08-17T00:00:00.000Z');
      expect(result.ttlSeconds).toBeGreaterThan(0);
    });

    it('calculates MONTHLY period key and reset timestamp', () => {
      const fixedDate = new Date('2026-08-16T10:00:00Z');
      const result = getPeriodKeyAndReset(AiResetPeriod.MONTHLY, fixedDate);
      expect(result.periodKey).toBe('month:2026-08');
      expect(result.resetAt).toBe('2026-09-01T00:00:00.000Z');
    });

    it('calculates NEVER period key', () => {
      const fixedDate = new Date('2026-08-16T10:00:00Z');
      const result = getPeriodKeyAndReset(AiResetPeriod.NEVER, fixedDate);
      expect(result.periodKey).toBe('all_time');
      expect(result.resetAt).toBeNull();
    });
  });

  describe('assertAndConsumeMessage', () => {
    it('throws ForbiddenException if assistant is disabled', async () => {
      mockPrisma.aiAssistantSetting.findUnique.mockResolvedValue({
        id: 'default',
        enabled: false,
        userMessageLimit: 10,
        resetPeriod: AiResetPeriod.DAILY,
      });

      await expect(service.assertAndConsumeMessage('user-1')).rejects.toThrow();
    });

    it('throws 429 HttpException when limit is reached', async () => {
      mockPrisma.aiAssistantSetting.findUnique.mockResolvedValue({
        id: 'default',
        enabled: true,
        userMessageLimit: 5,
        resetPeriod: AiResetPeriod.DAILY,
        limitMessage: 'Limit reached',
      });
      mockPrisma.aiUserUsage.findUnique.mockResolvedValue({
        userId: 'user-1',
        periodKey: 'day:2026-08-16',
        messageCount: 5,
      });

      try {
        await service.assertAndConsumeMessage('user-1');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse().code).toBe('AI_MESSAGE_LIMIT_REACHED');
      }
    });

    it('atomically increments and returns updated usage when under limit', async () => {
      mockPrisma.aiAssistantSetting.findUnique.mockResolvedValue({
        id: 'default',
        enabled: true,
        userMessageLimit: 10,
        resetPeriod: AiResetPeriod.DAILY,
      });
      mockPrisma.aiUserUsage.findUnique.mockResolvedValue({
        userId: 'user-1',
        periodKey: 'day:2026-08-16',
        messageCount: 3,
      });
      mockPrisma.aiUserUsage.upsert.mockResolvedValue({
        userId: 'user-1',
        periodKey: 'day:2026-08-16',
        messageCount: 4,
      });

      const result = await service.assertAndConsumeMessage('user-1');
      expect(result.enabled).toBe(true);
      expect(result.used).toBe(4);
      expect(result.remaining).toBe(6);
      expect(result.limit).toBe(10);
    });

    it('allows unlimited messages when limit is 0', async () => {
      mockPrisma.aiAssistantSetting.findUnique.mockResolvedValue({
        id: 'default',
        enabled: true,
        userMessageLimit: 0, // unlimited
        resetPeriod: AiResetPeriod.DAILY,
      });
      mockPrisma.aiUserUsage.findUnique.mockResolvedValue({
        userId: 'user-1',
        periodKey: 'day:2026-08-16',
        messageCount: 999,
      });
      mockPrisma.aiUserUsage.upsert.mockResolvedValue({
        userId: 'user-1',
        periodKey: 'day:2026-08-16',
        messageCount: 1000,
      });

      const result = await service.assertAndConsumeMessage('user-1');
      expect(result.remaining).toBeNull(); // null represents unlimited
      expect(result.used).toBe(1000);
    });
  });
});
