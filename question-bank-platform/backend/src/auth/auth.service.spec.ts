import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client';
import { CompanionType, UserRole } from '../generated/prisma/enums';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

const ACCESS_SECRET = 'unit-test-access-secret';
const REFRESH_SECRET = 'unit-test-refresh-secret';
const PASSWORD = 'Password1';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Student User',
  username: 'student_1',
  phone: '+966500000001',
  email: null,
  passwordHash: 'hash',
  refreshTokenHash: null,
  role: UserRole.STUDENT,
  companion: CompanionType.MALE,
  schoolName: 'Test School',
  isActive: true,
  lastLoginAt: null,
  tokenVersion: 0,
  passwordChangedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('AuthService', () => {
  const usersService = {
    findByUsername: jest.fn<UsersService['findByUsername']>(),
    findByPhone: jest.fn<UsersService['findByPhone']>(),
    findByIdentifier: jest.fn<UsersService['findByIdentifier']>(),
    findById: jest.fn<UsersService['findById']>(),
    createStudent: jest.fn<UsersService['createStudent']>(),
    updateRefreshTokenHash: jest.fn<UsersService['updateRefreshTokenHash']>(),
    completeLogin: jest.fn<UsersService['completeLogin']>(),
    rotateRefreshToken: jest.fn<UsersService['rotateRefreshToken']>(),
    clearRefreshToken: jest.fn<UsersService['clearRefreshToken']>(),
    getPublicProfile: jest.fn<UsersService['getPublicProfile']>(),
    changePassword: jest.fn<UsersService['changePassword']>(),
  };

  let service: AuthService;
  let jwtService: JwtService;
  let user: User;

  beforeEach(async () => {
    jest.clearAllMocks();
    user = makeUser({
      passwordHash: await argon2.hash(PASSWORD),
    });
    jwtService = new JwtService();
    const configService = new ConfigService({
      JWT_ACCESS_SECRET: ACCESS_SECRET,
      JWT_REFRESH_SECRET: REFRESH_SECRET,
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '30d',
    });
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService,
      configService,
    );

    usersService.findByUsername.mockResolvedValue(null);
    usersService.findByPhone.mockResolvedValue(null);
    usersService.createStudent.mockResolvedValue(user);
    usersService.updateRefreshTokenHash.mockResolvedValue(user);
  });

  const registerDto = (): RegisterDto => ({
    name: 'Student User',
    username: 'student_1',
    phone: '+966500000001',
    email: null,
    password: PASSWORD,
    schoolName: 'Test School',
    companion: CompanionType.MALE,
  });

  it('registers a new student without exposing sensitive fields', async () => {
    const result = await service.register(registerDto());

    expect(usersService.createStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'student_1',
        companion: CompanionType.MALE,
      }),
    );
    expect(result.user.role).toBe(UserRole.STUDENT);
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('refreshTokenHash');
    expect(result.user).not.toHaveProperty('tokenVersion');
  });

  it('rejects a duplicate username', async () => {
    usersService.findByUsername.mockResolvedValue(user);

    await expect(service.register(registerDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(usersService.createStudent).not.toHaveBeenCalled();
  });

  it('rejects a duplicate phone', async () => {
    usersService.findByPhone.mockResolvedValue(user);

    await expect(service.register(registerDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('logs in with valid credentials and issues tokens', async () => {
    usersService.findByIdentifier.mockResolvedValue(user);
    usersService.completeLogin.mockImplementation(
      (_id: string, refreshTokenHash: string): Promise<User> =>
        Promise.resolve({
          ...user,
          refreshTokenHash,
          lastLoginAt: new Date(),
        }),
    );

    const result = await service.login({
      identifier: user.username,
      password: PASSWORD,
    });

    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));
    expect(usersService.completeLogin).toHaveBeenCalled();
  });

  it('rejects an invalid password with a generic error', async () => {
    usersService.findByIdentifier.mockResolvedValue(user);

    await expect(
      service.login({
        identifier: user.username,
        password: 'WrongPassword1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an inactive account', async () => {
    usersService.findByIdentifier.mockResolvedValue(
      makeUser({ isActive: false }),
    );

    await expect(
      service.login({
        identifier: user.username,
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses the minimal access token payload', async () => {
    usersService.findByIdentifier.mockResolvedValue(user);
    usersService.completeLogin.mockResolvedValue(user);

    const result = await service.login({
      identifier: user.username,
      password: PASSWORD,
    });
    const payload = jwtService.verify<Record<string, unknown>>(
      result.tokens.accessToken,
      { secret: ACCESS_SECRET },
    );

    expect(payload).toMatchObject({
      sub: user.id,
      role: user.role,
      username: user.username,
      tokenVersion: user.tokenVersion,
    });
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('password');
  });

  it('rotates a valid refresh token', async () => {
    usersService.findByIdentifier.mockResolvedValue(user);
    usersService.completeLogin.mockImplementation(
      (_id: string, refreshTokenHash: string): Promise<User> => {
        user = {
          ...user,
          refreshTokenHash,
        };
        return Promise.resolve(user);
      },
    );
    usersService.findById.mockImplementation((): Promise<User> =>
      Promise.resolve(user),
    );
    usersService.rotateRefreshToken.mockResolvedValue(true);

    const login = await service.login({
      identifier: user.username,
      password: PASSWORD,
    });
    const refreshed = await service.refresh(login.tokens.refreshToken);

    expect(refreshed.tokens.refreshToken).not.toBe(login.tokens.refreshToken);
    expect(usersService.rotateRefreshToken).toHaveBeenCalled();
  });

  it('rejects a refresh token that does not match the stored hash', async () => {
    const refreshToken = await jwtService.signAsync(
      {
        sub: user.id,
        tokenVersion: user.tokenVersion,
        type: 'refresh',
      },
      {
        secret: REFRESH_SECRET,
        expiresIn: '30d',
        jwtid: 'unit-test-refresh-id',
      },
    );
    usersService.findById.mockResolvedValue({
      ...user,
      refreshTokenHash: await argon2.hash('another-token'),
    });

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('logs out and invalidates the access token version', async () => {
    usersService.clearRefreshToken.mockResolvedValue(user);

    await expect(service.logout(user.id)).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(usersService.clearRefreshToken).toHaveBeenCalledWith(user.id, true);
  });

  it('changes the password and invalidates all sessions', async () => {
    usersService.findById.mockResolvedValue(user);
    usersService.changePassword.mockResolvedValue({
      ...user,
      tokenVersion: 1,
      refreshTokenHash: null,
    });

    await expect(
      service.changePassword(user.id, {
        currentPassword: PASSWORD,
        newPassword: 'NewPassword2',
      }),
    ).resolves.toEqual({
      message: 'Password changed successfully. Sign in again to continue.',
    });
    expect(usersService.changePassword).toHaveBeenCalledWith(
      user.id,
      expect.any(String),
    );
  });
});
