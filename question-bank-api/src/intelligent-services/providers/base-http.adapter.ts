import type { ServiceProviderType } from '../../generated/prisma/enums';
import {
  NormalizedProviderResponse,
  ProviderAdapterError,
  ProviderConfiguration,
  ProviderGenerationRequest,
  ProviderModelConfiguration,
  ServiceProviderAdapter,
} from './provider-adapter';
import { ProviderUrlSecurityService } from './provider-url-security.service';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export abstract class BaseHttpAdapter implements Omit<
  ServiceProviderAdapter,
  'createEmbedding'
> {
  abstract readonly type: ServiceProviderType;

  constructor(protected readonly urls: ProviderUrlSecurityService) {}

  validateConfiguration(configuration: ProviderConfiguration): void {
    const url = new URL(configuration.baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new ProviderAdapterError('USER_ERROR', false);
    }
  }

  abstract testConnection(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
  ): Promise<void>;

  abstract listModels(configuration: ProviderConfiguration): Promise<string[]>;

  abstract generateText(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
    request: ProviderGenerationRequest,
  ): Promise<NormalizedProviderResponse>;

  analyzeImage(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
    request: ProviderGenerationRequest,
  ): Promise<NormalizedProviderResponse> {
    return this.generateText(configuration, model, request);
  }

  normalizeError(error: unknown): ProviderAdapterError {
    if (error instanceof ProviderAdapterError) return error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new ProviderAdapterError('TIMEOUT', true);
    }
    return new ProviderAdapterError('UNKNOWN', true);
  }

  estimateCost(
    model: {
      inputCostPerMillion: unknown;
      outputCostPerMillion: unknown;
      imageCost: unknown;
    },
    usage: { inputTokens: number; outputTokens: number; imageCount: number },
  ): number {
    return (
      (usage.inputTokens * Number(model.inputCostPerMillion)) / 1_000_000 +
      (usage.outputTokens * Number(model.outputCostPerMillion)) / 1_000_000 +
      usage.imageCount * Number(model.imageCost)
    );
  }

  protected async jsonRequest(
    configuration: ProviderConfiguration,
    path: string,
    init: RequestInit,
  ): Promise<Record<string, unknown>> {
    const base = await this.urls.assertAllowed(configuration.baseUrl);
    const url = new URL(path, `${base.toString().replace(/\/$/, '')}/`);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      configuration.timeoutMs,
    );
    try {
      const response = await fetch(url, {
        ...init,
        signal: init.signal ?? controller.signal,
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...init.headers,
        },
      });
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > MAX_RESPONSE_BYTES) {
        throw new ProviderAdapterError('INVALID_RESPONSE', true);
      }
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
        throw new ProviderAdapterError('INVALID_RESPONSE', true);
      }
      if (!response.ok) throw this.httpError(response.status);
      const value: unknown = JSON.parse(text);
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ProviderAdapterError('INVALID_RESPONSE', true);
      }
      return value as Record<string, unknown>;
    } catch (error: unknown) {
      throw this.normalizeError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  protected authorization(
    configuration: ProviderConfiguration,
  ): Record<string, string> {
    if (!configuration.apiKey) return {};
    return { authorization: `Bearer ${configuration.apiKey}` };
  }

  private httpError(status: number): ProviderAdapterError {
    if (status === 400 || status === 413 || status === 422) {
      return new ProviderAdapterError('USER_ERROR', false, status);
    }
    if (status === 401 || status === 403) {
      return new ProviderAdapterError('AUTHENTICATION', false, status);
    }
    if (status === 429) {
      return new ProviderAdapterError('RATE_LIMIT', true, status);
    }
    if (status >= 500) {
      return new ProviderAdapterError('UNAVAILABLE', true, status);
    }
    return new ProviderAdapterError('UNKNOWN', false, status);
  }
}
