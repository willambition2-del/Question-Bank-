import { Injectable } from '@nestjs/common';
import { ProgressReconciliationService } from './progress-reconciliation.service';
import type {
  PrismaTransactionClient,
  RecordQuestionAnswerInput,
} from './progress-types';

@Injectable()
export class StudentProgressService {
  constructor(private readonly reconciliation: ProgressReconciliationService) {}

  async recordQuestionAnswer(
    tx: PrismaTransactionClient,
    input: RecordQuestionAnswerInput,
  ): Promise<void> {
    await this.reconciliation.rebuildForAnswerWithTx(tx, input);
  }

  async recordQuizCompleted(
    tx: PrismaTransactionClient,
    userId: string,
    pointsEarned: number,
    completedAt = new Date(),
  ): Promise<void> {
    const date = this.utcDate(completedAt);
    await tx.studentDailyActivity.upsert({
      where: { userId_date: { userId, date } },
      update: {
        quizzesCompleted: { increment: 1 },
        pointsEarned: { increment: pointsEarned },
      },
      create: {
        userId,
        date,
        quizzesCompleted: 1,
        pointsEarned,
      },
    });
  }

  private utcDate(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
}
