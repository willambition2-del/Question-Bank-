import { Injectable } from '@nestjs/common';
import { createPageMeta } from '../common/pagination/pagination';
import type { Prisma } from '../generated/prisma/client';
import { PointType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PointHistoryQueryDto } from './dto/gamification.dto';
import { LevelService } from './level.service';

export type AwardPointsInput = {
  amount: number;
  type: PointType;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  description?: string;
};

@Injectable()
export class PointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly levels: LevelService,
  ) {}

  async award(
    tx: Prisma.TransactionClient,
    userId: string,
    input: AwardPointsInput,
  ) {
    const inserted = await tx.pointTransaction.createMany({
      data: [{ userId, ...input }],
      skipDuplicates: true,
    });
    const transaction = await tx.pointTransaction.findUniqueOrThrow({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (inserted.count === 0) {
      return { awarded: false, transaction };
    }
    const points = await tx.userPoints.upsert({
      where: { userId },
      update: {
        totalPoints: { increment: input.amount },
        lifetimePoints: { increment: Math.max(0, input.amount) },
      },
      create: {
        userId,
        totalPoints: input.amount,
        lifetimePoints: Math.max(0, input.amount),
      },
    });
    const level = this.levels.levelFor(points.totalPoints);
    if (points.level !== level) {
      await tx.userPoints.update({ where: { userId }, data: { level } });
    }
    return {
      awarded: true,
      transaction,
      totalPoints: points.totalPoints,
      level,
    };
  }

  async get(userId: string) {
    const points = await this.prisma.userPoints.findUnique({
      where: { userId },
    });
    return this.levels.progress(points?.totalPoints ?? 0);
  }

  async history(userId: string, query: PointHistoryQueryDto) {
    const where = { userId };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.pointTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          amount: true,
          type: true,
          referenceType: true,
          referenceId: true,
          description: true,
          createdAt: true,
        },
      }),
      this.prisma.pointTransaction.count({ where }),
    ]);
    return { items, meta: createPageMeta(query.page, query.limit, totalItems) };
  }
}
