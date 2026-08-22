import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const FORMAT_VERSION = 'v1';
const KEY_ID = 'primary';
const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class CredentialEncryptionService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plaintext: string): string {
    const secret = plaintext.trim();
    if (!secret) throw new Error('Credential cannot be empty');
    const key = this.key();
    const nonce = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      FORMAT_VERSION,
      KEY_ID,
      nonce.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join('.');
  }

  decrypt(envelope: string): string {
    const [version, keyId, noncePart, ciphertextPart, tagPart, extra] =
      envelope.split('.');
    if (
      version !== FORMAT_VERSION ||
      keyId !== KEY_ID ||
      !noncePart ||
      !ciphertextPart ||
      !tagPart ||
      extra
    ) {
      throw new Error('Credential envelope is invalid');
    }
    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.key(),
        Buffer.from(noncePart, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextPart, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error('Credential integrity validation failed');
    }
  }

  lastFour(value: string): string {
    return value.trim().slice(-4);
  }

  matches(envelope: string, plaintext: string): boolean {
    const actual = Buffer.from(this.decrypt(envelope));
    const expected = Buffer.from(plaintext);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private key(): Buffer {
    const encoded = this.config
      .get<string>('PROVIDER_CREDENTIALS_MASTER_KEY', '')
      .trim();
    if (encoded) {
      try {
        const key = Buffer.from(encoded, 'base64');
        if (key.length === 32) return key;
      } catch {
        // Fall through to hash derivation
      }
      return createHash('sha256').update(encoded).digest();
    }
    const secret = this.config.get<string>(
      'JWT_ACCESS_SECRET',
      'question-bank-master-encryption-key-fallback-salt',
    );
    return createHash('sha256')
      .update(`qb-provider-credentials-master:${secret}`)
      .digest();
  }
}
