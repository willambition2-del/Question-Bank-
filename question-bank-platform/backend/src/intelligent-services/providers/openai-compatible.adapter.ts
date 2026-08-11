/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { ServiceProviderType } from '../../generated/prisma/enums';
import { BaseHttpAdapter } from './base-http.adapter';
import {
  NormalizedEmbeddingResponse,
  NormalizedProviderResponse,
  ProviderAdapterError,
  ProviderConfiguration,
  ProviderEmbeddingRequest,
  ProviderGenerationRequest,
  ProviderModelConfiguration,
} from './provider-adapter';
import { ProviderUrlSecurityService } from './provider-url-security.service';

@Injectable()
export class OpenAiCompatibleAdapter extends BaseHttpAdapter {
  readonly type: ServiceProviderType = ServiceProviderType.OPENAI_COMPATIBLE;

  constructor(urls: ProviderUrlSecurityService) {
    super(urls);
  }

  async testConnection(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
  ): Promise<void> {
    await this.generateText(configuration, model, {
      requestId: 'connection-test',
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
      maxOutputTokens: 1,
    });
  }

  async listModels(configuration: ProviderConfiguration): Promise<string[]> {
    const json = await this.jsonRequest(configuration, 'models', {
      method: 'GET',
      headers: this.authorization(configuration),
    });
    return Array.isArray(json.data)
      ? json.data
          .map((item) =>
            typeof item === 'object' && item !== null && 'id' in item
              ? String(item.id)
              : '',
          )
          .filter(Boolean)
      : [];
  }

  async generateText(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
    request: ProviderGenerationRequest,
  ): Promise<NormalizedProviderResponse> {
    const json = await this.jsonRequest(configuration, 'chat/completions', {
      method: 'POST',
      headers: this.authorization(configuration),
      signal: request.signal,
      body: JSON.stringify({
        model: model.remoteModelId,
        messages: this.messages(request),
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
        ...(request.responseSchema && model.supportsJsonMode
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
    });
    const choices = json.choices;
    const first = Array.isArray(choices) ? choices[0] : null;
    const message =
      typeof first === 'object' && first !== null && 'message' in first
        ? first.message
        : null;
    const content =
      typeof message === 'object' && message !== null && 'content' in message
        ? message.content
        : null;
    if (typeof content !== 'string') {
      throw new ProviderAdapterError('INVALID_RESPONSE', true);
    }
    const usage =
      typeof json.usage === 'object' && json.usage !== null ? json.usage : {};
    return {
      text: content,
      structured: this.structured(content, request.responseSchema),
      inputTokens: this.numberField(usage, 'prompt_tokens'),
      outputTokens: this.numberField(usage, 'completion_tokens'),
      finishReason:
        typeof first === 'object' && first !== null && 'finish_reason' in first
          ? String(first.finish_reason)
          : undefined,
    };
  }

  private messages(request: ProviderGenerationRequest): unknown[] {
    if (!request.imageDataUrls?.length) return request.messages;
    return request.messages.map((message, index) =>
      index === request.messages.length - 1 && message.role === 'user'
        ? {
            ...message,
            content: [
              { type: 'text', text: message.content },
              ...request.imageDataUrls!.map((url) => ({
                type: 'image_url',
                image_url: { url, detail: 'high' },
              })),
            ],
          }
        : message,
    );
  }

  async createEmbedding(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
    request: ProviderEmbeddingRequest,
  ): Promise<NormalizedEmbeddingResponse> {
    const json = await this.jsonRequest(configuration, 'embeddings', {
      method: 'POST',
      headers: this.authorization(configuration),
      signal: request.signal,
      body: JSON.stringify({
        model: model.remoteModelId,
        input: request.inputs,
      }),
    });
    const data = Array.isArray(json.data) ? json.data : [];
    const vectors = data.map((item) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        !('embedding' in item) ||
        !Array.isArray(item.embedding) ||
        !item.embedding.every((value) => typeof value === 'number')
      ) {
        throw new ProviderAdapterError('INVALID_RESPONSE', true);
      }
      return item.embedding as number[];
    });
    const usage =
      typeof json.usage === 'object' && json.usage !== null ? json.usage : {};
    return {
      vectors,
      inputTokens: this.numberField(usage, 'prompt_tokens'),
    };
  }

  private numberField(value: object, key: string): number {
    if (!(key in value)) return 0;
    const result = Number((value as Record<string, unknown>)[key]);
    return Number.isFinite(result) ? result : 0;
  }

  private structured(
    content: string,
    schema?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!schema) return undefined;
    try {
      const value: unknown = JSON.parse(content);
      return typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }
}
