import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { DailyTaskType, PointType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AppDateService } from './app-date.service';
import { PointsService } from './points.service';

@Injectable()
export class DailyTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dates: AppDateService,
    private readonly points: PointsService,
  ) {}

  async today(userId: string) {
    const date = this.dates.today();
    const definitions = await this.prisma.dailyTaskDefinition.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    await this.prisma.$transaction(
      definitions.map((definition) =>
        this.prisma.userDailyTask.upsert({
          where: {
            userId_taskDefinitionId_date: {
              userId,
              taskDefinitionId: definition.id,
              date,
            },
          },
          update: {},
          create: {
            userId,
            taskDefinitionId: definition.id,
            date,
            targetValue: definition.targetValue,
          },
        }),
      ),
    );
    return this.prisma.userDailyTask.findMany({
      where: { userId, date },
      include: { taskDefinition: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async progress(
    tx: Prisma.TransactionClient,
    userId: string,
    type: DailyTaskType,
    increment = 1,
  ) {
    const date = this.dates.today();
    const definitions = await tx.dailyTaskDefinition.findMany({
      where: { isActive: true, taskType: type },
    });
    for (const definition of definitions) {
      const key = {
        userId,
        taskDefinitionId: definition.id,
        date,
      };
      const current = await tx.userDailyTask.findUnique({
        where: { userId_taskDefinitionId_date: key },
      });
      const progress = Math.min(
        current?.targetValue ?? definition.targetValue,
        (current?.progress ?? 0) + increment,
      );
      const isCompleted =
        progress >= (current?.targetValue ?? definition.targetValue);
      await tx.userDailyTask.upsert({
        where: { userId_taskDefinitionId_date: key },
        update: {
          progress,
          isCompleted,
          completedAt: isCompleted
            ? (current?.completedAt ?? new Date())
            : null,
        },
        create: {
          ...key,
          progress,
          targetValue: definition.targetValue,
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
      });
    }
  }

  async claim(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.userDailyTask.findFirst({
        where: { id, userId },
        include: { taskDefinition: true },
      });
      if (!task) {
        throw new BadRequestException({
          code: 'DAILY_TASK_NOT_FOUND',
          message: 'Daily task not found',
        });
      }
      if (!task.isCompleted) {
        throw new BadRequestException({
          code: 'DAILY_TASK_INCOMPLETE',
          message: 'Daily task is not complete',
        });
      }
      if (task.rewardClaimedAt) return task;
      await this.points.award(tx, userId, {
        amount: task.taskDefinition.pointsReward,
        type: PointType.DAILY_TASK,
        idempotencyKey: `daily-task:${task.id}`,
        referenceType: 'UserDailyTask',
        referenceId: task.id,
        description: task.taskDefinition.title,
      });
      return tx.userDailyTask.update({
        where: { id: task.id },
        data: { rewardClaimedAt: new Date() },
        include: { taskDefinition: true },
      });
    });
  }
}
