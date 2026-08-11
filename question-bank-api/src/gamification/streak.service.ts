import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { AppDateService } from './app-date.service';

@Injectable()
export class StreakService {
  constructor(private readonly dates: AppDateService) {}

  async recordActivity(
    tx: Prisma.TransactionClient,
    userId: string,
    now = new Date(),
  ) {
    const today = this.dates.today(now);
    const current = await tx.userStreak.findUnique({ where: { userId } });
    if (current?.lastActiveDate?.getTime() === today.getTime()) return current;
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const currentDays =
      current?.lastActiveDate?.getTime() === yesterday.getTime()
        ? current.currentDays + 1
        : 1;
    return tx.userStreak.upsert({
      where: { userId },
      update: {
        currentDays,
        bestDays: Math.max(current?.bestDays ?? 0, currentDays),
        lastActiveDate: today,
      },
      create: {
        userId,
        currentDays: 1,
        bestDays: 1,
        lastActiveDate: today,
      },
    });
  }
}
