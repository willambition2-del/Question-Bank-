import type {
  ServiceModel,
  ServiceProvider,
} from '../../generated/prisma/client';

export type ProviderConfiguration = Pick<
  ServiceProvider,
  'id' | 'providerType' | 'baseUrl' | 'authType' | 'timeoutMs' | 'maxRetries'
> & {
  apiKey?: string;
  secondarySecret?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderModelConfiguration = Pick<
  ServiceModel,
  | 'id'
  | 'remoteModelId'
  | 'supportsJsonMode'
  | 'supportsStreaming'
  | 'maxOutputTokens'
>;

export interface ServiceMessage {
  role: 'system' | 'developer' | 'user';
  content: string;
}

export interface ProviderGenerationRequest {
  requestId: string;
  messages: ServiceMessage[];
  temperature: number;
  maxOutputTokens: number;
  responseSchema?: Record<string, unknown>;
  imageDataUrls?: string[];
  signal?: AbortSignal;
}

export interface ProviderEmbeddingRequest {
  requestId: string;
  inputs: string[];
  signal?: AbortSignal;
}

export interface NormalizedProviderResponse {
  text: string;
  structured?: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
  finishReason?: string;
}

export interface NormalizedEmbeddingResponse {
  vectors: number[][];
  inputTokens: number;
}

export type ProviderErrorKind =
  | 'USER_ERROR'
  | 'AUTHENTICATION'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'CONTEXT_EXCEEDED'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

export class ProviderAdapterError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super(`Provider request failed: ${kind}`);
    this.name = 'ProviderAdapterError';
  }
}

export interface ServiceProviderAdapter {
  readonly type: ServiceProvider['providerType'];
  validateConfiguration(configuration: ProviderConfiguration): void;
  testConnection(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
  ): Promise<void>;
  listModels(configuration: ProviderConfiguration): Promise<string[]>;
  generateText(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
    request: ProviderGenerationRequest,
  ): Promise<NormalizedProviderResponse>;
  analyzeImage(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
    request: ProviderGenerationRequest,
  ): Promise<NormalizedProviderResponse>;
  createEmbedding(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
    request: ProviderEmbeddingRequest,
  ): Promise<NormalizedEmbeddingResponse>;
  normalizeError(error: unknown): ProviderAdapterError;
  estimateCost(
    model: Pick<
      ServiceModel,
      'inputCostPerMillion' | 'outputCostPerMillion' | 'imageCost'
    >,
    usage: { inputTokens: number; outputTokens: number; imageCount: number },
  ): number;
}
