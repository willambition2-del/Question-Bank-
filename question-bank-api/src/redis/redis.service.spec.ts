import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  it('provides cache and lock semantics without requiring Redis in development', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const redis = new RedisService(config as unknown as ConfigService);
    await redis.setJson('key', { value: 1 }, 60);
    expect(await redis.getJson<{ value: number }>('key')).toEqual({ value: 1 });
    const result = await redis.withLock('lock', 1000, () =>
      Promise.resolve('done'),
    );
    expect(result).toBe('done');
    await redis.del('key');
    expect(await redis.getJson('key')).toBeNull();
  });

  it('serializes the same development lock key', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const redis = new RedisService(config as unknown as ConfigService);
    let release: (() => void) | undefined;
    const pending = redis.withLock(
      'lock',
      1000,
      () => new Promise<string>((resolve) => (release = () => resolve('one'))),
    );
    await Promise.resolve();
    await expect(
      redis.withLock('lock', 1000, () => Promise.resolve('two')),
    ).resolves.toBeNull();
    release?.();
    await expect(pending).resolves.toBe('one');
  });
  it('provides shared-storage rate-limit semantics in memory for tests', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const redis = new RedisService(config as unknown as ConfigService);
    const first = await redis.incrementThrottle('rate', 60_000, 1, 30_000);
    const second = await redis.incrementThrottle('rate', 60_000, 1, 30_000);
    expect(first).toMatchObject({ totalHits: 1, isBlocked: false });
    expect(second).toMatchObject({ totalHits: 2, isBlocked: true });
  });
  it('reserves daily quota atomically in development memory storage', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const redis = new RedisService(config as unknown as ConfigService);
    const input = {
      userDailyKey: 'quota:user:day',
      userMonthlyKey: 'quota:user:month',
      globalDailyKey: 'quota:global:day',
      cooldownKey: 'quota:cooldown',
      userDailyLimit: 1,
      userMonthlyLimit: 10,
      globalDailyLimit: 100,
      dayTtlSeconds: 60,
      monthTtlSeconds: 120,
      cooldownSeconds: 0,
    };

    await expect(redis.reserveQuota(input)).resolves.toMatchObject({
      allowed: true,
      remainingToday: 0,
    });
    await expect(redis.reserveQuota(input)).resolves.toMatchObject({
      allowed: false,
      reason: 'USER_DAILY_LIMIT',
    });
  });

  it('enforces cooldown without incrementing another quota reservation', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const redis = new RedisService(config as unknown as ConfigService);
    const input = {
      userDailyKey: 'cooldown:user:day',
      userMonthlyKey: 'cooldown:user:month',
      globalDailyKey: 'cooldown:global:day',
      cooldownKey: 'cooldown:key',
      userDailyLimit: 10,
      userMonthlyLimit: 10,
      globalDailyLimit: 10,
      dayTtlSeconds: 60,
      monthTtlSeconds: 120,
      cooldownSeconds: 30,
    };

    await expect(redis.reserveQuota(input)).resolves.toMatchObject({
      allowed: true,
      remainingToday: 9,
    });
    await expect(redis.reserveQuota(input)).resolves.toMatchObject({
      allowed: false,
      reason: 'FEATURE_COOLDOWN',
    });
  });
});
