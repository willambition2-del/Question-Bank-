import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

interface CircuitState {
  failures: number;
  openedUntil: number;
  halfOpenProbe: boolean;
}

@Injectable()
export class ProviderCircuitBreakerService {
  private readonly threshold = 3;
  private readonly cooldownMs = 60_000;

  constructor(private readonly redis: RedisService) {}

  async canRequest(providerId: string): Promise<boolean> {
    const key = this.key(providerId);
    const state = await this.redis.getJson<CircuitState>(key);
    if (!state) return true;
    if (state.openedUntil > Date.now()) return false;
    if (state.failures < this.threshold) return true;
    if (state.halfOpenProbe) return false;
    await this.redis.setJson(
      key,
      { ...state, halfOpenProbe: true },
      Math.ceil(this.cooldownMs / 1000),
    );
    return true;
  }

  async success(providerId: string): Promise<void> {
    await this.redis.del(this.key(providerId));
  }

  async failure(providerId: string): Promise<void> {
    const key = this.key(providerId);
    const current = (await this.redis.getJson<CircuitState>(key)) ?? {
      failures: 0,
      openedUntil: 0,
      halfOpenProbe: false,
    };
    const failures = current.failures + 1;
    await this.redis.setJson(
      key,
      {
        failures,
        openedUntil:
          failures >= this.threshold ? Date.now() + this.cooldownMs : 0,
        halfOpenProbe: false,
      },
      Math.ceil((this.cooldownMs * 2) / 1000),
    );
  }

  async state(providerId: string): Promise<'CLOSED' | 'OPEN' | 'HALF_OPEN'> {
    const value = await this.redis.getJson<CircuitState>(this.key(providerId));
    if (!value || value.failures < this.threshold) return 'CLOSED';
    if (value.openedUntil > Date.now()) return 'OPEN';
    return 'HALF_OPEN';
  }

  private key(providerId: string): string {
    return `intelligent:circuit:${providerId}`;
  }
}
