import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));

describe('HealthController', () => {
  let controller: HealthController;
  const prismaService = { $queryRaw: jest.fn() };
  const redisService = { ping: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  it('returns database, Redis and memory health', async () => {
    prismaService.$queryRaw.mockResolvedValue([{ result: 1 }]);
    redisService.ping.mockResolvedValue('connected');
    await expect(controller.check()).resolves.toMatchObject({
      status: 'ok',
      database: 'connected',
      redis: 'connected',
      memory: {
        rssBytes: expect.any(Number) as number,
        heapUsedBytes: expect.any(Number) as number,
      },
      timestamp: expect.any(String) as string,
    });
  });

  it('handles dependency failure without exposing its error', async () => {
    prismaService.$queryRaw.mockResolvedValue([{ result: 1 }]);
    redisService.ping.mockRejectedValue(new Error('sensitive Redis details'));
    await expect(controller.check()).rejects.toEqual(
      new ServiceUnavailableException('A required service is unavailable'),
    );
  });
});
