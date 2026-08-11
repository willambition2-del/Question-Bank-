import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderUrlSecurityService } from './provider-url-security.service';

describe('ProviderUrlSecurityService', () => {
  it('blocks localhost, credentials and non-HTTPS production URLs', async () => {
    const service = new ProviderUrlSecurityService(
      new ConfigService({ NODE_ENV: 'production' }),
    );
    await expect(
      service.assertAllowed('http://127.0.0.1:9000'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.assertAllowed('https://user:password@example.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows an explicit private test provider only outside production', async () => {
    const service = new ProviderUrlSecurityService(
      new ConfigService({
        NODE_ENV: 'test',
        ALLOW_PRIVATE_PROVIDER_URLS: true,
      }),
    );
    await expect(
      service.assertAllowed('http://127.0.0.1:9000/v1'),
    ).resolves.toBeInstanceOf(URL);
  });
});
