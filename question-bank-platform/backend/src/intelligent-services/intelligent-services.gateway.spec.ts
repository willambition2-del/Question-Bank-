import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RoutingStrategy,
  ServiceHealthStatus,
  ServiceProviderAuthType,
  ServiceProviderType,
  ServiceTaskType,
} from '../generated/prisma/enums';
import { CredentialEncryptionService } from './credentials/credential-encryption.service';
import {
  IntelligentServicesGateway,
  GatewayRequest,
} from './intelligent-services.gateway';
import { ProviderAdapterRegistry } from './providers/provider-adapter.registry';
import {
  ProviderAdapterError,
  ServiceProviderAdapter,
} from './providers/provider-adapter';
import { ModelRoutingEngine } from './routing/model-routing.engine';
import { ProviderCircuitBreakerService } from './routing/provider-circuit-breaker.service';
import { UsageGovernanceService } from './usage/usage-governance.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('IntelligentServicesGateway', () => {
  const generateText = jest.fn();
  const analyzeImage = jest.fn();
  const adapter = {
    generateText,
    analyzeImage,
    normalizeError: (error: unknown) =>
      error instanceof ProviderAdapterError
        ? error
        : new ProviderAdapterError('UNKNOWN', true),
    estimateCost: () => 0.01,
  } as unknown as ServiceProviderAdapter;
  const routing = { select: jest.fn() };
  const registry = { get: jest.fn(() => adapter) };
  const encryption = { decrypt: jest.fn(() => 'plaintext-in-memory-only') };
  const circuits = { failure: jest.fn(), success: jest.fn() };
  const usage = {
    authorizeAndStart: jest.fn().mockResolvedValue({
      policy: { maxOutputTokens: 100 },
      remainingToday: 9,
    }),
    succeeded: jest.fn(),
    failed: jest.fn(),
  };
  const gateway = new IntelligentServicesGateway(
    new ConfigService({ INTELLIGENT_SERVICES_ENABLED: true }),
    routing as unknown as ModelRoutingEngine,
    registry as unknown as ProviderAdapterRegistry,
    encryption as unknown as CredentialEncryptionService,
    circuits as unknown as ProviderCircuitBreakerService,
    usage as unknown as UsageGovernanceService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    routing.select.mockResolvedValue(selection());
  });

  it('falls back once for a retryable provider failure', async () => {
    generateText
      .mockRejectedValueOnce(new ProviderAdapterError('UNAVAILABLE', true, 503))
      .mockResolvedValueOnce({
        text: 'safe answer',
        inputTokens: 10,
        outputTokens: 20,
      });

    const result = await gateway.execute(request());

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(circuits.failure).toHaveBeenCalledWith('provider-1');
    expect(circuits.success).toHaveBeenCalledWith('provider-2');
    expect(result.internal.fallbackCount).toBe(1);
    expect(result.text).toBe('safe answer');
  });

  it('does not fall back for a user or policy error', async () => {
    generateText.mockRejectedValue(
      new ProviderAdapterError('USER_ERROR', false, 400),
    );

    await expect(gateway.execute(request())).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(circuits.failure).not.toHaveBeenCalled();
  });

  it('uses the vision operation when an image is present', async () => {
    analyzeImage.mockResolvedValue({
      text: '{"detectedText":"question"}',
      inputTokens: 10,
      outputTokens: 5,
    });

    const result = await gateway.execute({
      ...request(),
      taskType: ServiceTaskType.IMAGE_QUESTION_ANALYSIS,
      imageDataUrls: ['data:image/jpeg;base64,AA=='],
    });

    expect(analyzeImage).toHaveBeenCalledTimes(1);
    expect(generateText).not.toHaveBeenCalled();
    expect(result.text).toContain('detectedText');
  });

  it('fails closed when the platform feature is disabled', async () => {
    const disabled = new IntelligentServicesGateway(
      new ConfigService({ INTELLIGENT_SERVICES_ENABLED: false }),
      routing as unknown as ModelRoutingEngine,
      registry as unknown as ProviderAdapterRegistry,
      encryption as unknown as CredentialEncryptionService,
      circuits as unknown as ProviderCircuitBreakerService,
    );
    await expect(disabled.execute(request())).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(routing.select).not.toHaveBeenCalled();
  });
});

function request(): GatewayRequest {
  return {
    requestId: 'request-1',
    userId: 'user-1',
    taskType: ServiceTaskType.TEXT_CHAT,
    messages: [{ role: 'user', content: 'help' }],
    inputTokens: 10,
  };
}

function selection() {
  return {
    policy: {
      id: 'policy-1',
      taskType: ServiceTaskType.TEXT_CHAT,
      strategy: RoutingStrategy.PRIORITY,
      maxFallbacks: 1,
      timeoutMs: 30000,
      temperature: 0.2,
      maxOutputTokens: 100,
      systemPromptVersionId: null,
      knowledgeBaseId: null,
      routingVersion: 1,
    },
    candidates: [candidate('1'), candidate('2')],
    excluded: [],
  };
}

function candidate(suffix: string) {
  return {
    id: `candidate-${suffix}`,
    priority: Number(suffix),
    weight: 1,
    model: {
      id: `model-${suffix}`,
      providerId: `provider-${suffix}`,
      internalName: `internal-${suffix}`,
      remoteModelId: `remote-${suffix}`,
      enabled: true,
      supportsText: true,
      supportsVision: false,
      supportsImages: false,
      supportsEmbeddings: false,
      supportsTools: false,
      supportsJsonMode: false,
      supportsStreaming: false,
      supportsLongContext: false,
      supportsReasoning: false,
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
        id: `provider-${suffix}`,
        key: `provider-${suffix}`,
        displayNameInternal: `Provider ${suffix}`,
        providerType: ServiceProviderType.OPENAI_COMPATIBLE,
        baseUrl: 'https://example.com/v1/',
        authType: ServiceProviderAuthType.BEARER,
        encryptedApiKey: 'encrypted-key',
        encryptedSecondarySecret: null,
        secretLastFour: '1234',
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
    },
  };
}
