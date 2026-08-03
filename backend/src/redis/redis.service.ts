import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { randomUUID } from 'node:crypto';
type ThrottleRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};
export interface QuotaReservationInput {
  userDailyKey: string;
  userMonthlyKey: string;
  globalDailyKey: string;
  cooldownKey: string;
  userDailyLimit: number;
  userMonthlyLimit: number;
  globalDailyLimit: number;
  dayTtlSeconds: number;
  monthTtlSeconds: number;
  cooldownSeconds: number;
}

export interface QuotaReservation {
  allowed: boolean;
  reason:
    | 'QUOTA_ALLOWED'
    | 'USER_DAILY_LIMIT'
    | 'USER_MONTHLY_LIMIT'
    | 'GLOBAL_DAILY_LIMIT'
    | 'FEATURE_COOLDOWN';
  remainingToday: number | null;
  retryAfterSeconds: number;
}
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly memoryLocks = new Set<string>();
  private readonly memory = new Map<
    string,
    { value: string; expiresAt?: number }
  >();
  private readonly memoryThrottle = new Map<
    string,
    { hits: number; expiresAt: number; blockedUntil: number }
  >();
  private readonly memoryQuota = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  private client?: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const host = this.config.get<string>('REDIS_HOST');
    const environment = this.config.get<string>('NODE_ENV', 'development');
    if (!host) {
      if (environment === 'production') {
        throw new Error('REDIS_HOST is required in production');
      }
      this.logger.warn(
        'REDIS_HOST is not configured; using non-production memory storage',
      );
      return;
    }
    this.client = new Redis(this.redisOptions(host));
    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
    await this.client.connect();
    await this.client.ping();
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit();
  }

  isConnected() {
    return this.client?.status === 'ready';
  }

  async ping(): Promise<'connected' | 'memory'> {
    if (!this.client) return 'memory';
    const result = await this.client.ping();
    if (result !== 'PONG') throw new Error('Unexpected Redis response');
    return 'connected';
  }

  createPubSubClients(): [Redis, Redis] | null {
    if (!this.client) return null;
    return [this.client.duplicate(), this.client.duplicate()];
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = this.client ? await this.client.get(key) : this.memoryGet(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number) {
    const raw = JSON.stringify(value);
    if (this.client) {
      await this.client.set(key, raw, 'EX', ttlSeconds);
    } else {
      this.memory.set(key, {
        value: raw,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  async del(key: string) {
    if (this.client) await this.client.del(key);
    else this.memory.delete(key);
  }

  async enqueue(queue: string, member: string, score = Date.now()) {
    if (this.client) await this.client.zadd(queue, score, member);
    else await this.setJson(`${queue}:${member}`, { score }, 600);
  }

  async dequeue(queue: string, member: string) {
    if (this.client) await this.client.zrem(queue, member);
    else await this.del(`${queue}:${member}`);
  }

  async incrementThrottle(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottleRecord> {
    if (!this.client) {
      return this.incrementMemoryThrottle(key, ttl, limit, blockDuration);
    }
    const blockKey = `${key}:blocked`;
    const result = (await this.client.eval(
      `local blockedTtl = redis.call('pttl', KEYS[2])
       if blockedTtl > 0 then
         local hits = tonumber(redis.call('get', KEYS[1]) or '0')
         return {hits, redis.call('pttl', KEYS[1]), 1, blockedTtl}
       end
       local hits = redis.call('incr', KEYS[1])
       if hits == 1 then redis.call('pexpire', KEYS[1], ARGV[1]) end
       local ttlLeft = redis.call('pttl', KEYS[1])
       local blocked = 0
       local blockTtl = 0
       if hits > tonumber(ARGV[2]) and tonumber(ARGV[3]) > 0 then
         redis.call('set', KEYS[2], '1', 'PX', ARGV[3])
         blocked = 1
         blockTtl = tonumber(ARGV[3])
       end
       return {hits, ttlLeft, blocked, blockTtl}`,
      2,
      key,
      blockKey,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];
    return {
      totalHits: Number(result[0]),
      timeToExpire: Math.max(0, Number(result[1])),
      isBlocked: Number(result[2]) === 1,
      timeToBlockExpire: Math.max(0, Number(result[3])),
    };
  }

  async reserveQuota(input: QuotaReservationInput): Promise<QuotaReservation> {
    if (!this.client) return this.reserveMemoryQuota(input);
    const result = (await this.client.eval(
      `local cooldownTtl = redis.call('ttl', KEYS[4])
       if cooldownTtl > 0 then return {0, 4, 0, cooldownTtl} end
       local daily = tonumber(redis.call('get', KEYS[1]) or '0')
       local monthly = tonumber(redis.call('get', KEYS[2]) or '0')
       local globalDaily = tonumber(redis.call('get', KEYS[3]) or '0')
       if tonumber(ARGV[1]) > 0 and daily >= tonumber(ARGV[1]) then return {0, 1, 0, redis.call('ttl', KEYS[1])} end
       if tonumber(ARGV[2]) > 0 and monthly >= tonumber(ARGV[2]) then return {0, 2, 0, redis.call('ttl', KEYS[2])} end
       if tonumber(ARGV[3]) > 0 and globalDaily >= tonumber(ARGV[3]) then return {0, 3, 0, redis.call('ttl', KEYS[3])} end
       daily = redis.call('incr', KEYS[1])
       if daily == 1 then redis.call('expire', KEYS[1], ARGV[4]) end
       monthly = redis.call('incr', KEYS[2])
       if monthly == 1 then redis.call('expire', KEYS[2], ARGV[5]) end
       globalDaily = redis.call('incr', KEYS[3])
       if globalDaily == 1 then redis.call('expire', KEYS[3], ARGV[4]) end
       if tonumber(ARGV[6]) > 0 then redis.call('set', KEYS[4], '1', 'EX', ARGV[6]) end
       local remaining = -1
       if tonumber(ARGV[1]) > 0 then remaining = tonumber(ARGV[1]) - daily end
       return {1, 0, remaining, 0}`,
      4,
      input.userDailyKey,
      input.userMonthlyKey,
      input.globalDailyKey,
      input.cooldownKey,
      input.userDailyLimit,
      input.userMonthlyLimit,
      input.globalDailyLimit,
      input.dayTtlSeconds,
      input.monthTtlSeconds,
      input.cooldownSeconds,
    )) as [number, number, number, number];
    return this.quotaResult(result);
  }
  async withLock<T>(
    key: string,
    ttlMs: number,
    work: () => Promise<T>,
  ): Promise<T | null> {
    if (!this.client) {
      if (this.memoryLocks.has(key)) return null;
      this.memoryLocks.add(key);
      try {
        return await work();
      } finally {
        this.memoryLocks.delete(key);
      }
    }
    const token = randomUUID();
    const acquired = await this.client.set(key, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') return null;
    try {
      return await work();
    } finally {
      await this.client.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        1,
        key,
        token,
      );
    }
  }

  private redisOptions(host: string): RedisOptions {
    return {
      host,
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      db: this.config.get<number>('REDIS_DB', 0),
      tls: this.config.get<boolean>('REDIS_TLS', false) ? {} : undefined,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: this.config.get<number>('REDIS_CONNECT_TIMEOUT_MS', 5000),
      maxRetriesPerRequest: 2,
      retryStrategy: (attempt) => Math.min(attempt * 100, 2000),
    };
  }

  private incrementMemoryThrottle(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottleRecord {
    const now = Date.now();
    const current = this.memoryThrottle.get(key);
    const state =
      !current || current.expiresAt <= now
        ? { hits: 0, expiresAt: now + ttl, blockedUntil: 0 }
        : current;
    if (state.blockedUntil > now) {
      return {
        totalHits: state.hits,
        timeToExpire: Math.max(0, state.expiresAt - now),
        isBlocked: true,
        timeToBlockExpire: state.blockedUntil - now,
      };
    }
    state.hits += 1;
    if (state.hits > limit && blockDuration > 0) {
      state.blockedUntil = now + blockDuration;
    }
    this.memoryThrottle.set(key, state);
    return {
      totalHits: state.hits,
      timeToExpire: Math.max(0, state.expiresAt - now),
      isBlocked: state.blockedUntil > now,
      timeToBlockExpire: Math.max(0, state.blockedUntil - now),
    };
  }

  private reserveMemoryQuota(input: QuotaReservationInput): QuotaReservation {
    const now = Date.now();
    const cooldown = this.memoryQuota.get(input.cooldownKey);
    if (cooldown && cooldown.expiresAt > now) {
      return {
        allowed: false,
        reason: 'FEATURE_COOLDOWN',
        remainingToday: null,
        retryAfterSeconds: Math.ceil((cooldown.expiresAt - now) / 1000),
      };
    }
    const counters = [
      [input.userDailyKey, input.userDailyLimit, input.dayTtlSeconds],
      [input.userMonthlyKey, input.userMonthlyLimit, input.monthTtlSeconds],
      [input.globalDailyKey, input.globalDailyLimit, input.dayTtlSeconds],
    ] as const;
    const reasons = [
      'USER_DAILY_LIMIT',
      'USER_MONTHLY_LIMIT',
      'GLOBAL_DAILY_LIMIT',
    ] as const;
    for (const [index, [key, limit]] of counters.entries()) {
      const current = this.memoryQuotaValue(key, now);
      if (limit > 0 && current >= limit) {
        const record = this.memoryQuota.get(key);
        return {
          allowed: false,
          reason: reasons[index],
          remainingToday: null,
          retryAfterSeconds: record
            ? Math.max(1, Math.ceil((record.expiresAt - now) / 1000))
            : 1,
        };
      }
    }
    for (const [key, , ttl] of counters) {
      const count = this.memoryQuotaValue(key, now) + 1;
      const current = this.memoryQuota.get(key);
      this.memoryQuota.set(key, {
        count,
        expiresAt: current?.expiresAt ?? now + ttl * 1000,
      });
    }
    if (input.cooldownSeconds > 0) {
      this.memoryQuota.set(input.cooldownKey, {
        count: 1,
        expiresAt: now + input.cooldownSeconds * 1000,
      });
    }
    return {
      allowed: true,
      reason: 'QUOTA_ALLOWED',
      remainingToday:
        input.userDailyLimit > 0
          ? input.userDailyLimit -
            this.memoryQuotaValue(input.userDailyKey, now)
          : null,
      retryAfterSeconds: 0,
    };
  }

  private memoryQuotaValue(key: string, now: number): number {
    const value = this.memoryQuota.get(key);
    if (!value || value.expiresAt <= now) {
      this.memoryQuota.delete(key);
      return 0;
    }
    return value.count;
  }

  private quotaResult(
    result: [number, number, number, number],
  ): QuotaReservation {
    const reasons = [
      'QUOTA_ALLOWED',
      'USER_DAILY_LIMIT',
      'USER_MONTHLY_LIMIT',
      'GLOBAL_DAILY_LIMIT',
      'FEATURE_COOLDOWN',
    ] as const;
    return {
      allowed: result[0] === 1,
      reason: reasons[result[1]] ?? 'GLOBAL_DAILY_LIMIT',
      remainingToday: result[2] < 0 ? null : result[2],
      retryAfterSeconds: Math.max(0, result[3]),
    };
  }
  private memoryGet(key: string) {
    const item = this.memory.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return item.value;
  }
}
