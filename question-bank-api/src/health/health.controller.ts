import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface HealthResponse {
  status: 'ok';
  database: 'connected';
  redis: 'connected' | 'memory';
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
  };
  uptimeSeconds: number;
  timestamp: string;
}

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Check whether the API process is alive' })
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  @ApiOperation({ summary: 'Check API, database, Redis and memory health' })
  @ApiOkResponse({ description: 'All required dependencies are available.' })
  @ApiServiceUnavailableResponse({
    description: 'A required dependency is unavailable.',
  })
  async check(): Promise<HealthResponse> {
    try {
      const [, redis] = await Promise.all([
        this.prismaService.$queryRaw`SELECT 1`,
        this.redisService.ping(),
      ]);
      const memory = process.memoryUsage();
      return {
        status: 'ok',
        database: 'connected',
        redis,
        memory: {
          rssBytes: memory.rss,
          heapUsedBytes: memory.heapUsed,
          heapTotalBytes: memory.heapTotal,
        },
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException(
        'A required service is unavailable',
      );
    }
  }
}
