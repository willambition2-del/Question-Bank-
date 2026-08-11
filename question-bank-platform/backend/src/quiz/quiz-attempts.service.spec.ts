import { HttpException } from '@nestjs/common';
import {
  ExplanationMode,
  QuestionDifficulty,
  QuestionOrigin,
  QuestionReviewStatus,
  QuestionType,
  QuizAttemptStatus,
  QuizScope,
  QuizTimingMode,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationEventsService } from '../gamification/gamification-events.service';
import { StudentProgressService } from '../progress/student-progress.service';
import { QuestionSelectionService } from './question-selection.service';
import { QuizAttemptsService } from './quiz-attempts.service';
import { QuizScoringService } from './quiz-scoring.service';
import { QuizScopeValidator } from './quiz-scope.validator';
import { createQuizSnapshot } from './quiz-snapshot';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-07-18T00:00:00.000Z');
const userId = '90000000-0000-4000-8000-000000000001';
const attemptId = '90000000-0000-4000-8000-000000000002';
const questionId = '90000000-0000-4000-8000-000000000003';
const correctOptionId = '90000000-0000-4000-8000-000000000004';
const wrongOptionId = '90000000-0000-4000-8000-000000000005';
const question = {
  id: questionId,
  subjectId: '90000000-0000-4000-8000-000000000006',
  unitId: null,
  lessonId: null,
  sourceId: null,
  readingPassageId: null,
  type: QuestionType.MULTIPLE_CHOICE,
  questionText: 'Secure question?',
  questionImageUrl: null,
  correctBoolean: null,
  hintText: 'Hint',
  explanationShort: 'Explanation',
  explanationDetailed: null,
  dangerKeyword: null,
  commonMistake: null,
  difficulty: QuestionDifficulty.EASY,
  reviewStatus: QuestionReviewStatus.READY,
  origin: QuestionOrigin.MANUAL,
  fingerprint: 'fingerprint',
  isTrapQuestion: false,
  isActive: true,
  isPublished: true,
  contentVersion: 1,
  createdById: null,
  reviewedById: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  readingPassage: null,
  options: [
    {
      id: correctOptionId,
      questionId,
      optionText: 'Correct',
      optionImageUrl: null,
      sortOrder: 0,
      isCorrect: true,
      whyWrong: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: wrongOptionId,
      questionId,
      optionText: 'Wrong',
      optionImageUrl: null,
      sortOrder: 1,
      isCorrect: false,
      whyWrong: 'Wrong reason',
      createdAt: now,
      updatedAt: now,
    },
  ],
};
const snapshot = createQuizSnapshot(question);
const settings = (mode = ExplanationMode.AFTER_EACH) => ({
  requestedQuestionCount: 2,
  difficulty: QuestionDifficulty.MIXED,
  timingMode: QuizTimingMode.NONE,
  heartsEnabled: true,
  hintsEnabled: true,
  eliminationEnabled: false,
  explanationMode: mode,
  excludeMastered: false,
  unansweredOnly: false,
});
const attempt = (overrides: Record<string, unknown> = {}) => ({
  id: attemptId,
  userId,
  scope: QuizScope.SUBJECT,
  subjectId: question.subjectId,
  unitId: null,
  lessonId: null,
  examModelId: null,
  status: QuizAttemptStatus.IN_PROGRESS,
  questionCount: 2,
  correctCount: 0,
  wrongCount: 0,
  unansweredCount: 2,
  scorePercent: 0,
  pointsEarned: 0,
  heartsRemaining: 3,
  startedAt: now,
  completedAt: null,
  expiresAt: null,
  lastActivityAt: new Date(),
  settings: settings(),
  createdAt: now,
  updatedAt: now,
  ...overrides,
});
const answerDto = {
  questionId,
  selectedOptionId: correctOptionId,
  timeSpentMs: 1000,
  hintUsed: false,
  eliminatedOptionUsed: false,
};
const errorCode = (error: unknown) =>
  error instanceof HttpException
    ? (error.getResponse() as { code?: string }).code
    : undefined;

describe('QuizAttemptsService hardening', () => {
  const tx = {
    quizAttempt: {
      create: jest.fn<
        (args: {
          data: {
            questions: { create: Array<{ snapshot: typeof snapshot }> };
          };
        }) => Promise<unknown>
      >(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    quizAnswer: { create: jest.fn(), findMany: jest.fn() },
  };
  const prisma = {
    quizAttempt: {
      findFirst: jest.fn(),
      updateMany:
        jest.fn<
          (args: {
            data: { status: QuizAttemptStatus };
          }) => Promise<{ count: number }>
        >(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const selection = { select: jest.fn() };
  const scopeValidator = { validate: jest.fn() };
  const progress = {
    recordQuestionAnswer: jest.fn(),
    recordQuizCompleted: jest.fn(),
  };
  const gamification = { answer: jest.fn(), quizCompleted: jest.fn() };
  let service: QuizAttemptsService;

  beforeEach(() => {
    jest.clearAllMocks();
    scopeValidator.validate.mockResolvedValue({
      subjectId: question.subjectId,
    });
    prisma.$transaction.mockImplementation(async (input: unknown) =>
      typeof input === 'function'
        ? (input as (client: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(input as Promise<unknown>[]),
    );
    service = new QuizAttemptsService(
      prisma as unknown as PrismaService,
      selection as unknown as QuestionSelectionService,
      scopeValidator as unknown as QuizScopeValidator,
      new QuizScoringService(),
      progress as unknown as StudentProgressService,
      gamification as unknown as GamificationEventsService,
    );
  });

  it('creates transactionally with an internal snapshot and safe response', async () => {
    selection.select.mockResolvedValue([{ question }]);
    let createInput:
      | {
          data: {
            questions: { create: Array<{ snapshot: typeof snapshot }> };
          };
        }
      | undefined;
    tx.quizAttempt.create.mockImplementation(
      (args: NonNullable<typeof createInput>) => {
        createInput = args;
        return Promise.resolve(
          attempt({
            questionCount: 1,
            unansweredCount: 1,
            heartsRemaining: null,
            settings: {
              ...settings(),
              requestedQuestionCount: 3,
              heartsEnabled: false,
            },
          }),
        );
      },
    );
    const result = await service.create(userId, {
      scope: QuizScope.SUBJECT,
      subjectId: question.subjectId,
      questionCount: 3,
      difficulty: QuestionDifficulty.MIXED,
      timingMode: QuizTimingMode.NONE,
      heartsEnabled: false,
      initialHearts: 3,
      hintsEnabled: true,
      eliminationEnabled: false,
      explanationMode: ExplanationMode.AFTER_EACH,
      excludeMastered: false,
      unansweredOnly: false,
    });
    expect(result.availability).toMatchObject({
      actualQuestionCount: 1,
      shortageCount: 2,
      warningCode: 'INSUFFICIENT_QUESTIONS',
    });
    expect(result.questions[0]).not.toHaveProperty('correctBoolean');
    expect(result.questions[0].options[0]).not.toHaveProperty('isCorrect');
    expect(createInput).toBeDefined();
    expect(
      createInput?.data.questions.create[0].snapshot.options[0].isCorrect,
    ).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects an attempt when no questions exist', async () => {
    selection.select.mockResolvedValue([]);
    await service
      .create(userId, {
        scope: QuizScope.SUBJECT,
        subjectId: question.subjectId,
        questionCount: 1,
        difficulty: QuestionDifficulty.MIXED,
        timingMode: QuizTimingMode.NONE,
        heartsEnabled: false,
        initialHearts: 3,
        hintsEnabled: true,
        eliminationEnabled: false,
        explanationMode: ExplanationMode.AFTER_EACH,
        excludeMastered: false,
        unansweredOnly: false,
      })
      .catch((error) =>
        expect(errorCode(error)).toBe('INSUFFICIENT_QUESTIONS'),
      );
  });

  it('evaluates from the immutable snapshot and updates integrations once', async () => {
    prisma.quizAttempt.findFirst
      .mockResolvedValueOnce({
        ...attempt(),
        answers: [],
        questions: [{ snapshot }],
      })
      .mockResolvedValueOnce(attempt());
    tx.quizAttempt.findFirst.mockResolvedValue({
      ...attempt(),
      answers: [],
      questions: [{ snapshot }],
    });
    tx.quizAnswer.create.mockResolvedValue({
      id: 'answer',
      attemptId,
      questionId,
      selectedOptionId: correctOptionId,
      selectedBoolean: null,
      isCorrect: true,
      timeSpentMs: 1000,
      hintUsed: false,
      eliminatedOptionUsed: false,
      pointsEarned: 15,
      answeredAt: now,
    });
    tx.quizAttempt.update.mockResolvedValue(
      attempt({ correctCount: 1, unansweredCount: 1, pointsEarned: 15 }),
    );
    const result = await service.answer(userId, attemptId, answerDto);
    expect(result).toMatchObject({
      accepted: true,
      isCorrect: true,
      correctAnswer: { optionId: correctOptionId },
    });
    expect(progress.recordQuestionAnswer).toHaveBeenCalledTimes(1);
    expect(gamification.answer).toHaveBeenCalledTimes(1);
  });

  it('returns an identical retry without writing progress again', async () => {
    const saved = {
      id: 'answer',
      attemptId,
      questionId,
      selectedOptionId: correctOptionId,
      selectedBoolean: null,
      isCorrect: true,
      timeSpentMs: 1000,
      hintUsed: false,
      eliminatedOptionUsed: false,
      pointsEarned: 10,
      answeredAt: now,
    };
    prisma.quizAttempt.findFirst.mockResolvedValue({
      ...attempt({ correctCount: 1, unansweredCount: 1 }),
      answers: [saved],
      questions: [{ snapshot }],
    });
    const result = await service.answer(userId, attemptId, answerDto);
    expect(result.accepted).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(progress.recordQuestionAnswer).not.toHaveBeenCalled();
  });

  it('rejects a conflicting retry with a stable conflict code', async () => {
    const saved = {
      id: 'answer',
      attemptId,
      questionId,
      selectedOptionId: correctOptionId,
      selectedBoolean: null,
      isCorrect: true,
      timeSpentMs: 1000,
      hintUsed: false,
      eliminatedOptionUsed: false,
      pointsEarned: 10,
      answeredAt: now,
    };
    prisma.quizAttempt.findFirst.mockResolvedValue({
      ...attempt(),
      answers: [saved],
      questions: [{ snapshot }],
    });
    await service
      .answer(userId, attemptId, {
        ...answerDto,
        selectedOptionId: wrongOptionId,
      })
      .catch((error) =>
        expect(errorCode(error)).toBe('QUESTION_ALREADY_ANSWERED'),
      );
  });

  it('does not reveal correctness in AT_END mode', async () => {
    const atEnd = attempt({ settings: settings(ExplanationMode.AT_END) });
    prisma.quizAttempt.findFirst
      .mockResolvedValueOnce({
        ...atEnd,
        answers: [],
        questions: [{ snapshot }],
      })
      .mockResolvedValueOnce(atEnd);
    tx.quizAttempt.findFirst.mockResolvedValue({
      ...atEnd,
      answers: [],
      questions: [{ snapshot }],
    });
    tx.quizAnswer.create.mockResolvedValue({
      id: 'answer',
      attemptId,
      questionId,
      selectedOptionId: wrongOptionId,
      selectedBoolean: null,
      isCorrect: false,
      timeSpentMs: 1000,
      hintUsed: false,
      eliminatedOptionUsed: false,
      pointsEarned: 0,
      answeredAt: now,
    });
    tx.quizAttempt.update.mockResolvedValue(
      attempt({
        settings: settings(ExplanationMode.AT_END),
        wrongCount: 1,
        unansweredCount: 1,
        heartsRemaining: 2,
      }),
    );
    const result = await service.answer(userId, attemptId, {
      ...answerDto,
      selectedOptionId: wrongOptionId,
    });
    expect(result).not.toHaveProperty('isCorrect');
    expect(result.correctAnswer).toBeNull();
  });

  it('marks server-expired attempts and rejects answers', async () => {
    const expired = attempt({
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    prisma.quizAttempt.findFirst
      .mockResolvedValueOnce({
        ...expired,
        answers: [],
        questions: [{ snapshot }],
      })
      .mockResolvedValueOnce(expired);
    let expirationUpdate: { data: { status: QuizAttemptStatus } } | undefined;
    prisma.quizAttempt.updateMany.mockImplementation(
      (args: NonNullable<typeof expirationUpdate>) => {
        expirationUpdate = args;
        return Promise.resolve({ count: 1 });
      },
    );
    await service
      .answer(userId, attemptId, answerDto)
      .catch((error) => expect(errorCode(error)).toBe('QUIZ_ATTEMPT_EXPIRED'));
    expect(expirationUpdate?.data.status).toBe(QuizAttemptStatus.EXPIRED);
  });

  it('returns completed attempts idempotently without another reward', async () => {
    prisma.quizAttempt.findFirst.mockResolvedValue(
      attempt({ status: QuizAttemptStatus.COMPLETED, completedAt: now }),
    );
    const result = await service.complete(userId, attemptId);
    expect(result.status).toBe(QuizAttemptStatus.COMPLETED);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(gamification.quizCompleted).not.toHaveBeenCalled();
  });

  it('completes transactionally and reaches progress and gamification', async () => {
    prisma.quizAttempt.findFirst.mockResolvedValue(attempt());
    tx.quizAttempt.findFirst
      .mockResolvedValueOnce(attempt())
      .mockResolvedValueOnce(
        attempt({
          status: QuizAttemptStatus.COMPLETED,
          completedAt: now,
          correctCount: 1,
          wrongCount: 0,
          unansweredCount: 1,
          pointsEarned: 30,
        }),
      );
    tx.quizAnswer.findMany.mockResolvedValue([
      { isCorrect: true, pointsEarned: 10 },
    ]);
    tx.quizAttempt.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.complete(userId, attemptId);
    expect(result.status).toBe(QuizAttemptStatus.COMPLETED);
    expect(progress.recordQuizCompleted).toHaveBeenCalledTimes(1);
    expect(gamification.quizCompleted).toHaveBeenCalledTimes(1);
  });

  it('keeps ownership fail-closed', async () => {
    prisma.quizAttempt.findFirst.mockResolvedValue(null);
    await expect(
      service.complete('another-user', attemptId),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.quizAttempt.findFirst).toHaveBeenCalledWith({
      where: { id: attemptId, userId: 'another-user' },
    });
  });

  it('abandons idempotently and never awards completion points', async () => {
    prisma.quizAttempt.findFirst.mockResolvedValue(
      attempt({ status: QuizAttemptStatus.ABANDONED, completedAt: now }),
    );
    const result = await service.abandon(userId, attemptId);
    expect(result.status).toBe(QuizAttemptStatus.ABANDONED);
    expect(gamification.quizCompleted).not.toHaveBeenCalled();
  });
});

describe('QuizScoringService', () => {
  const scoring = new QuizScoringService();
  it('awards normal, fast, and difficulty-adjusted points within the cap', () => {
    expect(
      scoring.score({
        isCorrect: true,
        difficulty: QuestionDifficulty.EASY,
        serverElapsedMs: 20_000,
        hintUsed: false,
        eliminatedOptionUsed: false,
      }).points,
    ).toBe(10);
    expect(
      scoring.score({
        isCorrect: true,
        difficulty: QuestionDifficulty.EASY,
        serverElapsedMs: 5_000,
        hintUsed: false,
        eliminatedOptionUsed: false,
      }).points,
    ).toBe(15);
    expect(
      scoring.score({
        isCorrect: true,
        difficulty: QuestionDifficulty.HARD,
        serverElapsedMs: 5_000,
        hintUsed: false,
        eliminatedOptionUsed: false,
      }).points,
    ).toBeLessThanOrEqual(20);
  });
  it('applies hint/elimination penalties and never returns negative points', () => {
    expect(
      scoring.score({
        isCorrect: true,
        difficulty: QuestionDifficulty.EASY,
        serverElapsedMs: 20_000,
        hintUsed: true,
        eliminatedOptionUsed: true,
      }).points,
    ).toBe(5);
    expect(
      scoring.score({
        isCorrect: false,
        difficulty: QuestionDifficulty.HARD,
        serverElapsedMs: 1,
        hintUsed: false,
        eliminatedOptionUsed: false,
      }).points,
    ).toBe(0);
  });
});
