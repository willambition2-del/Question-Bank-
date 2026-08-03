import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { ServiceTaskType } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { AssistantResponse } from '../public-response';

@Injectable()
export class AssistantCacheService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async get(
    taskType: ServiceTaskType,
    content: string,
    promptVersion: number,
  ): Promise<AssistantResponse | null> {
    return this.redis.getJson<AssistantResponse>(
      await this.key(taskType, content, promptVersion),
    );
  }

  async set(
    taskType: ServiceTaskType,
    content: string,
    promptVersion: number,
    value: AssistantResponse,
  ): Promise<void> {
    await this.redis.setJson(
      await this.key(taskType, content, promptVersion),
      value,
      this.config.get<number>('ASSISTANT_CACHE_TTL_SECONDS', 3600),
    );
  }

  private async key(
    taskType: ServiceTaskType,
    content: string,
    promptVersion: number,
  ) {
    const route = await this.prisma.routingPolicy.findFirst({
      where: { taskType, enabled: true },
      orderBy: { updatedAt: 'desc' },
      select: { routingVersion: true },
    });
    const digest = createHash('sha256')
      .update(content.normalize('NFKC'))
      .digest('hex');
    return [
      'assistant-cache',
      taskType,
      digest,
      `prompt-${promptVersion}`,
      `route-${route?.routingVersion ?? 0}`,
      'safety-public-v1',
    ].join(':');
  }
}
