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

export interface NvidiaModelCatalogItem {
  id: string;
  name: string;
  publisher: string;
  isFree: boolean;
  contextWindow: number;
  supportsVision: boolean;
  description: string;
}

export const CURATED_NVIDIA_MODELS: NvidiaModelCatalogItem[] = [
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    publisher: 'Meta',
    isFree: true,
    contextWindow: 131072,
    supportsVision: false,
    description: 'أحدث وأقوى نموذج من Meta عالي الدقة وسريع باللغة العربية والعلوم.',
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    name: 'DeepSeek R1 (Reasoning)',
    publisher: 'DeepSeek',
    isFree: true,
    contextWindow: 65536,
    supportsVision: false,
    description: 'نموذج استدلال وتفكير فائق الدقة لحل المسائل الرياضية والعلمية المعقدة.',
  },
  {
    id: 'deepseek-ai/deepseek-v3',
    name: 'DeepSeek V3',
    publisher: 'DeepSeek',
    isFree: true,
    contextWindow: 65536,
    supportsVision: false,
    description: 'نموذج محادثة قوي وشامل عالي الكفاءة وسرعة الاستجابة.',
  },
  {
    id: 'meta/llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B Instruct',
    publisher: 'Meta',
    isFree: true,
    contextWindow: 131072,
    supportsVision: false,
    description: 'النموذج العملاق الأكبر والأدق للمهام التعليمية الصعبة والتفسير الشامل.',
  },
  {
    id: 'meta/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    publisher: 'Meta',
    isFree: true,
    contextWindow: 131072,
    supportsVision: false,
    description: 'نموذج مستقر ومجرب للمهام المتنوعة ودعم اللغة العربية الممتاز.',
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    publisher: 'Meta',
    isFree: true,
    contextWindow: 131072,
    supportsVision: false,
    description: 'نموذج خفيف وفائق السرعة للتلميحات والملاحظات الفورية.',
  },
  {
    id: 'mistralai/mistral-large-2-instruct',
    name: 'Mistral Large 2',
    publisher: 'Mistral AI',
    isFree: true,
    contextWindow: 131072,
    supportsVision: false,
    description: 'نموذج رائد ومتعدد اللغات مع قدرات تحليل وصياغة استثنائية.',
  },
  {
    id: 'mistralai/mistral-nemo-12b-instruct',
    name: 'Mistral Nemo 12B',
    publisher: 'Mistral AI',
    isFree: true,
    contextWindow: 131072,
    supportsVision: false,
    description: 'نموذج متطور وسريع مناسب للمحادثات التعليمية اليومية.',
  },
  {
    id: 'nvidia/nemotron-4-340b-instruct',
    name: 'Nemotron-4 340B Instruct',
    publisher: 'NVIDIA',
    isFree: true,
    contextWindow: 4096,
    supportsVision: false,
    description: 'نموذج NVIDIA الرئيسي للتعليم والتعليمات ذات الجودة العالية.',
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Llama 3.1 Nemotron 70B',
    publisher: 'NVIDIA',
    isFree: true,
    contextWindow: 131072,
    supportsVision: false,
    description: 'نموذج معدل ومحسن بواسطة NVIDIA لتحقيق أعلى دقة في الإجابة.',
  },
  {
    id: 'qwen/qwen2.5-72b-instruct',
    name: 'Qwen 2.5 72B Instruct',
    publisher: 'Alibaba / Qwen',
    isFree: true,
    contextWindow: 131072,
    supportsVision: false,
    description: 'نموذج متفوق في الرياضيات والفيزياء واللغة والعلوم الدقيقة.',
  },
  {
    id: 'google/gemma-2-27b-it',
    name: 'Gemma 2 27B IT',
    publisher: 'Google',
    isFree: true,
    contextWindow: 8192,
    supportsVision: false,
    description: 'نموذج Google المفتوح عالي الدقة وسلس الصياغة.',
  },
  {
    id: 'google/gemma-2-9b-it',
    name: 'Gemma 2 9B IT',
    publisher: 'Google',
    isFree: true,
    contextWindow: 8192,
    supportsVision: false,
    description: 'نموذج سريع ومتزن للإجابات الخفيفة والمراجعات.',
  },
];

@Injectable()
export class NvidiaCompatibleAdapter extends BaseHttpAdapter {
  readonly type: ServiceProviderType = ServiceProviderType.NVIDIA;

  constructor(urls: ProviderUrlSecurityService) {
    super(urls);
  }

  async testConnection(
    configuration: ProviderConfiguration,
    model: ProviderModelConfiguration,
  ): Promise<void> {
    await this.generateText(configuration, model, {
      requestId: 'nvidia-connection-test',
      messages: [{ role: 'user', content: 'أجب بكلمة: يعمل' }],
      temperature: 0.1,
      maxOutputTokens: 5,
    });
  }

  async listModels(configuration: ProviderConfiguration): Promise<string[]> {
    try {
      const json = await this.jsonRequest(configuration, 'models', {
        method: 'GET',
        headers: this.authorization(configuration),
      });
      if (Array.isArray(json.data) && json.data.length > 0) {
        const remoteIds = json.data
          .map((item) =>
            typeof item === 'object' && item !== null && 'id' in item
              ? String(item.id).trim()
              : '',
          )
          .filter(Boolean);
        if (remoteIds.length > 0) {
          return remoteIds;
        }
      }
    } catch {
      // Graceful fallback to curated catalog if remote listing is restricted/unavailable
    }
    return CURATED_NVIDIA_MODELS.map((m) => m.id);
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
        messages: this.formatMessages(request),
        temperature: request.temperature ?? 0.4,
        max_tokens: request.maxOutputTokens ?? 1200,
        stream: false,
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

  private formatMessages(request: ProviderGenerationRequest): unknown[] {
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
    _configuration: ProviderConfiguration,
    _model: ProviderModelConfiguration,
    _request: ProviderEmbeddingRequest,
  ): Promise<NormalizedEmbeddingResponse> {
    throw new ProviderAdapterError('USER_ERROR', false, 400);
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
