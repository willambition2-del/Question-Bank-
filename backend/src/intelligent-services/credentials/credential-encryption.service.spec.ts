import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { CredentialEncryptionService } from './credential-encryption.service';

describe('CredentialEncryptionService', () => {
  const key = randomBytes(32).toString('base64');
  const service = new CredentialEncryptionService(
    new ConfigService({ PROVIDER_CREDENTIALS_MASTER_KEY: key }),
  );

  it('uses authenticated randomized encryption and decrypts the credential', () => {
    const first = service.encrypt('secret-value');
    const second = service.encrypt('secret-value');
    expect(first).not.toBe(second);
    expect(first.startsWith('v1.primary.')).toBe(true);
    expect(first).not.toContain('secret-value');
    expect(service.decrypt(first)).toBe('secret-value');
    expect(service.matches(first, 'secret-value')).toBe(true);
  });

  it('rejects a modified authentication tag without exposing plaintext', () => {
    const encrypted = service.encrypt('secret-value');
    const parts = encrypted.split('.');
    parts[4] = `${parts[4]?.startsWith('A') ? 'B' : 'A'}`;
    expect(() => service.decrypt(parts.join('.'))).toThrow(
      'Credential integrity validation failed',
    );
  });

  it('fails closed when the master key is absent', () => {
    const unavailable = new CredentialEncryptionService(new ConfigService({}));
    expect(() => unavailable.encrypt('secret')).toThrow(
      ServiceUnavailableException,
    );
  });
});
