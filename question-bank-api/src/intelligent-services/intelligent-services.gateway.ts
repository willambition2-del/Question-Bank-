import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma/client';
import { ServiceTaskType } from '../generated/prisma/enums';
import { CredentialEncryptionService } from './credentials/credential-encryption.service';
import { ProviderAdapterRegistry } from './providers/provider-adapter.registry';
import {
  NormalizedEmbeddingResponse,
  NormalizedProviderResponse,
  ProviderAdapterError,
  ServiceMessage,
} from './providers/provider-adapter';
import { ModelRoutingEngine } from './routing/model-routing.engine';
import { ProviderCircuitBreakerService } from './routing/provider-circuit-breaker.service';
import { UsageGovernanceService } from './usage/usage-governance.service';

export interface GatewayRequest {
  requestId: string;
  userId: string;
  taskType: ServiceTaskType;
  messages: ServiceMessage[];
  inputTokens: number;
  imageDataUrls?: string[];
  responseSchema?: Record<string, unknown>;
  promptVersion?: number;
  knowledgeUsed?: boolean;
  signal?: AbortSignal;
}

export interface GatewayEmbeddingRequest {
  requestId: string;
  inputs: string[];
  signal?: AbortSignal;
}

export interface GatewayEmbeddingResponse extends NormalizedEmbeddingResponse {
  internal: {
    policyId: string;
    modelId: string;
    providerId: string;
    fallbackCount: number;
    estimatedCost: number;
  };
}
export interface GatewayResponse extends NormalizedProviderResponse {
  quotaRemainingToday: number | null;
  internal: {
    policyId: string;
    modelId: string;
    providerId: string;
    fallbackCount: number;
    estimatedCost: number;
    promptVersion: number | null;
  };
}

@Injectable()
export class IntelligentServicesGateway {
  constructor(
    private readonly config: ConfigService,
    private readonly routing: ModelRoutingEngine,
    private readonly registry: ProviderAdapterRegistry,
    private readonly encryption: CredentialEncryptionService,
    private readonly circuits: ProviderCircuitBreakerService,
    private readonly usage: UsageGovernanceService,
  ) {}

  async createEmbeddings(
    request: GatewayEmbeddingRequest,
  ): Promise<GatewayEmbeddingResponse> {
    if (this.config.get<string | boolean>('INTELLIGENT_SERVICES_ENABLED') === false || this.config.get<string | boolean>('INTELLIGENT_SERVICES_ENABLED') === 'false') {
      throw this.unavailable('INTELLIGENT_SERVICES_DISABLED');
    }
    const startedAt = Date.now();
    const inputTokens = request.inputs.reduce(
      (total, value) => total + Math.ceil(value.length / 4),
      0,
    );
    await this.usage.authorizeSystemAndStart({
      requestId: request.requestId,
      taskType: ServiceTaskType.EMBEDDING_GENERATION,
      inputTokens,
    });
    try {
      const selection = await this.routing.select(
        ServiceTaskType.EMBEDDING_GENERATION,
        inputTokens,
      );
      let lastError: ProviderAdapterError | null = null;
      for (const [index, candidate] of selection.candidates.entries()) {
        const { model } = candidate;
        const provider = model.provider;
        const adapter = this.registry.get(provider.providerType);
        try {
          const response = await adapter.createEmbedding(
            {
              id: provider.id,
              providerType: provider.providerType,
              baseUrl: provider.baseUrl,
              authType: provider.authType,
              timeoutMs: Math.min(
                provider.timeoutMs,
                selection.policy.timeoutMs,
              ),
              maxRetries: provider.maxRetries,
              apiKey: provider.encryptedApiKey
                ? this.encryption.decrypt(provider.encryptedApiKey)
                : undefined,
              secondarySecret: provider.encryptedSecondarySecret
                ? this.encryption.decrypt(provider.encryptedSecondarySecret)
                : undefined,
              metadata: this.metadata(provider.metadataJson),
            },
            model,
            {
              requestId: request.requestId,
              inputs: request.inputs,
              signal: request.signal,
            },
          );
          const estimatedCost = adapter.estimateCost(model, {
            inputTokens: response.inputTokens || inputTokens,
            outputTokens: 0,
            imageCount: 0,
          });
          await this.circuits.success(provider.id);
          await this.usage.succeeded(request.requestId, {
            routingPolicyId: selection.policy.id,
            selectedModelId: model.id,
            selectedProviderId: provider.id,
            inputTokenCount: response.inputTokens || inputTokens,
            outputTokenCount: 0,
            imageCount: 0,
            latencyMs: Date.now() - startedAt,
            estimatedCost,
            fallbackCount: index,
            knowledgeUsed: false,
            promptVersion: null,
          });
          return {
            ...response,
            internal: {
              policyId: selection.policy.id,
              modelId: model.id,
              providerId: provider.id,
              fallbackCount: index,
              estimatedCost,
            },
          };
        } catch (error: unknown) {
          const normalized = adapter.normalizeError(error);
          lastError = normalized;
          if (normalized.retryable) await this.circuits.failure(provider.id);
          if (!normalized.retryable) break;
        }
      }
      throw this.unavailable(
        lastError?.kind === 'RATE_LIMIT'
          ? 'SERVICE_RATE_LIMITED'
          : 'SERVICE_TEMPORARILY_UNAVAILABLE',
      );
    } catch (error: unknown) {
      await this.usage.failed(
        request.requestId,
        this.errorCode(error),
        Date.now() - startedAt,
      );
      throw error;
    }
  }
  async execute(request: GatewayRequest): Promise<GatewayResponse> {
    if (this.config.get<string | boolean>('INTELLIGENT_SERVICES_ENABLED') === false || this.config.get<string | boolean>('INTELLIGENT_SERVICES_ENABLED') === 'false') {
      throw this.unavailable('INTELLIGENT_SERVICES_DISABLED');
    }
    const startedAt = Date.now();
    const authorization = await this.usage.authorizeAndStart({
      requestId: request.requestId,
      userId: request.userId,
      taskType: request.taskType,
      inputTokens: request.inputTokens,
      imageCount: request.imageDataUrls?.length ?? 0,
      knowledgeUsed: request.knowledgeUsed ?? false,
    });
    try {
      const selection = await this.routing.select(
        request.taskType,
        request.inputTokens,
      );
      let lastError: ProviderAdapterError | null = null;
      for (const [index, candidate] of selection.candidates.entries()) {
        const { model } = candidate;
        const provider = model.provider;
        const adapter = this.registry.get(provider.providerType);
        const apiKey = provider.encryptedApiKey
          ? this.encryption.decrypt(provider.encryptedApiKey)
          : undefined;
        const secondarySecret = provider.encryptedSecondarySecret
          ? this.encryption.decrypt(provider.encryptedSecondarySecret)
          : undefined;
        let response: NormalizedProviderResponse;
        try {
          const configuration = {
            id: provider.id,
            providerType: provider.providerType,
            baseUrl: provider.baseUrl,
            authType: provider.authType,
            timeoutMs: Math.min(provider.timeoutMs, selection.policy.timeoutMs),
            maxRetries: provider.maxRetries,
            apiKey,
            secondarySecret,
            metadata: this.metadata(provider.metadataJson),
          };
          const generationRequest = {
            requestId: request.requestId,
            messages: request.messages,
            temperature: Number(selection.policy.temperature),
            maxOutputTokens: Math.min(
              selection.policy.maxOutputTokens,
              model.maxOutputTokens,
              authorization.policy.maxOutputTokens,
            ),
            responseSchema: request.responseSchema,
            imageDataUrls: request.imageDataUrls,
            signal: request.signal,
          };
          response = request.imageDataUrls?.length
            ? await adapter.analyzeImage(
                configuration,
                model,
                generationRequest,
              )
            : await adapter.generateText(
                configuration,
                model,
                generationRequest,
              );
        } catch (error: unknown) {
          const normalized = adapter.normalizeError(error);
          lastError = normalized;
          if (normalized.retryable) await this.circuits.failure(provider.id);
          if (!normalized.retryable) break;
          continue;
        }
        await this.circuits.success(provider.id);
        const estimatedCost = adapter.estimateCost(model, {
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          imageCount: request.imageDataUrls?.length ?? 0,
        });
        await this.usage.succeeded(request.requestId, {
          routingPolicyId: selection.policy.id,
          selectedModelId: model.id,
          selectedProviderId: provider.id,
          inputTokenCount: response.inputTokens,
          outputTokenCount: response.outputTokens,
          imageCount: request.imageDataUrls?.length ?? 0,
          latencyMs: Date.now() - startedAt,
          estimatedCost,
          fallbackCount: index,
          knowledgeUsed: request.knowledgeUsed ?? false,
          promptVersion: request.promptVersion ?? null,
        });
        return {
          ...response,
          quotaRemainingToday: authorization.remainingToday,
          internal: {
            policyId: selection.policy.id,
            modelId: model.id,
            providerId: provider.id,
            fallbackCount: index,
            estimatedCost,
            promptVersion: request.promptVersion ?? null,
          },
        };
      }
      throw this.unavailable(
        lastError?.kind === 'RATE_LIMIT'
          ? 'SERVICE_RATE_LIMITED'
          : 'SERVICE_TEMPORARILY_UNAVAILABLE',
      );
    } catch (error: unknown) {
      await this.usage.failed(
        request.requestId,
        this.errorCode(error),
        Date.now() - startedAt,
      );
      throw error;
    }
  }

  private errorCode(error: unknown): string {
    if (error instanceof ProviderAdapterError) return error.kind;
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = error.response;
      if (
        typeof response === 'object' &&
        response !== null &&
        'code' in response
      ) {
        return String(response.code);
      }
    }
    return 'SERVICE_REQUEST_FAILED';
  }
  private metadata(value: Prisma.JsonValue | null): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {};
  }

  private unavailable(code: string): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code,
      message: 'The requested platform service is temporarily unavailable',
    });
  }
}
