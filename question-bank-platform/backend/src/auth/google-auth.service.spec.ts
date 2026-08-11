import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import {
  CompanionType,
  IdentityProvider,
  UserRole,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import {
  GoogleTokenVerifier,
  VerifiedGoogleIdentity,
} from './google-token.verifier';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const identity: VerifiedGoogleIdentity = {
  subject: 'google-sub-1',
  email: 'student@example.com',
  emailVerified: true,
  name: 'Student Name',
};

const user = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Student Name',
  username: 'student_name_abc123',
  phone: null,
  email: identity.email,
  passwordHash: null,
  refreshTokenHash: null,
  lastLoginAt: null,
  tokenVersion: 0,
  passwordChangedAt: null,
  role: UserRole.STUDENT,
  companion: CompanionType.MALE,
  schoolName: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const authResult = (value: User, isNewUser: boolean) => ({
  user: {
    id: value.id,
    name: value.name,
    username: value.username,
    phone: value.phone,
    email: value.email,
    role: value.role,
    companion: value.companion,
    schoolName: value.schoolName,
    isActive: value.isActive,
    lastLoginAt: value.lastLoginAt,
    createdAt: value.createdAt,
  },
  tokens: {
    accessToken: 'application-access-token',
    refreshToken: 'application-refresh-token',
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '30d',
  },
  isNewUser,
});

async function expectCode(action: Promise<unknown>, code: string) {
  try {
    await action;
    throw new Error('Expected request to fail');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(Error);
    const response = (error as { getResponse?: () => unknown }).getResponse?.();
    expect(response).toEqual(expect.objectContaining({ code }));
  }
}

describe('GoogleAuthService', () => {
  const prisma = {
    userIdentity: { findUnique: jest.fn() },
    user: { findFirst: jest.fn(), create: jest.fn() },
  };
  const verifier = { verify: jest.fn() };
  const auth = { createSession: jest.fn() };
  let service: GoogleAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    verifier.verify.mockResolvedValue(identity);
    prisma.userIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user());
    auth.createSession.mockImplementation((value: User, isNew: boolean) =>
      Promise.resolve(authResult(value, isNew)),
    );
    service = new GoogleAuthService(
      prisma as unknown as PrismaService,
      verifier as unknown as GoogleTokenVerifier,
      auth as unknown as AuthService,
    );
  });

  it('creates a passwordless user and Google identity for a valid token', async () => {
    const result = await service.login('valid-id-token');
    expect(prisma.user.create).toHaveBeenCalledWith({
      // Jest asymmetric matchers are typed as any by @types/jest.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        email: identity.email,
        passwordHash: null,
        role: UserRole.STUDENT,
        identities: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          create: expect.objectContaining({
            provider: IdentityProvider.GOOGLE,
            providerUserId: identity.subject,
            emailVerified: true,
          }),
        },
      }),
    });
    expect(result.isNewUser).toBe(true);
    expect(result.tokens.accessToken).toBe('application-access-token');
  });

  it('logs in an existing identity without creating another user', async () => {
    prisma.userIdentity.findUnique.mockResolvedValue({ user: user() });
    const result = await service.login('valid-id-token');
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(auth.createSession).toHaveBeenCalledWith(expect.any(Object), false);
    expect(result.isNewUser).toBe(false);
  });

  it('rejects an unverified Google email', async () => {
    verifier.verify.mockResolvedValue({ ...identity, emailVerified: false });
    await expectCode(
      service.login('unverified-token'),
      'GOOGLE_EMAIL_NOT_VERIFIED',
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('requires explicit linking when a password account owns the email', async () => {
    prisma.user.findFirst.mockResolvedValue(user({ passwordHash: 'hash' }));
    await expectCode(
      service.login('valid-id-token'),
      'GOOGLE_ACCOUNT_LINK_REQUIRED',
    );
  });

  it('does not silently link an orphaned passwordless email either', async () => {
    prisma.user.findFirst.mockResolvedValue(user());
    await expect(service.login('valid-id-token')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects inactive linked users', async () => {
    prisma.userIdentity.findUnique.mockResolvedValue({
      user: user({ isActive: false }),
    });
    await expect(service.login('valid-id-token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('recovers from concurrent first login without duplicate users', async () => {
    prisma.user.create.mockRejectedValue({ code: 'P2002' });
    prisma.userIdentity.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ user: user() });
    const result = await service.login('valid-id-token');
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(result.isNewUser).toBe(false);
  });

  it.each([
    [
      'GOOGLE_TOKEN_INVALID',
      new UnauthorizedException({ code: 'GOOGLE_TOKEN_INVALID' }),
    ],
    [
      'GOOGLE_TOKEN_EXPIRED',
      new UnauthorizedException({ code: 'GOOGLE_TOKEN_EXPIRED' }),
    ],
    [
      'GOOGLE_TOKEN_AUDIENCE_INVALID',
      new UnauthorizedException({ code: 'GOOGLE_TOKEN_AUDIENCE_INVALID' }),
    ],
    [
      'SOCIAL_PROVIDER_DISABLED',
      new BadRequestException({ code: 'SOCIAL_PROVIDER_DISABLED' }),
    ],
  ])('propagates verifier failure %s', async (code, error) => {
    verifier.verify.mockRejectedValue(error);
    await expectCode(service.login('bad-token'), code);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
