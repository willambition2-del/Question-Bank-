/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ForbiddenException } from '@nestjs/common';
import type { FeatureUsagePolicy } from '../../generated/prisma/client';
import { ServiceTaskType, UserRole } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { UsageGovernanceService } from './usage-governance.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('UsageGovernanceService', () => {
  const findPolicy = jest.fn();
  const findUser = jest.fn();
  const createLog = jest.fn();
  const updateLog = jest.fn();
  const reserveQuota = jest.fn();
  const service = new UsageGovernanceService(
    {
      featureUsagePolicy: { findFirst: findPolicy },
      user: { findFirst: findUser },
      serviceRequestLog: { create: createLog, updateMany: updateLog },
    } as unknown as PrismaService,
    { reserveQuota } as unknown as RedisService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findPolicy.mockResolvedValue(policy());
    findUser.mockResolvedValue({ role: UserRole.STUDENT });
    reserveQuota.mockResolvedValue({
      allowed: true,
      reason: 'QUOTA_ALLOWED',
      remainingToday: 4,
      retryAfterSeconds: 0,
    });
    createLog.mockResolvedValue({ id: 'log-1' });
  });

  it('reserves quota and creates one pending request record', async () => {
    const result = await service.authorizeAndStart(request());

    expect(reserveQuota).toHaveBeenCalledTimes(1);
    expect(createLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: 'request-1',
        userId: 'user-1',
        inputTokenCount: 20,
      }),
    });
    expect(result.remainingToday).toBe(4);
  });

  it('fails closed and records rejection when the feature is disabled', async () => {
    findPolicy.mockResolvedValue({ ...policy(), enabled: false });

    await expect(service.authorizeAndStart(request())).rejects.toThrow(
      ForbiddenException,
    );
    expect(reserveQuota).not.toHaveBeenCalled();
    expect(createLog).toHaveBeenCalledWith({
      data: expect.objectContaining({ errorCode: 'FEATURE_DISABLED' }),
    });
  });

  it('records terminal usage exactly once from the pending state', async () => {
    await service.succeeded('request-1', {
      routingPolicyId: 'route-1',
      selectedModelId: 'model-1',
      selectedProviderId: 'provider-1',
      inputTokenCount: 10,
      outputTokenCount: 15,
      imageCount: 0,
      latencyMs: 120,
      estimatedCost: 0.02,
      fallbackCount: 1,
      knowledgeUsed: true,
      promptVersion: 2,
    });

    expect(updateLog).toHaveBeenCalledWith({
      where: { requestId: 'request-1', status: 'PENDING' },
      data: expect.objectContaining({
        status: 'SUCCEEDED',
        outputTokenCount: 15,
        estimatedCost: 0.02,
      }),
    });
  });
});

function request() {
  return {
    requestId: 'request-1',
    userId: 'user-1',
    taskType: ServiceTaskType.STUDY_ASSISTANT,
    inputTokens: 20,
    imageCount: 0,
    knowledgeUsed: false,
  };
}

function policy(): FeatureUsagePolicy {
  return {
    id: 'policy-1',
    taskType: ServiceTaskType.STUDY_ASSISTANT,
    enabled: true,
    userDailyLimit: 5,
    userMonthlyLimit: 100,
    globalDailyLimit: 1000,
    maxInputTokens: 1000,
    maxOutputTokens: 500,
    maxImages: 0,
    maxImageSize: 0,
    maxDocumentPages: 0,
    allowedRoles: [UserRole.STUDENT],
    subscriptionTier: null,
    cooldownSeconds: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
