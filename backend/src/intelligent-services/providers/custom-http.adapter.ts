import { Injectable } from '@nestjs/common';
import { ServiceProviderType } from '../../generated/prisma/enums';
import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';
import { ProviderUrlSecurityService } from './provider-url-security.service';

@Injectable()
export class CustomHttpAdapter extends OpenAiCompatibleAdapter {
  readonly type = ServiceProviderType.CUSTOM_HTTP;

  constructor(urls: ProviderUrlSecurityService) {
    super(urls);
  }
}
