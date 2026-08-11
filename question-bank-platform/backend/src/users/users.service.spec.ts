import { ConflictException } from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import { CompanionType, UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Student User',
  username: 'student_1',
  phone: '+966500000001',
  email: null,
  passwordHash: 'secret-hash',
  refreshTokenHash: 'token-hash',
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

describe('UsersService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('finds a non-deleted user by id', async () => {
    const user = makeUser();
    prisma.user.findFirst.mockResolvedValue(user);

    await expect(service.findById(user.id)).resolves.toBe(user);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: user.id,
        deletedAt: null,
      },
    });
  });

  it('updates only permitted profile fields', async () => {
    const user = makeUser();
    const updated = makeUser({
      name: 'Updated Name',
      companion: CompanionType.FEMALE,
    });
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(updated);

    const result = await service.updateProfile(user.id, {
      name: 'Updated Name',
      companion: CompanionType.FEMALE,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        name: 'Updated Name',
        phone: undefined,
        schoolName: undefined,
        companion: CompanionType.FEMALE,
      },
    });
    expect(result.name).toBe('Updated Name');
  });

  it('rejects a phone used by another account', async () => {
    const user = makeUser();
    const other = makeUser({
      id: 'user-2',
      phone: '+966500000002',
    });
    prisma.user.findFirst
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(other);

    await expect(
      service.updateProfile(user.id, {
        phone: other.phone ?? undefined,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('maps public users without sensitive fields', async () => {
    const user = makeUser();
    prisma.user.findFirst.mockResolvedValue(user);

    const result = await service.getPublicProfile(user.id);

    expect(result).toMatchObject({
      id: user.id,
      username: user.username,
      role: user.role,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('refreshTokenHash');
    expect(result).not.toHaveProperty('tokenVersion');
    expect(result).not.toHaveProperty('deletedAt');
  });
});
