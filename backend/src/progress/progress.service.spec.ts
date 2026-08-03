import { HttpException } from '@nestjs/common';
import { MasteryService } from './mastery.service';
import { ProgressReconciliationService } from './progress-reconciliation.service';
import type { PrismaTransactionClient } from './progress-types';
import { MistakesService } from './mistakes.service';
import { SavedQuestionsService } from './saved-questions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  QuestionDifficulty,
  QuestionOrigin,
  QuestionReviewStatus,
  QuestionType,
} from '../generated/prisma/enums';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const firstAt = new Date('2026-07-18T10:00:00.000Z');
const secondAt = new Date('2026-07-18T10:01:00.000Z');
const question = {
  id: 'question-1',
  subjectId: 'subject-1',
  unitId: 'unit-1',
  lessonId: 'lesson-1',
  sourceId: null,
  readingPassageId: null,
  type: QuestionType.MULTIPLE_CHOICE,
  questionText: 'سؤال آمن',
  questionImageUrl: null,
  correctBoolean: null,
  hintText: 'hint',
  explanationShort: 'secret',
  explanationDetailed: null,
  dangerKeyword: null,
  commonMistake: null,
  difficulty: QuestionDifficulty.EASY,
  reviewStatus: QuestionReviewStatus.READY,
  origin: QuestionOrigin.MANUAL,
  fingerprint: 'secret',
  isTrapQuestion: false,
  isActive: true,
  isPublished: true,
  contentVersion: 1,
  createdById: null,
  reviewedById: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: firstAt,
  updatedAt: firstAt,
  deletedAt: null,
  readingPassage: null,
  options: [
    {
      id: 'option-1',
      questionId: 'question-1',
      optionText: 'أ',
      optionImageUrl: null,
      sortOrder: 0,
      isCorrect: true,
      whyWrong: null,
      createdAt: firstAt,
      updatedAt: firstAt,
    },
  ],
};

const code = (error: unknown) =>
  error instanceof HttpException
    ? (error.getResponse() as { code?: string }).code
    : undefined;

describe('Student progress hardening', () => {
  const mastery = new MasteryService();

  it('requires multiple demonstrated answers before mastery', () => {
    expect(
      mastery.calculate({
        attemptsCount: 1,
        correctCount: 1,
        consecutiveCorrect: 1,
        averageTimeMs: 10000,
        lastAnsweredAt: new Date(),
      }).isMastered,
    ).toBe(false);
    const mastered = mastery.calculate({
      attemptsCount: 3,
      correctCount: 3,
      consecutiveCorrect: 3,
      averageTimeMs: 10000,
      lastAnsweredAt: new Date(),
    });
    expect(mastered.isMastered).toBe(true);
    expect(mastered.masteryScore).toBeLessThanOrEqual(100);
  });

  it('rebuilds counters, sequences, average, selections and timestamps from QuizAnswer', async () => {
    let written:
      | {
          update: {
            attemptsCount: number;
            correctCount: number;
            wrongCount: number;
            consecutiveCorrect: number;
            consecutiveWrong: number;
            averageTimeMs: number;
            lastTimeMs: number;
            lastAnswerCorrect: boolean | null;
            firstAnsweredAt: Date;
            lastAnsweredAt: Date;
            masteredAt: Date | null;
          };
        }
      | undefined;
    const tx = {
      question: {
        findUnique: jest.fn().mockResolvedValue({
          id: question.id,
          subjectId: question.subjectId,
          unitId: question.unitId,
          lessonId: question.lessonId,
        }),
      },
      quizAnswer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'answer-1',
            attemptId: 'attempt-1',
            isCorrect: false,
            timeSpentMs: 2000,
            selectedOptionId: 'wrong',
            selectedBoolean: null,
            answeredAt: firstAt,
          },
          {
            id: 'answer-2',
            attemptId: 'attempt-2',
            isCorrect: true,
            timeSpentMs: 4000,
            selectedOptionId: 'option-1',
            selectedBoolean: null,
            answeredAt: secondAt,
          },
        ]),
      },
      studentQuestionProgress: {
        findUnique: jest.fn().mockResolvedValue({
          masteredAt: null,
          manualReviewedAt: firstAt,
        }),
        upsert: jest
          .fn()
          .mockImplementation((input: NonNullable<typeof written>) => {
            written = input;
            return Promise.resolve({});
          }),
        deleteMany: jest.fn(),
      },
    };
    const reconciliation = new ProgressReconciliationService(
      {} as PrismaService,
      mastery,
    );
    await reconciliation.rebuildQuestionProgressWithTx(
      tx as unknown as PrismaTransactionClient,
      'user-1',
      question.id,
    );
    expect(written?.update).toMatchObject({
      attemptsCount: 2,
      correctCount: 1,
      wrongCount: 1,
      consecutiveCorrect: 1,
      consecutiveWrong: 0,
      averageTimeMs: 3000,
      lastTimeMs: 4000,
      lastAnswerCorrect: true,
      firstAnsweredAt: firstAt,
      lastAnsweredAt: secondAt,
    });
  });

  it('is idempotent because a rebuild writes the same source-derived values', async () => {
    const writes: number[] = [];
    const tx = {
      question: {
        findUnique: jest.fn().mockResolvedValue({
          id: question.id,
          subjectId: question.subjectId,
          unitId: null,
          lessonId: null,
        }),
      },
      quizAnswer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'answer-1',
            attemptId: 'attempt-1',
            isCorrect: true,
            timeSpentMs: 1000,
            selectedOptionId: 'option-1',
            selectedBoolean: null,
            answeredAt: firstAt,
          },
        ]),
      },
      studentQuestionProgress: {
        findUnique: jest.fn().mockResolvedValue({
          masteredAt: null,
          manualReviewedAt: null,
        }),
        upsert: jest
          .fn()
          .mockImplementation(
            (input: { update: { attemptsCount: number } }) => {
              writes.push(input.update.attemptsCount);
              return Promise.resolve({});
            },
          ),
        deleteMany: jest.fn(),
      },
    };
    const reconciliation = new ProgressReconciliationService(
      {} as PrismaService,
      mastery,
    );
    await reconciliation.rebuildQuestionProgressWithTx(
      tx as unknown as PrismaTransactionClient,
      'user-1',
      question.id,
    );
    await reconciliation.rebuildQuestionProgressWithTx(
      tx as unknown as PrismaTransactionClient,
      'user-1',
      question.id,
    );
    expect(writes).toEqual([1, 1]);
  });

  it('rejects progress input that does not match the persisted answer', async () => {
    const tx = {
      question: { findUnique: jest.fn().mockResolvedValue(question) },
      quizAnswer: { findMany: jest.fn().mockResolvedValue([]) },
      studentQuestionProgress: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const reconciliation = new ProgressReconciliationService(
      {} as PrismaService,
      mastery,
    );
    await reconciliation
      .rebuildQuestionProgressWithTx(
        tx as unknown as PrismaTransactionClient,
        'user-1',
        question.id,
        {
          userId: 'user-1',
          questionId: question.id,
          attemptId: 'attempt-1',
          quizAnswerId: 'missing',
          isCorrect: true,
          timeSpentMs: 1,
          answeredAt: firstAt,
        },
      )
      .catch((error) => expect(code(error)).toBe('PROGRESS_UPDATE_CONFLICT'));
  });

  it('defines hierarchy counters from distinct current question states', async () => {
    let aggregate:
      | {
          update: {
            answeredQuestions: number;
            correctAnswers: number;
            wrongAnswers: number;
            accuracyPercent: number;
            masteryPercent: number;
            averageTimeMs: number;
          };
        }
      | undefined;
    const tx = {
      studentQuestionProgress: {
        findMany: jest.fn().mockResolvedValue([
          {
            attemptsCount: 2,
            correctCount: 1,
            averageTimeMs: 3000,
            lastAnswerCorrect: false,
            isMastered: false,
            lastAnsweredAt: firstAt,
          },
          {
            attemptsCount: 3,
            correctCount: 3,
            averageTimeMs: 1000,
            lastAnswerCorrect: true,
            isMastered: true,
            lastAnsweredAt: secondAt,
          },
        ]),
      },
      question: { count: jest.fn().mockResolvedValue(4) },
      studentLessonProgress: {
        upsert: jest
          .fn()
          .mockImplementation((input: NonNullable<typeof aggregate>) => {
            aggregate = input;
            return Promise.resolve({});
          }),
      },
    };
    const reconciliation = new ProgressReconciliationService(
      {} as PrismaService,
      mastery,
    );
    await reconciliation.rebuildLessonProgressWithTx(
      tx as unknown as PrismaTransactionClient,
      'user-1',
      'lesson-1',
    );
    expect(aggregate?.update).toMatchObject({
      answeredQuestions: 2,
      correctAnswers: 1,
      wrongAnswers: 1,
      accuracyPercent: 80,
      masteryPercent: 25,
      averageTimeMs: 1800,
    });
  });

  it('keeps manual review separate from demonstrated mastery', async () => {
    const prisma = {
      studentQuestionProgress: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'progress-1',
          isMastered: false,
          manualReviewedAt: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new MistakesService(prisma as unknown as PrismaService);
    const result = await service.markReviewed('user-1', question.id);
    expect(result.isMastered).toBe(false);
    expect(result.reviewStatus).toBe('REVIEWED');
  });

  it('returns mistake detail without solution or reviewer fields', async () => {
    const prisma = {
      studentQuestionProgress: {
        findFirst: jest.fn().mockResolvedValue({
          ...{
            attemptsCount: 1,
            correctCount: 0,
            wrongCount: 1,
            consecutiveWrong: 1,
            masteryScore: 10,
            isMastered: false,
            manualReviewedAt: null,
            lastAnsweredAt: firstAt,
            lastTimeMs: 2000,
          },
          question,
        }),
      },
    };
    const result = await new MistakesService(
      prisma as unknown as PrismaService,
    ).get('user-1', question.id);
    expect(result.question).not.toHaveProperty('correctBoolean');
    expect(result.question).not.toHaveProperty('fingerprint');
    expect(result.question.options[0]).not.toHaveProperty('isCorrect');
  });

  it('derives saved hierarchy and returns a safe mapped record', async () => {
    let create:
      | {
          create: {
            userId: string;
            questionId: string;
            subjectId: string;
            unitId: string | null;
            lessonId: string | null;
          };
        }
      | undefined;
    const savedAt = new Date();
    const prisma = {
      question: {
        findFirst: jest.fn().mockResolvedValue({
          id: question.id,
          subjectId: question.subjectId,
          unitId: question.unitId,
          lessonId: question.lessonId,
        }),
      },
      savedQuestion: {
        upsert: jest
          .fn()
          .mockImplementation((input: NonNullable<typeof create>) => {
            create = input;
            return Promise.resolve({});
          }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'saved-1',
          note: 'مراجعة',
          createdAt: savedAt,
          updatedAt: savedAt,
          question,
        }),
      },
    };
    const result = await new SavedQuestionsService(
      prisma as unknown as PrismaService,
    ).save('user-1', question.id, { note: 'مراجعة' });
    expect(create?.create).toMatchObject({
      userId: 'user-1',
      questionId: question.id,
      subjectId: question.subjectId,
      unitId: question.unitId,
      lessonId: question.lessonId,
    });
    expect(result).not.toHaveProperty('userId');
    expect(result.question.options[0]).not.toHaveProperty('isCorrect');
  });

  it('deletes saved questions idempotently without deleting Question', async () => {
    const prisma = {
      savedQuestion: {
        deleteMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
    };
    const service = new SavedQuestionsService(
      prisma as unknown as PrismaService,
    );
    expect(await service.remove('user-1', question.id)).toEqual({
      questionId: question.id,
      removed: true,
    });
    expect(await service.remove('user-1', question.id)).toEqual({
      questionId: question.id,
      removed: false,
    });
  });
});
