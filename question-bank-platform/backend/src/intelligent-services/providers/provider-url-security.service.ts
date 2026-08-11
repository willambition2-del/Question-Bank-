import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

@Injectable()
export class ProviderUrlSecurityService {
  constructor(private readonly config: ConfigService) {}

  async assertAllowed(raw: string): Promise<URL> {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw this.invalid();
    }
    if (!['https:', 'http:'].includes(url.protocol)) throw this.invalid();
    if (url.username || url.password) throw this.invalid();
    if (url.protocol !== 'https:' && this.isProduction()) throw this.invalid();

    const addresses = isIP(url.hostname)
      ? [{ address: url.hostname }]
      : await lookup(url.hostname, { all: true, verbatim: true }).catch(() => {
          throw this.invalid();
        });
    if (
      addresses.some(({ address }) => this.isPrivate(address)) &&
      !this.privateNetworksAllowed()
    ) {
      throw this.invalid();
    }
    return url;
  }

  private privateNetworksAllowed(): boolean {
    return (
      !this.isProduction() &&
      this.config.get<boolean>('ALLOW_PRIVATE_PROVIDER_URLS', false)
    );
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private isPrivate(address: string): boolean {
    const value = address.toLowerCase();
    if (
      value === '::1' ||
      value === '0.0.0.0' ||
      value.startsWith('fe80:') ||
      value.startsWith('fc') ||
      value.startsWith('fd')
    ) {
      return true;
    }
    const parts = value.split('.').map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    );
  }

  private invalid(): BadRequestException {
    return new BadRequestException({
      code: 'PROVIDER_BASE_URL_NOT_ALLOWED',
      message: 'Provider URL is not allowed',
    });
  }
}
