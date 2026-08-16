import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  AiResetPeriod,
  RoutingStrategy,
  ServiceTaskType,
  UserRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type {
  UpdateAiAssistantSettingsDto,
  UserUsageQueryDto,
} from './dto/ai-assistant-settings.dto';

export interface UsageStatus {
  enabled: boolean;
  limit: number;
  used: number;
  remaining: number | null;
  resetPeriod: AiResetPeriod;
  resetAt: string | null;
  limitMessage?: string;
}

export function getPeriodKeyAndReset(
  period: AiResetPeriod,
  date = new Date(),
): { periodKey: string; resetAt: string | null; ttlSeconds: number } {
  const now = new Date(date);
  if (period === AiResetPeriod.DAILY) {
    const day = now.toISOString().slice(0, 10);
    const nextDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    const ttlSeconds = Math.max(
      1,
      Math.ceil((nextDay.getTime() - now.getTime()) / 1000),
    );
    return {
      periodKey: `day:${day}`,
      resetAt: nextDay.toISOString(),
      ttlSeconds,
    };
  }
  if (period === AiResetPeriod.WEEKLY) {
    const dayOfWeek = now.getUTCDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - distanceToMonday,
      ),
    );
    const nextMonday = new Date(
      Date.UTC(
        monday.getUTCFullYear(),
        monday.getUTCMonth(),
        monday.getUTCDate() + 7,
      ),
    );
    const ttlSeconds = Math.max(
      1,
      Math.ceil((nextMonday.getTime() - now.getTime()) / 1000),
    );
    return {
      periodKey: `week:${monday.toISOString().slice(0, 10)}`,
      resetAt: nextMonday.toISOString(),
      ttlSeconds,
    };
  }
  if (period === AiResetPeriod.MONTHLY) {
    const month = now.toISOString().slice(0, 7);
    const nextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const ttlSeconds = Math.max(
      1,
      Math.ceil((nextMonth.getTime() - now.getTime()) / 1000),
    );
    return {
      periodKey: `month:${month}`,
      resetAt: nextMonth.toISOString(),
      ttlSeconds,
    };
  }
  return { periodKey: 'all_time', resetAt: null, ttlSeconds: 315360000 };
}

@Injectable()
export class AiAssistantSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getSettings() {
    let setting = await this.prisma.aiAssistantSetting.findUnique({
      where: { id: 'default' },
    });
    if (!setting) {
      setting = await this.prisma.aiAssistantSetting.create({
        data: {
          id: 'default',
          enabled: false,
          userMessageLimit: 20,
          resetPeriod: AiResetPeriod.DAILY,
          limitMessage: 'لقد وصلت إلى الحد المسموح للمساعد الذكي.',
        },
      });
    }
    return setting;
  }

  async updateSettings(actorId: string, dto: UpdateAiAssistantSettingsDto) {
    if (dto.modelId) {
      const model = await this.prisma.serviceModel.findUnique({
        where: { id: dto.modelId },
        include: { provider: true },
      });
      if (!model) {
        throw new BadRequestException({
          code: 'MODEL_NOT_FOUND',
          message: 'Selected model does not exist',
        });
      }
      if (dto.providerId && model.providerId !== dto.providerId) {
        throw new BadRequestException({
          code: 'MODEL_PROVIDER_MISMATCH',
          message: 'Selected model does not belong to selected provider',
        });
      }
      if (dto.enabled && (!model.enabled || !model.provider.enabled)) {
        throw new BadRequestException({
          code: 'CANNOT_ENABLE_DISABLED_MODEL',
          message:
            'Cannot enable AI assistant with disabled provider or model. Please enable the provider and model first.',
        });
      }
    }

    if (dto.fallbackModelId) {
      const fallback = await this.prisma.serviceModel.findUnique({
        where: { id: dto.fallbackModelId },
      });
      if (!fallback) {
        throw new BadRequestException({
          code: 'FALLBACK_MODEL_NOT_FOUND',
          message: 'Selected fallback model does not exist',
        });
      }
    }

    const current = await this.getSettings();
    const updated = await this.prisma.aiAssistantSetting.update({
      where: { id: 'default' },
      data: {
        enabled: dto.enabled !== undefined ? dto.enabled : current.enabled,
        providerId:
          dto.providerId !== undefined ? dto.providerId : current.providerId,
        modelId: dto.modelId !== undefined ? dto.modelId : current.modelId,
        fallbackModelId:
          dto.fallbackModelId !== undefined
            ? dto.fallbackModelId
            : current.fallbackModelId,
        userMessageLimit:
          dto.userMessageLimit !== undefined
            ? dto.userMessageLimit
            : current.userMessageLimit,
        resetPeriod:
          dto.resetPeriod !== undefined
            ? dto.resetPeriod
            : current.resetPeriod,
        limitMessage:
          dto.limitMessage !== undefined
            ? dto.limitMessage.trim()
            : current.limitMessage,
        updatedById: actorId,
      },
    });

    await this.syncWithSystemPolicies(updated);
    return updated;
  }

  private async syncWithSystemPolicies(setting: {
    enabled: boolean;
    modelId: string | null;
    fallbackModelId: string | null;
    userMessageLimit: number;
    resetPeriod: AiResetPeriod;
  }) {
    const taskType = ServiceTaskType.STUDY_ASSISTANT;

    const existingPolicy = await this.prisma.featureUsagePolicy.findFirst({
      where: { taskType, subscriptionTier: null },
    });
    if (existingPolicy) {
      await this.prisma.featureUsagePolicy.update({
        where: { id: existingPolicy.id },
        data: {
          enabled: setting.enabled,
          userDailyLimit:
            setting.resetPeriod === AiResetPeriod.DAILY
              ? setting.userMessageLimit
              : 0,
          userMonthlyLimit:
            setting.resetPeriod === AiResetPeriod.MONTHLY
              ? setting.userMessageLimit
              : 0,
        },
      });
    } else {
      await this.prisma.featureUsagePolicy.create({
        data: {
          taskType,
          enabled: setting.enabled,
          userDailyLimit:
            setting.resetPeriod === AiResetPeriod.DAILY
              ? setting.userMessageLimit
              : 0,
          userMonthlyLimit:
            setting.resetPeriod === AiResetPeriod.MONTHLY
              ? setting.userMessageLimit
              : 0,
          allowedRoles: [
            UserRole.STUDENT,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
          ],
        },
      });
    }

    if (setting.modelId) {
      const candidates = [{ modelId: setting.modelId, priority: 1, weight: 1 }];
      if (setting.fallbackModelId && setting.fallbackModelId !== setting.modelId) {
        candidates.push({
          modelId: setting.fallbackModelId,
          priority: 2,
          weight: 1,
        });
      }

      const existingRoute = await this.prisma.routingPolicy.findFirst({
        where: { taskType },
      });

      if (existingRoute) {
        await this.prisma.$transaction([
          this.prisma.routingCandidate.deleteMany({
            where: { routingPolicyId: existingRoute.id },
          }),
          this.prisma.routingPolicy.update({
            where: { id: existingRoute.id },
            data: {
              enabled: setting.enabled,
              primaryModelId: setting.modelId,
              strategy: RoutingStrategy.PRIORITY,
              candidates: { create: candidates },
              routingVersion: { increment: 1 },
            },
          }),
        ]);
      } else {
        await this.prisma.routingPolicy.create({
          data: {
            taskType,
            nameInternal: 'Study Assistant Default Policy',
            enabled: setting.enabled,
            primaryModelId: setting.modelId,
            strategy: RoutingStrategy.PRIORITY,
            candidates: { create: candidates },
          },
        });
      }
    }
  }

  async getUsageStatus(userId: string): Promise<UsageStatus> {
    const setting = await this.getSettings();
    const { periodKey, resetAt } = getPeriodKeyAndReset(setting.resetPeriod);

    const usageRecord = await this.prisma.aiUserUsage.findUnique({
      where: { userId_periodKey: { userId, periodKey } },
    });

    const used = usageRecord?.messageCount ?? 0;
    const limit = setting.userMessageLimit;
    const isUnlimited = limit === 0;
    const remaining = isUnlimited ? null : Math.max(0, limit - used);

    return {
      enabled: setting.enabled,
      limit,
      used,
      remaining,
      resetPeriod: setting.resetPeriod,
      resetAt,
      limitMessage: setting.limitMessage,
    };
  }

  async assertAndConsumeMessage(userId: string): Promise<UsageStatus> {
    const setting = await this.getSettings();
    if (!setting.enabled) {
      throw new ForbiddenException({
        code: 'AI_ASSISTANT_DISABLED',
        message: 'المساعد الذكي غير متاح حاليًا.',
      });
    }

    const { periodKey, resetAt } = getPeriodKeyAndReset(setting.resetPeriod);
    const limit = setting.userMessageLimit;
    const isUnlimited = limit === 0;

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.aiUserUsage.findUnique({
        where: { userId_periodKey: { userId, periodKey } },
      });

      const currentCount = current?.messageCount ?? 0;
      if (!isUnlimited && currentCount >= limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            code: 'AI_MESSAGE_LIMIT_REACHED',
            message:
              setting.limitMessage ||
              'لقد وصلت إلى الحد المسموح للمساعد الذكي.',
            limit,
            used: currentCount,
            remaining: 0,
            resetAt,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const updated = await tx.aiUserUsage.upsert({
        where: { userId_periodKey: { userId, periodKey } },
        create: {
          userId,
          periodKey,
          messageCount: 1,
        },
        update: {
          messageCount: { increment: 1 },
        },
      });

      const used = updated.messageCount;
      const remaining = isUnlimited ? null : Math.max(0, limit - used);

      return {
        enabled: setting.enabled,
        limit,
        used,
        remaining,
        resetPeriod: setting.resetPeriod,
        resetAt,
      };
    });
  }

  async listUserUsage(query: UserUsageQueryDto) {
    const setting = await this.getSettings();
    const { periodKey, resetAt } = getPeriodKeyAndReset(setting.resetPeriod);
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const whereUser = query.search?.trim()
      ? {
          OR: [
            { name: { contains: query.search.trim(), mode: 'insensitive' as const } },
            { email: { contains: query.search.trim(), mode: 'insensitive' as const } },
            { username: { contains: query.search.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          ...whereUser,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          aiUsages: {
            where: { periodKey },
            select: { messageCount: true, updatedAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({
        where: {
          ...whereUser,
          deletedAt: null,
        },
      }),
    ]);

    const maxLimit = setting.userMessageLimit;
    const items = users.map((u) => {
      const used = u.aiUsages[0]?.messageCount ?? 0;
      const isUnlimited = maxLimit === 0;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username,
        role: u.role,
        used,
        limit: maxLimit,
        remaining: isUnlimited ? null : Math.max(0, maxLimit - used),
        periodKey,
        resetPeriod: setting.resetPeriod,
        resetAt,
        lastUsedAt: u.aiUsages[0]?.updatedAt ?? null,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      resetPeriod: setting.resetPeriod,
      resetAt,
      defaultLimit: maxLimit,
    };
  }
}
