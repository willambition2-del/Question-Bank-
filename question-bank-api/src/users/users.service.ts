import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanionType, GradeLevel, UserRole } from '../generated/prisma/enums';
import type { User } from '../generated/prisma/client';
import { toPublicUser } from '../common/mappers/user.mapper';
import { PublicUser } from '../common/types/public-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

import { isValidYemenGovernorate } from '../common/constants/governorates.constant';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

export interface CreateStudentInput {
  name: string;
  username: string;
  phone?: string;
  passwordHash: string;
  schoolName?: string;
  governorate?: string;
  gradeLevel?: GradeLevel;
  companion: CompanionType;
}

interface PrismaErrorShape {
  code?: unknown;
  meta?: {
    target?: unknown;
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        username: username.toLowerCase(),
        deletedAt: null,
      },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
      },
    });
  }
  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        phone,
        deletedAt: null,
      },
    });
  }


  async createStudent(input: CreateStudentInput): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          name: input.name,
          username: input.username.toLowerCase(),
          phone: input.phone,
          passwordHash: input.passwordHash,
          schoolName: input.schoolName,
          governorate: input.governorate,
          gradeLevel: input.gradeLevel ?? GradeLevel.THIRD_SECONDARY,
          onboardingCompleted: false,
          companion: input.companion,
          role: UserRole.STUDENT,
          isActive: true,
        },
      });
    } catch (error: unknown) {
      this.throwUniqueConflict(error);
      throw error;
    }
  }

  async getPublicProfile(id: string): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user || !user.isActive) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    return toPublicUser(user);
  }

  async completeOnboarding(id: string, dto: CompleteOnboardingDto): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user || !user.isActive) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (!isValidYemenGovernorate(dto.governorate)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'INVALID_GOVERNORATE',
        message: 'المحافظة المختارة غير صالحة. يرجى اختيار محافظة يمنية من القائمة.',
      });
    }

    if (dto.phone !== undefined && dto.phone !== user.phone) {
      const owner = await this.findByPhone(dto.phone);
      if (owner && owner.id !== id) {
        throw this.phoneConflict();
      }
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          schoolName: dto.schoolName.trim(),
          governorate: dto.governorate.trim(),
          gradeLevel: dto.gradeLevel,
          phone: dto.phone ?? user.phone,
          onboardingCompleted: true,
        },
      });

      return toPublicUser(updated);
    } catch (error: unknown) {
      this.throwUniqueConflict(error);
      throw error;
    }
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'EMPTY_PROFILE_UPDATE',
        message: 'At least one profile field is required',
      });
    }

    const user = await this.findById(id);
    if (!user || !user.isActive) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (dto.governorate !== undefined && !isValidYemenGovernorate(dto.governorate)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'INVALID_GOVERNORATE',
        message: 'المحافظة المختارة غير صالحة. يرجى اختيار محافظة يمنية من القائمة.',
      });
    }

    if (dto.phone !== undefined && dto.phone !== user.phone) {
      const owner = await this.findByPhone(dto.phone);
      if (owner && owner.id !== id) {
        throw this.phoneConflict();
      }
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          name: dto.name,
          phone: dto.phone,
          schoolName: dto.schoolName,
          governorate: dto.governorate,
          gradeLevel: dto.gradeLevel,
          companion: dto.companion,
          onboardingCompleted: dto.onboardingCompleted,
        },
      });

      return toPublicUser(updated);
    } catch (error: unknown) {
      this.throwUniqueConflict(error);
      throw error;
    }
  }

  updateLastLogin(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  updateRefreshTokenHash(id: string, refreshTokenHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { refreshTokenHash },
    });
  }

  completeLogin(id: string, refreshTokenHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        refreshTokenHash,
      },
    });
  }

  async rotateRefreshToken(
    id: string,
    currentHash: string,
    tokenVersion: number,
    nextHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: {
        id,
        refreshTokenHash: currentHash,
        tokenVersion,
        isActive: true,
        deletedAt: null,
      },
      data: {
        refreshTokenHash: nextHash,
      },
    });

    return result.count === 1;
  }

  clearRefreshToken(id: string, invalidateAccessTokens = false): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        refreshTokenHash: null,
        tokenVersion: invalidateAccessTokens ? { increment: 1 } : undefined,
      },
    });
  }

  changePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        refreshTokenHash: null,
        tokenVersion: { increment: 1 },
      },
    });
  }

  deactivateUser(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        refreshTokenHash: null,
        tokenVersion: { increment: 1 },
      },
    });
  }

  private throwUniqueConflict(error: unknown): void {
    if (!this.isUniqueConstraintError(error)) {
      return;
    }

    const target = error.meta?.target;
    const fields = Array.isArray(target)
      ? target.filter((field): field is string => typeof field === 'string')
      : typeof target === 'string'
        ? [target]
        : [];

    if (fields.some((field) => field.includes('phone'))) {
      throw this.phoneConflict();
    }

    throw new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      code: 'USERNAME_ALREADY_EXISTS',
      message: 'Username is already in use',
    });
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is PrismaErrorShape & { code: 'P2002' } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as PrismaErrorShape).code === 'P2002'
    );
  }

  private phoneConflict(): ConflictException {
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      code: 'PHONE_ALREADY_EXISTS',
      message: 'Phone number is already in use',
    });
  }
}
