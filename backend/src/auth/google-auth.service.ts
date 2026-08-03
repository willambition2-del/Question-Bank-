import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import { IdentityProvider, UserRole } from '../generated/prisma/enums';
import { AuthResponse } from '../common/interfaces/auth-response.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import {
  GoogleTokenVerifier,
  VerifiedGoogleIdentity,
} from './google-token.verifier';

interface PrismaErrorShape {
  code?: unknown;
}

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verifier: GoogleTokenVerifier,
    private readonly auth: AuthService,
  ) {}

  async login(idToken: string): Promise<AuthResponse> {
    const identity = await this.verifier.verify(idToken);
    if (!identity.emailVerified) {
      throw new BadRequestException({
        statusCode: HttpStatus.UNAUTHORIZED,
        code: 'GOOGLE_EMAIL_NOT_VERIFIED',
        message: 'Google email is not verified',
      });
    }

    const linked = await this.findIdentity(identity.subject);
    if (linked) return this.session(linked.user, false);

    const existing = await this.prisma.user.findFirst({
      where: { email: identity.email, deletedAt: null },
    });
    if (existing) throw this.linkRequired();

    const created = await this.createUser(identity);
    return this.session(created.user, created.isNewUser);
  }

  private async createUser(
    identity: VerifiedGoogleIdentity,
  ): Promise<{ user: User; isNewUser: boolean }> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const created = await this.prisma.user.create({
          data: {
            name: identity.name,
            username: this.username(identity.email, attempt),
            email: identity.email,
            passwordHash: null,
            role: UserRole.STUDENT,
            isActive: true,
            identities: {
              create: {
                provider: IdentityProvider.GOOGLE,
                providerUserId: identity.subject,
                providerEmail: identity.email,
                emailVerified: true,
              },
            },
          },
        });
        return { user: created, isNewUser: true };
      } catch (error: unknown) {
        if (!this.isUniqueConflict(error)) throw error;
        const linked = await this.findIdentity(identity.subject);
        if (linked) return { user: linked.user, isNewUser: false };
        const emailOwner = await this.prisma.user.findFirst({
          where: { email: identity.email, deletedAt: null },
        });
        if (emailOwner) throw this.linkRequired();
      }
    }
    throw new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      code: 'GOOGLE_ACCOUNT_CREATION_CONFLICT',
      message: 'Could not allocate a unique username',
    });
  }

  private findIdentity(subject: string) {
    return this.prisma.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: IdentityProvider.GOOGLE,
          providerUserId: subject,
        },
      },
      include: { user: true },
    });
  }

  private session(user: User, isNewUser: boolean): Promise<AuthResponse> {
    if (!user.isActive || user.deletedAt !== null) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'ACCOUNT_INACTIVE',
        message: 'This account is inactive',
      });
    }
    return this.auth.createSession(user, isNewUser);
  }

  private username(email: string, attempt: number): string {
    const local = email.split('@')[0]?.toLowerCase() ?? 'student';
    const base = local.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const safeBase = (base.length >= 3 ? base : `student_${base}`).slice(0, 21);
    const suffix = this.hashSuffix(`${email}:${attempt}`);
    return `${safeBase}_${suffix}`.slice(0, 30);
  }

  private hashSuffix(value: string): string {
    let hash = 2166136261;
    for (const unit of value) {
      hash ^= unit.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).padStart(6, '0').slice(0, 6);
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as PrismaErrorShape).code === 'P2002'
    );
  }

  private linkRequired(): ConflictException {
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
      message:
        'An account already uses this email. Sign in with the existing method before linking Google.',
    });
  }
}
