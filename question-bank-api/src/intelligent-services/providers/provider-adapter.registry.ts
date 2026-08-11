import { Injectable } from '@nestjs/common';
import { ServiceProviderType } from '../../generated/prisma/enums';
import { CustomHttpAdapter } from './custom-http.adapter';
import { GoogleCompatibleAdapter } from './google-compatible.adapter';
import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';
import {
  ProviderAdapterError,
  ServiceProviderAdapter,
} from './provider-adapter';

@Injectable()
export class ProviderAdapterRegistry {
  private readonly adapters: Map<ServiceProviderType, ServiceProviderAdapter>;

  constructor(
    openAi: OpenAiCompatibleAdapter,
    google: GoogleCompatibleAdapter,
    custom: CustomHttpAdapter,
  ) {
    this.adapters = new Map(
      [openAi, google, custom].map((adapter) => [adapter.type, adapter]),
    );
  }

  get(type: ServiceProviderType): ServiceProviderAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new ProviderAdapterError('USER_ERROR', false);
    }
    return adapter;
  }
}
