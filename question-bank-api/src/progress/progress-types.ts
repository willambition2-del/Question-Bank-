import type { Prisma } from '../generated/prisma/client';

export type PrismaTransactionClient = Prisma.TransactionClient;

export interface RecordQuestionAnswerInput {
  userId: string;
  questionId: string;
  attemptId: string;
  quizAnswerId: string;
  isCorrect: boolean;
  timeSpentMs: number;
  selectedOptionId?: string | null;
  selectedBoolean?: boolean | null;
  answeredAt: Date;
}
