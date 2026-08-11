import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatesService } from './updates.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('UpdatesService', () => {
  it('never returns drafts through the student detail method', async () => {
    const prisma = {
      appUpdate: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new UpdatesService(prisma as unknown as PrismaService);
    await expect(service.getPublished('update-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.appUpdate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'update-1', isPublished: true, deletedAt: null },
      }),
    );
  });
});
