import { Injectable } from '@nestjs/common';
import type { StudentQuestionProgress } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from './mastery.service';
import { progressConflict, progressNotFound } from './progress-errors';
import type {
  PrismaTransactionClient,
  RecordQuestionAnswerInput,
} from './progress-types';
import {
  visibleQuestionWhere,
  type VisibleQuestionFilters,
} from './progress-visibility';

type QuestionHierarchy = {
  id: string;
  subjectId: string;
  unitId: string | null;
  lessonId: string | null;
};

type ProgressRow = Pick<
  StudentQuestionProgress,
  | 'attemptsCount'
  | 'correctCount'
  | 'averageTimeMs'
  | 'lastAnswerCorrect'
  | 'isMastered'
  | 'lastAnsweredAt'
>;

@Injectable()
export class ProgressReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  async rebuildQuestionProgress(
    userId: string,
    questionId: string,
  ): Promise<void> {
    await this.serializable((tx) =>
      this.rebuildQuestionProgressWithTx(tx, userId, questionId),
    );
  }

  async rebuildLessonProgress(userId: string, lessonId: string): Promise<void> {
    await this.serializable((tx) =>
      this.rebuildLessonProgressWithTx(tx, userId, lessonId),
    );
  }

  async rebuildUnitProgress(userId: string, unitId: string): Promise<void> {
    await this.serializable((tx) =>
      this.rebuildUnitProgressWithTx(tx, userId, unitId),
    );
  }

  async rebuildSubjectProgress(
    userId: string,
    subjectId: string,
  ): Promise<void> {
    await this.serializable((tx) =>
      this.rebuildSubjectProgressWithTx(tx, userId, subjectId),
    );
  }

  async rebuildUserProgress(userId: string): Promise<void> {
    await this.serializable(async (tx) => {
      const answers = await tx.quizAnswer.findMany({
        where: { attempt: { userId } },
        distinct: ['questionId'],
        select: { questionId: true },
      });
      const existing = await tx.studentQuestionProgress.findMany({
        where: { userId },
        select: { questionId: true },
      });
      const questionIds = [
        ...new Set([
          ...answers.map((answer) => answer.questionId),
          ...existing.map((row) => row.questionId),
        ]),
      ];
      const existingLessons = await tx.studentLessonProgress.findMany({
        where: { userId },
        select: { lessonId: true },
      });
      const existingUnits = await tx.studentUnitProgress.findMany({
        where: { userId },
        select: { unitId: true },
      });
      const existingSubjects = await tx.studentSubjectProgress.findMany({
        where: { userId },
        select: { subjectId: true },
      });
      const hierarchies: QuestionHierarchy[] = [];
      for (const questionId of questionIds) {
        const hierarchy = await this.rebuildQuestionProgressWithTx(
          tx,
          userId,
          questionId,
        );
        if (hierarchy) hierarchies.push(hierarchy);
      }
      const lessonIds = new Set([
        ...this.unique(hierarchies, 'lessonId'),
        ...existingLessons.map((row) => row.lessonId),
      ]);
      for (const lessonId of lessonIds)
        await this.rebuildLessonProgressWithTx(tx, userId, lessonId);
      const unitIds = new Set([
        ...this.unique(hierarchies, 'unitId'),
        ...existingUnits.map((row) => row.unitId),
      ]);
      for (const unitId of unitIds)
        await this.rebuildUnitProgressWithTx(tx, userId, unitId);
      const subjectIds = new Set([
        ...this.unique(hierarchies, 'subjectId'),
        ...existingSubjects.map((row) => row.subjectId),
      ]);
      for (const subjectId of subjectIds)
        await this.rebuildSubjectProgressWithTx(tx, userId, subjectId);
    });
  }

  async rebuildForAnswerWithTx(
    tx: PrismaTransactionClient,
    input: RecordQuestionAnswerInput,
  ): Promise<void> {
    if (!Number.isSafeInteger(input.timeSpentMs) || input.timeSpentMs < 0)
      throw progressConflict(
        'PROGRESS_UPDATE_CONFLICT',
        'Answer time must be a non-negative safe integer',
      );
    const hierarchy = await this.rebuildQuestionProgressWithTx(
      tx,
      input.userId,
      input.questionId,
      input,
    );
    if (!hierarchy)
      throw progressNotFound(
        'PROGRESS_NOT_FOUND',
        'Persisted quiz answer was not found',
      );
    await this.rebuildDailyAnswerActivityWithTx(
      tx,
      input.userId,
      input.answeredAt,
    );
    if (hierarchy.lessonId)
      await this.rebuildLessonProgressWithTx(
        tx,
        input.userId,
        hierarchy.lessonId,
      );
    if (hierarchy.unitId)
      await this.rebuildUnitProgressWithTx(tx, input.userId, hierarchy.unitId);
    await this.rebuildSubjectProgressWithTx(
      tx,
      input.userId,
      hierarchy.subjectId,
    );
  }

  async rebuildQuestionProgressWithTx(
    tx: PrismaTransactionClient,
    userId: string,
    questionId: string,
    expected?: RecordQuestionAnswerInput,
  ): Promise<QuestionHierarchy | null> {
    const question = await tx.question.findUnique({
      where: { id: questionId },
      select: { id: true, subjectId: true, unitId: true, lessonId: true },
    });
    const answers = await tx.quizAnswer.findMany({
      where: { questionId, attempt: { userId } },
      orderBy: [{ answeredAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        attemptId: true,
        isCorrect: true,
        timeSpentMs: true,
        selectedOptionId: true,
        selectedBoolean: true,
        answeredAt: true,
      },
    });
    const current = await tx.studentQuestionProgress.findUnique({
      where: { userId_questionId: { userId, questionId } },
      select: { masteredAt: true, manualReviewedAt: true },
    });
    if (!question)
      throw progressNotFound('PROGRESS_NOT_FOUND', 'Question not found');
    if (expected) {
      const persisted = answers.find(
        (answer) => answer.id === expected.quizAnswerId,
      );
      if (
        !persisted ||
        persisted.attemptId !== expected.attemptId ||
        persisted.isCorrect !== expected.isCorrect ||
        persisted.timeSpentMs !== expected.timeSpentMs ||
        persisted.selectedOptionId !== (expected.selectedOptionId ?? null) ||
        persisted.selectedBoolean !== (expected.selectedBoolean ?? null)
      )
        throw progressConflict(
          'PROGRESS_UPDATE_CONFLICT',
          'Progress input does not match the persisted quiz answer',
        );
    }
    if (!answers.length) {
      await tx.studentQuestionProgress.deleteMany({
        where: { userId, questionId },
      });
      return question;
    }

    const attemptsCount = answers.length;
    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    const wrongCount = attemptsCount - correctCount;
    let consecutiveCorrect = 0;
    let consecutiveWrong = 0;
    for (let index = answers.length - 1; index >= 0; index -= 1) {
      const answer = answers[index];
      if (answer.isCorrect && consecutiveWrong === 0) consecutiveCorrect += 1;
      else if (!answer.isCorrect && consecutiveCorrect === 0)
        consecutiveWrong += 1;
      else break;
    }
    const totalTime = answers.reduce(
      (sum, answer) => sum + answer.timeSpentMs,
      0,
    );
    const averageTimeMs = Math.round(totalTime / attemptsCount);
    const first = answers[0];
    const last = answers[answers.length - 1];
    const lastCorrect = [...answers]
      .reverse()
      .find((answer) => answer.isCorrect);
    const lastWrong = [...answers]
      .reverse()
      .find((answer) => !answer.isCorrect);
    const mastery = this.mastery.calculate({
      attemptsCount,
      correctCount,
      consecutiveCorrect,
      averageTimeMs,
      lastAnsweredAt: last.answeredAt,
    });
    const masteredAt =
      current?.masteredAt ?? (mastery.isMastered ? last.answeredAt : null);
    const values = {
      attemptsCount,
      correctCount,
      wrongCount,
      consecutiveCorrect,
      consecutiveWrong,
      averageTimeMs,
      lastTimeMs: last.timeSpentMs,
      lastAnswerCorrect: last.isCorrect,
      lastSelectedOptionId: last.selectedOptionId,
      lastSelectedBoolean: last.selectedBoolean,
      firstAnsweredAt: first.answeredAt,
      lastAnsweredAt: last.answeredAt,
      lastCorrectAt: lastCorrect?.answeredAt ?? null,
      lastWrongAt: lastWrong?.answeredAt ?? null,
      masteryScore: mastery.masteryScore,
      isMastered: mastery.isMastered,
      masteredAt,
      manualReviewedAt: current?.manualReviewedAt ?? null,
    };
    await tx.studentQuestionProgress.upsert({
      where: { userId_questionId: { userId, questionId } },
      update: values,
      create: { userId, questionId, ...values },
    });
    return question;
  }

  async rebuildLessonProgressWithTx(
    tx: PrismaTransactionClient,
    userId: string,
    lessonId: string,
  ): Promise<void> {
    const values = await this.aggregateValues(tx, userId, { lessonId });
    await tx.studentLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: values,
      create: { userId, lessonId, ...values },
    });
  }

  async rebuildUnitProgressWithTx(
    tx: PrismaTransactionClient,
    userId: string,
    unitId: string,
  ): Promise<void> {
    const values = await this.aggregateValues(tx, userId, { unitId });
    await tx.studentUnitProgress.upsert({
      where: { userId_unitId: { userId, unitId } },
      update: values,
      create: { userId, unitId, ...values },
    });
  }

  async rebuildSubjectProgressWithTx(
    tx: PrismaTransactionClient,
    userId: string,
    subjectId: string,
  ): Promise<void> {
    const values = await this.aggregateValues(tx, userId, { subjectId });
    await tx.studentSubjectProgress.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      update: values,
      create: { userId, subjectId, ...values },
    });
  }

  private async aggregateValues(
    tx: PrismaTransactionClient,
    userId: string,
    filters: VisibleQuestionFilters,
  ) {
    const questionWhere = visibleQuestionWhere(filters);
    const rows: ProgressRow[] = await tx.studentQuestionProgress.findMany({
      where: { userId, question: questionWhere },
      select: {
        attemptsCount: true,
        correctCount: true,
        averageTimeMs: true,
        lastAnswerCorrect: true,
        isMastered: true,
        lastAnsweredAt: true,
      },
    });
    const totalQuestionsCount = await tx.question.count({
      where: questionWhere,
    });
    const attempts = rows.reduce((sum, row) => sum + row.attemptsCount, 0);
    const correctAttempts = rows.reduce(
      (sum, row) => sum + row.correctCount,
      0,
    );
    const weightedTime = rows.reduce(
      (sum, row) => sum + row.averageTimeMs * row.attemptsCount,
      0,
    );
    return {
      answeredQuestions: rows.length,
      correctAnswers: rows.filter((row) => row.lastAnswerCorrect === true)
        .length,
      wrongAnswers: rows.filter((row) => row.lastAnswerCorrect === false)
        .length,
      accuracyPercent: this.percent(correctAttempts, attempts),
      masteryPercent: this.percent(
        rows.filter((row) => row.isMastered).length,
        totalQuestionsCount,
      ),
      averageTimeMs: attempts ? Math.round(weightedTime / attempts) : 0,
      lastActivityAt: this.latest(rows.map((row) => row.lastAnsweredAt)),
    };
  }

  private async rebuildDailyAnswerActivityWithTx(
    tx: PrismaTransactionClient,
    userId: string,
    answeredAt: Date,
  ): Promise<void> {
    const date = this.utcDate(answeredAt);
    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 1);
    const answers = await tx.quizAnswer.findMany({
      where: {
        attempt: { userId },
        answeredAt: { gte: date, lt: end },
      },
      select: { isCorrect: true, timeSpentMs: true },
    });
    const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
    const studyMs = answers.reduce(
      (sum, answer) => sum + answer.timeSpentMs,
      0,
    );
    const values = {
      answeredQuestions: answers.length,
      correctAnswers,
      wrongAnswers: answers.length - correctAnswers,
      studyTimeSeconds: Math.ceil(studyMs / 1000),
    };
    await tx.studentDailyActivity.upsert({
      where: { userId_date: { userId, date } },
      update: values,
      create: { userId, date, ...values },
    });
  }

  private percent(numerator: number, denominator: number): number {
    return denominator
      ? Number(Math.min(100, (numerator / denominator) * 100).toFixed(2))
      : 0;
  }

  private latest(values: Array<Date | null>): Date | null {
    const timestamps = values
      .filter((value): value is Date => value !== null)
      .map((value) => value.getTime());
    return timestamps.length ? new Date(Math.max(...timestamps)) : null;
  }

  private utcDate(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private unique(
    rows: QuestionHierarchy[],
    key: 'subjectId' | 'unitId' | 'lessonId',
  ): string[] {
    return [
      ...new Set(
        rows
          .map((row) => row[key])
          .filter((value): value is string => value !== null),
      ),
    ];
  }

  private async serializable<T>(
    operation: (tx: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: 'Serializable',
        });
      } catch (error) {
        if (this.errorCode(error) !== 'P2034' || attempt === 3) throw error;
      }
    }
    throw progressConflict(
      'PROGRESS_REBUILD_FAILED',
      'Progress reconciliation retry failed',
    );
  }

  private errorCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : undefined;
  }
}
