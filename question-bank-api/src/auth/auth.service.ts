import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import type { User } from '../generated/prisma/client';
import {
  DEFAULT_ACCESS_TOKEN_EXPIRES_IN,
  DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
} from '../common/constants/auth.constants';
import {
  AuthResponse,
  AuthTokens,
  MessageResponse,
} from '../common/interfaces/auth-response.interface';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../common/interfaces/jwt-payload.interface';
import { toPublicUser } from '../common/mappers/user.mapper';
import { PublicUser } from '../common/types/public-user.type';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessTokenExpiresIn = configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      DEFAULT_ACCESS_TOKEN_EXPIRES_IN,
    );
    this.refreshTokenExpiresIn = configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
    );
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const username = dto.username.toLowerCase();
    if (await this.usersService.findByUsername(username)) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'USERNAME_ALREADY_EXISTS',
        message: 'Username is already in use',
      });
    }

    if (dto.phone && (await this.usersService.findByPhone(dto.phone))) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'PHONE_ALREADY_EXISTS',
        message: 'Phone number is already in use',
      });
    }

    const passwordHash = await this.hash(dto.password);
    const user = await this.usersService.createStudent({
      name: dto.name,
      username,
      phone: dto.phone,
      passwordHash,
      schoolName: dto.schoolName,
      companion: dto.companion,
    });

    const tokens = await this.issueTokenPair(user);
    const refreshTokenHash = await this.hash(tokens.refreshToken);
    await this.usersService.updateRefreshTokenHash(user.id, refreshTokenHash);
    return {
      user: toPublicUser(user),
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw this.invalidCredentials();
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'ACCOUNT_INACTIVE',
        message: 'This account is inactive',
      });
    }

    if (
      !user.passwordHash ||
      !(await this.verify(user.passwordHash, dto.password))
    ) {
      throw this.invalidCredentials();
    }

    return this.createSession(user, false);
  }

  async createSession(user: User, isNewUser = false): Promise<AuthResponse> {
    const tokens = await this.issueTokenPair(user);
    const refreshTokenHash = await this.hash(tokens.refreshToken);
    const updatedUser = await this.usersService.completeLogin(
      user.id,
      refreshTokenHash,
    );
    return {
      user: toPublicUser(updatedUser),
      tokens,
      isNewUser,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findById(payload.sub);

    if (
      !user ||
      !user.isActive ||
      user.deletedAt !== null ||
      user.tokenVersion !== payload.tokenVersion ||
      !user.refreshTokenHash
    ) {
      throw this.invalidRefreshToken();
    }

    if (!(await this.verify(user.refreshTokenHash, refreshToken))) {
      throw this.invalidRefreshToken();
    }

    const tokens = await this.issueTokenPair(user);
    const nextHash = await this.hash(tokens.refreshToken);
    const rotated = await this.usersService.rotateRefreshToken(
      user.id,
      user.refreshTokenHash,
      user.tokenVersion,
      nextHash,
    );

    if (!rotated) {
      throw this.invalidRefreshToken();
    }

    return {
      user: toPublicUser(user),
      tokens,
    };
  }

  async logout(userId: string): Promise<MessageResponse> {
    await this.usersService.clearRefreshToken(userId, true);
    return {
      message: 'Logged out successfully',
    };
  }

  getCurrentUser(userId: string): Promise<PublicUser> {
    return this.usersService.getPublicProfile(userId);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<MessageResponse> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw this.invalidAccessToken();
    }

    if (
      !user.passwordHash ||
      !(await this.verify(user.passwordHash, dto.currentPassword))
    ) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        code: 'CURRENT_PASSWORD_INVALID',
        message: 'Current password is incorrect',
      });
    }

    if (await this.verify(user.passwordHash, dto.newPassword)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'PASSWORD_UNCHANGED',
        message: 'The new password must differ from the current password',
      });
    }

    const passwordHash = await this.hash(dto.newPassword);
    await this.usersService.changePassword(user.id, passwordHash);

    return {
      message: 'Password changed successfully. Sign in again to continue.',
    };
  }

  private async issueTokenPair(user: User): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      username: user.username,
      tokenVersion: user.tokenVersion,
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenVersion: user.tokenVersion,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessTokenExpiresIn as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        jwtid: randomUUID(),
        expiresIn: this.refreshTokenExpiresIn as JwtSignOptions['expiresIn'],
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.accessTokenExpiresIn,
      refreshTokenExpiresIn: this.refreshTokenExpiresIn,
    };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          secret: this.refreshSecret,
        },
      );

      if (
        payload.type !== 'refresh' ||
        typeof payload.sub !== 'string' ||
        typeof payload.jti !== 'string' ||
        !Number.isInteger(payload.tokenVersion)
      ) {
        throw this.invalidRefreshToken();
      }

      return payload;
    } catch {
      throw this.invalidRefreshToken();
    }
  }

  private hash(value: string): Promise<string> {
    return argon2.hash(value, {
      type: argon2.argon2id,
    });
  }

  private async verify(hash: string, value: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, value);
    } catch {
      return false;
    }
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: 'INVALID_CREDENTIALS',
      message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    });
  }

  private invalidRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token is invalid or expired',
    });
  }

  private invalidAccessToken(): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: 'INVALID_ACCESS_TOKEN',
      message: 'Access token is invalid or expired',
    });
  }
}
