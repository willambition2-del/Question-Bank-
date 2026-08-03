/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
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
export class GoogleCompatibleAdapter extends BaseHttpAdapter {
  readonly type: ServiceProviderType = ServiceProviderType.GOOGLE_COMPATIBLE;

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
    const json = await this.jsonRequest(
      configuration,
      `models?key=${encodeURIComponent(configuration.apiKey ?? '')}`,
      { method: 'GET' },
    );
    return Array.isArray(json.models)
      ? json.models
          .map((item) =>
            typeof item === 'object' && item !== null && 'name' in item
              ? String(item.name).replace(/^models\//, '')
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
    const prompt = request.messages.map((item) => item.content).join('\n\n');
    const json = await this.jsonRequest(
      configuration,
      `models/${encodeURIComponent(model.remoteModelId)}:generateContent?key=${encodeURIComponent(configuration.apiKey ?? '')}`,
      {
        method: 'POST',
        signal: request.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                ...(request.imageDataUrls ?? []).map((url) => {
                  const [header, data] = url.split(',', 2);
                  return {
                    inlineData: {
                      mimeType:
                        header?.match(/^data:([^;]+);base64$/)?.[1] ??
                        'image/jpeg',
                      data: data ?? '',
                    },
                  };
                }),
              ],
            },
          ],
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxOutputTokens,
            ...(request.responseSchema && model.supportsJsonMode
              ? { responseMimeType: 'application/json' }
              : {}),
          },
        }),
      },
    );
    const candidates = Array.isArray(json.candidates) ? json.candidates : [];
    const first = candidates[0];
    const content =
      typeof first === 'object' && first !== null && 'content' in first
        ? first.content
        : null;
    const parts =
      typeof content === 'object' && content !== null && 'parts' in content
        ? content.parts
        : null;
    const part = Array.isArray(parts) ? parts[0] : null;
    const text =
      typeof part === 'object' && part !== null && 'text' in part
        ? part.text
        : null;
    if (typeof text !== 'string') {
      throw new ProviderAdapterError('INVALID_RESPONSE', true);
    }
    const usage =
      typeof json.usageMetadata === 'object' && json.usageMetadata !== null
        ? (json.usageMetadata as Record<string, unknown>)
        : {};
    return {
      text,
      inputTokens: Number(usage.promptTokenCount ?? 0),
      outputTokens: Number(usage.candidatesTokenCount ?? 0),
    };
  }

  async createEmbedding(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
    request: ProviderEmbeddingRequest,
  ): Promise<NormalizedEmbeddingResponse> {
    const vectors: number[][] = [];
    for (const input of request.inputs) {
      const json = await this.jsonRequest(
        configuration,
        `models/${encodeURIComponent(model.remoteModelId)}:embedContent?key=${encodeURIComponent(configuration.apiKey ?? '')}`,
        {
          method: 'POST',
          signal: request.signal,
          body: JSON.stringify({
            content: { parts: [{ text: input }] },
          }),
        },
      );
      const embedding =
        typeof json.embedding === 'object' && json.embedding !== null
          ? (json.embedding as Record<string, unknown>).values
          : null;
      if (
        !Array.isArray(embedding) ||
        !embedding.every((value) => typeof value === 'number')
      ) {
        throw new ProviderAdapterError('INVALID_RESPONSE', true);
      }
      vectors.push(embedding);
    }
    return { vectors, inputTokens: 0 };
  }
}
