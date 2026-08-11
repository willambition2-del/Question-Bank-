jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../generated/prisma/client', () => ({
  Prisma: { DbNull: null, sql: jest.fn(), join: jest.fn() },
}));
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OWNER_APPROVED_FULL_IMPORT,
  TrustedQuestionDatabaseImportService,
} from './trusted-question-database-import.service';

describe('TrustedQuestionDatabaseImportService', () => {
  const findUser = jest.fn<() => Promise<{ id: string } | null>>();
  const prisma = { user: { findFirst: findUser } };
  const service = new TrustedQuestionDatabaseImportService(
    prisma as unknown as PrismaService,
  );
  const internal = service as unknown as {
    trueFalse(value: unknown): boolean | null;
    subjectKey(value: string): string;
  };
  beforeEach(() => jest.clearAllMocks());

  it('requires the exact owner approval phrase before accessing the database', async () => {
    await expect(
      service.execute('job', 'actor', 'IMPORT'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findUser).not.toHaveBeenCalled();
  });

  it('requires an active SUPER_ADMIN even with owner approval', async () => {
    findUser.mockResolvedValue(null);
    await expect(
      service.execute('job', 'actor', OWNER_APPROVED_FULL_IMPORT),
    ).rejects.toThrow('Only an active SUPER_ADMIN');
  });

  it('maps only unambiguous true/false source values', () => {
    const map = (value: unknown) => internal.trueFalse(value);
    expect(map('صح')).toBe(true);
    expect(map('صواب')).toBe(true);
    expect(map('خطأ')).toBe(false);
    expect(map('غير واضحة')).toBeNull();
  });

  it('matches source subjects without changing their text', () => {
    const key = (value: string) => internal.subjectKey(value);
    expect(key('أحياء')).toBe(key('الأحياء'));
    expect(key('كيمياء')).toBe(key('الكيمياء'));
  });
});
