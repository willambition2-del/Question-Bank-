import {
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface VerifiedGoogleIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

@Injectable()
export class GoogleTokenVerifier {
  private readonly enabled: boolean;
  private readonly clientId: string;
  private readonly client = new OAuth2Client();

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('GOOGLE_AUTH_ENABLED', false);
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID', '').trim();
  }

  async verify(idToken: string): Promise<VerifiedGoogleIdentity> {
    if (!this.enabled || !this.clientId) {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'SOCIAL_PROVIDER_DISABLED',
        message: 'Google authentication is disabled',
      });
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) throw this.invalid();
      return {
        subject: payload.sub,
        email: payload.email.trim().toLowerCase(),
        emailVerified: payload.email_verified === true,
        name: this.cleanName(payload.name),
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      const claims = this.unverifiedClaims(idToken);
      if (typeof claims?.exp === 'number' && claims.exp <= Date.now() / 1000) {
        throw this.unauthorized(
          'GOOGLE_TOKEN_EXPIRED',
          'Google ID token expired',
        );
      }
      const audience = claims?.aud;
      if (
        (typeof audience === 'string' && audience !== this.clientId) ||
        (Array.isArray(audience) && !audience.includes(this.clientId))
      ) {
        throw this.unauthorized(
          'GOOGLE_TOKEN_AUDIENCE_INVALID',
          'Google ID token audience is invalid',
        );
      }
      throw this.invalid();
    }
  }

  private cleanName(value: unknown): string {
    if (typeof value !== 'string') return 'Google User';
    const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 100);
    return normalized.length >= 2 ? normalized : 'Google User';
  }

  private unverifiedClaims(token: string): Record<string, unknown> | null {
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const decoded: unknown = JSON.parse(
        Buffer.from(part, 'base64url').toString('utf8'),
      );
      return typeof decoded === 'object' && decoded !== null
        ? (decoded as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private invalid(): UnauthorizedException {
    return this.unauthorized(
      'GOOGLE_TOKEN_INVALID',
      'Google ID token is invalid',
    );
  }

  private unauthorized(code: string, message: string): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code,
      message,
    });
  }
}
