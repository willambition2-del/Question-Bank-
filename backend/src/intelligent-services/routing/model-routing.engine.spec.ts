import { ServiceUnavailableException } from '@nestjs/common';
import {
  RoutingStrategy,
  ServiceHealthStatus,
  ServiceProviderAuthType,
  ServiceProviderType,
  ServiceTaskType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelRoutingEngine } from './model-routing.engine';
import { ProviderCircuitBreakerService } from './provider-circuit-breaker.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ModelRoutingEngine', () => {
  const findFirst = jest.fn();
  const count = jest.fn();
  const aggregate = jest.fn();
  const circuits = { canRequest: jest.fn().mockResolvedValue(true) };
  const engine = new ModelRoutingEngine(
    {
      routingPolicy: { findFirst },
      serviceRequestLog: { count, aggregate },
    } as unknown as PrismaService,
    circuits as unknown as ProviderCircuitBreakerService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('routes vision work only to an enabled vision-capable model', async () => {
    findFirst.mockResolvedValue(
      policy(RoutingStrategy.PRIORITY, [
        candidate('text', 1, { supportsVision: false }),
        candidate('vision', 2, { supportsVision: true }),
      ]),
    );
    const result = await engine.select(
      ServiceTaskType.IMAGE_QUESTION_ANALYSIS,
      500,
    );
    expect(result.candidates.map((item) => item.model.id)).toEqual(['vision']);
    expect(result.excluded).toContainEqual({
      modelId: 'text',
      reason: 'VISION_UNSUPPORTED',
    });
  });

  it('supports priority and lowest-cost routing without model-name heuristics', async () => {
    findFirst.mockResolvedValue(
      policy(RoutingStrategy.LOWEST_COST, [
        candidate('expensive', 1, { inputCostPerMillion: 20 }),
        candidate('cheap', 100, { inputCostPerMillion: 0.1 }),
      ]),
    );
    const result = await engine.select(ServiceTaskType.TEXT_CHAT, 1000);
    expect(result.candidates[0]?.model.id).toBe('cheap');
  });

  it('rejects a task when no configured model has the required capability', async () => {
    findFirst.mockResolvedValue(
      policy(RoutingStrategy.PRIORITY, [
        candidate('text', 1, { supportsEmbeddings: false }),
      ]),
    );
    await expect(
      engine.select(ServiceTaskType.EMBEDDING_GENERATION, 100),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('excludes models that exceed the per-request estimated cost', async () => {
    const configured = policy(RoutingStrategy.PRIORITY, [
      candidate('costly', 1, { inputCostPerMillion: 10 }),
    ]);
    configured.maxEstimatedCost = 0.000001;
    findFirst.mockResolvedValue(configured);

    await expect(
      engine.select(ServiceTaskType.TEXT_CHAT, 1000),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('excludes a candidate after its daily cost budget is reached', async () => {
    aggregate.mockResolvedValue({ _sum: { estimatedCost: 2 } });
    findFirst.mockResolvedValue(
      policy(RoutingStrategy.PRIORITY, [
        candidate('budgeted', 1, {}, { maxCostPerDay: 2 }),
      ]),
    );

    await expect(engine.select(ServiceTaskType.TEXT_CHAT, 100)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(aggregate).toHaveBeenCalledTimes(1);
  });
});

function policy(strategy: RoutingStrategy, candidates: unknown[]) {
  return {
    id: 'policy-1',
    taskType: ServiceTaskType.TEXT_CHAT,
    nameInternal: 'default',
    enabled: true,
    strategy,
    primaryModelId: null,
    maxFallbacks: 2,
    requiredVision: false,
    requiredJsonMode: false,
    minContextWindow: 0,
    maxEstimatedCost: null,
    timeoutMs: 30000,
    temperature: 0.2,
    maxOutputTokens: 100,
    systemPromptVersionId: null,
    knowledgeBaseId: null,
    routingVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    candidates,
  };
}

function candidate(
  id: string,
  priority: number,
  overrides: Record<string, unknown>,
  candidateOverrides: Record<string, unknown> = {},
) {
  return {
    id: `candidate-${id}`,
    modelId: id,
    routingPolicyId: 'policy-1',
    priority,
    weight: 1,
    enabled: true,
    maxRequestsPerMinute: null,
    maxRequestsPerDay: null,
    maxCostPerDay: null,
    conditionsJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...candidateOverrides,
    model: {
      id,
      providerId: 'provider-1',
      internalName: id,
      remoteModelId: id,
      enabled: true,
      supportsText: true,
      supportsVision: false,
      supportsImages: false,
      supportsEmbeddings: false,
      supportsTools: false,
      supportsJsonMode: true,
      supportsStreaming: false,
      supportsLongContext: false,
      supportsReasoning: true,
      contextWindow: 8192,
      maxOutputTokens: 1024,
      inputCostPerMillion: 1,
      outputCostPerMillion: 1,
      imageCost: 0,
      currency: 'USD',
      latencyClass: 3,
      qualityClass: 3,
      metadataJson: null,
      healthStatus: ServiceHealthStatus.HEALTHY,
      averageLatencyMs: 100,
      successRate: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: {
        id: 'provider-1',
        key: 'provider',
        displayNameInternal: 'Provider',
        providerType: ServiceProviderType.OPENAI_COMPATIBLE,
        baseUrl: 'https://example.com/v1',
        authType: ServiceProviderAuthType.BEARER,
        encryptedApiKey: null,
        encryptedSecondarySecret: null,
        secretLastFour: null,
        enabled: true,
        priority: 1,
        timeoutMs: 30000,
        maxRetries: 1,
        supportsStreaming: false,
        metadataJson: null,
        healthStatus: ServiceHealthStatus.HEALTHY,
        healthScore: 100,
        lastHealthCheckAt: null,
        createdById: 'admin',
        updatedById: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ...overrides,
    },
  };
}
