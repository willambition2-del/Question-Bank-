import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { FeatureUsagePolicy, Prisma } from '../../generated/prisma/client';
import {
  ServiceRequestStatus,
  ServiceTaskType,
  type UserRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService, type QuotaReservation } from '../../redis/redis.service';

export interface UsageAuthorization {
  policy: FeatureUsagePolicy;
  remainingToday: number | null;
}

export interface UsageSuccess {
  routingPolicyId: string;
  selectedModelId: string;
  selectedProviderId: string;
  inputTokenCount: number;
  outputTokenCount: number;
  imageCount: number;
  latencyMs: number;
  estimatedCost: number;
  fallbackCount: number;
  knowledgeUsed: boolean;
  promptVersion: number | null;
}

@Injectable()
export class UsageGovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async authorizeAndStart(input: {
    requestId: string;
    userId: string;
    taskType: ServiceTaskType;
    inputTokens: number;
    imageCount: number;
    knowledgeUsed: boolean;
  }): Promise<UsageAuthorization> {
    const policy = await this.prisma.featureUsagePolicy.findFirst({
      where: { taskType: input.taskType, subscriptionTier: null },
    });
    if (!policy?.enabled) {
      await this.rejected(input, 'FEATURE_DISABLED');
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: 'The requested platform feature is not available',
      });
    }
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, isActive: true, deletedAt: null },
      select: { role: true },
    });
    if (!user || !this.roles(policy.allowedRoles).includes(user.role)) {
      await this.rejected(input, 'FEATURE_ROLE_NOT_ALLOWED');
      throw new ForbiddenException({
        code: 'FEATURE_ROLE_NOT_ALLOWED',
        message: 'The requested platform feature is not available',
      });
    }
    if (
      input.inputTokens > policy.maxInputTokens ||
      input.imageCount > policy.maxImages
    ) {
      await this.rejected(input, 'FEATURE_INPUT_LIMIT_EXCEEDED');
      throw new ForbiddenException({
        code: 'FEATURE_INPUT_LIMIT_EXCEEDED',
        message: 'The request exceeds the allowed input limits',
      });
    }
    const quota = await this.reserve(input.userId, input.taskType, policy);
    if (!quota.allowed) {
      await this.rejected(input, quota.reason);
      throw new HttpException(
        {
          code: quota.reason,
          message: 'The usage limit for this feature has been reached',
          retryAfterSeconds: quota.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      await this.prisma.serviceRequestLog.create({
        data: {
          requestId: input.requestId,
          userId: input.userId,
          taskType: input.taskType,
          status: ServiceRequestStatus.PENDING,
          inputTokenCount: input.inputTokens,
          imageCount: input.imageCount,
          knowledgeUsed: input.knowledgeUsed,
        },
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'REQUEST_REGISTRATION_FAILED',
        message: 'The platform request could not be registered',
      });
    }
    return { policy, remainingToday: quota.remainingToday };
  }

  async authorizeSystemAndStart(input: {
    requestId: string;
    taskType: ServiceTaskType;
    inputTokens: number;
  }): Promise<FeatureUsagePolicy> {
    const policy = await this.prisma.featureUsagePolicy.findFirst({
      where: { taskType: input.taskType, subscriptionTier: null },
    });
    if (!policy?.enabled) {
      await this.prisma.serviceRequestLog.create({
        data: {
          requestId: input.requestId,
          taskType: input.taskType,
          status: ServiceRequestStatus.REJECTED,
          inputTokenCount: input.inputTokens,
          errorCode: 'FEATURE_DISABLED',
        },
      });
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: 'The requested platform feature is not available',
      });
    }
    await this.prisma.serviceRequestLog.create({
      data: {
        requestId: input.requestId,
        taskType: input.taskType,
        status: ServiceRequestStatus.PENDING,
        inputTokenCount: input.inputTokens,
      },
    });
    return policy;
  }
  async succeeded(requestId: string, usage: UsageSuccess): Promise<void> {
    await this.prisma.serviceRequestLog.updateMany({
      where: { requestId, status: ServiceRequestStatus.PENDING },
      data: {
        status: ServiceRequestStatus.SUCCEEDED,
        routingPolicyId: usage.routingPolicyId,
        selectedModelId: usage.selectedModelId,
        selectedProviderId: usage.selectedProviderId,
        inputTokenCount: usage.inputTokenCount,
        outputTokenCount: usage.outputTokenCount,
        imageCount: usage.imageCount,
        latencyMs: usage.latencyMs,
        estimatedCost: usage.estimatedCost,
        fallbackCount: usage.fallbackCount,
        knowledgeUsed: usage.knowledgeUsed,
        promptVersion: usage.promptVersion,
      },
    });
  }

  async failed(
    requestId: string,
    errorCode: string,
    latencyMs: number,
  ): Promise<void> {
    await this.prisma.serviceRequestLog.updateMany({
      where: { requestId, status: ServiceRequestStatus.PENDING },
      data: {
        status: ServiceRequestStatus.FAILED,
        errorCode: errorCode.slice(0, 100),
        latencyMs,
      },
    });
  }

  private async reserve(
    userId: string,
    taskType: ServiceTaskType,
    policy: FeatureUsagePolicy,
  ): Promise<QuotaReservation> {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const nextDay = new Date(`${day}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextMonth = new Date(`${month}-01T00:00:00.000Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return this.redis.reserveQuota({
      userDailyKey: `service-quota:user:${userId}:${taskType}:day:${day}`,
      userMonthlyKey: `service-quota:user:${userId}:${taskType}:month:${month}`,
      globalDailyKey: `service-quota:global:${taskType}:day:${day}`,
      cooldownKey: `service-quota:cooldown:${userId}:${taskType}`,
      userDailyLimit: policy.userDailyLimit,
      userMonthlyLimit: policy.userMonthlyLimit,
      globalDailyLimit: policy.globalDailyLimit,
      dayTtlSeconds: Math.max(
        1,
        Math.ceil((nextDay.getTime() - now.getTime()) / 1000),
      ),
      monthTtlSeconds: Math.max(
        1,
        Math.ceil((nextMonth.getTime() - now.getTime()) / 1000),
      ),
      cooldownSeconds: policy.cooldownSeconds,
    });
  }

  private roles(value: Prisma.JsonValue): UserRole[] {
    return Array.isArray(value)
      ? value.filter((role): role is UserRole => typeof role === 'string')
      : [];
  }

  private async rejected(
    input: {
      requestId: string;
      userId: string;
      taskType: ServiceTaskType;
      inputTokens: number;
      imageCount: number;
      knowledgeUsed: boolean;
    },
    errorCode: string,
  ) {
    await this.prisma.serviceRequestLog.create({
      data: {
        requestId: input.requestId,
        userId: input.userId,
        taskType: input.taskType,
        status: ServiceRequestStatus.REJECTED,
        inputTokenCount: input.inputTokens,
        imageCount: input.imageCount,
        knowledgeUsed: input.knowledgeUsed,
        errorCode,
      },
    });
  }
}
