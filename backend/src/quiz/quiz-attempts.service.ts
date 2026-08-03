import { Injectable } from '@nestjs/common';
import type { Prisma, QuizAnswer } from '../generated/prisma/client';
import {
  ExplanationMode,
  QuestionType,
  QuizAttemptStatus,
  QuizScope,
  QuizTimingMode,
} from '../generated/prisma/enums';
import { createPageMeta } from '../common/pagination/pagination';
import { GamificationEventsService } from '../gamification/gamification-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentProgressService } from '../progress/student-progress.service';
import {
  CreateQuizAttemptDto,
  QuizAttemptQueryDto,
  SubmitQuizAnswerDto,
} from './dto/quiz.dto';
import { quizBadRequest, quizConflict, quizNotFound } from './quiz-errors';
import { QuestionSelectionService } from './question-selection.service';
import {
  QUIZ_COMPLETION_POINTS,
  QuizScoringService,
} from './quiz-scoring.service';
import { QuizScopeValidator } from './quiz-scope.validator';
import {
  QuizQuestionSnapshot,
  createQuizSnapshot,
  parseQuizSnapshot,
  toAnsweredSnapshot,
  toStudentSnapshot,
} from './quiz-snapshot';

type CompletionReason = 'MANUAL' | 'ALL_QUESTIONS_ANSWERED' | 'HEARTS_DEPLETED';

type AttemptSettings = {
  requestedQuestionCount: number;
  questionTypes?: QuestionType[];
  difficulty: string;
  timingMode: QuizTimingMode;
  durationSeconds?: number;
  timePerQuestionSeconds?: number;
  heartsEnabled: boolean;
  hintsEnabled: boolean;
  eliminationEnabled: boolean;
  explanationMode: ExplanationMode;
  excludeMastered: boolean;
  unansweredOnly: boolean;
  completionReason?: CompletionReason;
};

type AttemptRecord = {
  id: string;
  userId: string;
  scope: QuizScope;
  status: QuizAttemptStatus;
  subjectId: string | null;
  unitId: string | null;
  lessonId: string | null;
  examModelId: string | null;
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  scorePercent: unknown;
  pointsEarned: number;
  heartsRemaining: number | null;
  startedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  lastActivityAt: Date;
  settings: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class QuizAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly selection: QuestionSelectionService,
    private readonly scopeValidator: QuizScopeValidator,
    private readonly scoring: QuizScoringService,
    private readonly progress: StudentProgressService,
    private readonly gamification: GamificationEventsService,
  ) {}

  async create(userId: string, dto: CreateQuizAttemptDto) {
    this.validateSettings(dto);
    const resolved = await this.scopeValidator.validate(dto);
    const normalized = { ...dto, ...resolved };
    const selected = await this.selection.select(userId, normalized);
    if (!selected.length) {
      throw quizBadRequest(
        'INSUFFICIENT_QUESTIONS',
        'No eligible published questions are available',
      );
    }
    const now = new Date();
    const expiresAt =
      dto.timingMode === QuizTimingMode.TOTAL_TIME && dto.durationSeconds
        ? new Date(now.getTime() + dto.durationSeconds * 1000)
        : null;
    const settings: AttemptSettings = {
      requestedQuestionCount: dto.questionCount,
      questionTypes: dto.questionTypes,
      difficulty: dto.difficulty,
      timingMode: dto.timingMode,
      durationSeconds: dto.durationSeconds,
      timePerQuestionSeconds: dto.timePerQuestionSeconds,
      heartsEnabled: dto.heartsEnabled,
      hintsEnabled: dto.hintsEnabled,
      eliminationEnabled: dto.eliminationEnabled,
      explanationMode: dto.explanationMode,
      excludeMastered: dto.excludeMastered,
      unansweredOnly: dto.unansweredOnly,
    };
    const snapshots = selected.map(({ question }) =>
      createQuizSnapshot(question),
    );
    const attempt = await this.prisma.$transaction((tx) =>
      tx.quizAttempt.create({
        data: {
          userId,
          scope: dto.scope,
          subjectId: resolved.subjectId,
          unitId: resolved.unitId,
          lessonId: resolved.lessonId,
          examModelId: resolved.examModelId,
          status: QuizAttemptStatus.IN_PROGRESS,
          questionCount: snapshots.length,
          unansweredCount: snapshots.length,
          heartsRemaining: dto.heartsEnabled ? dto.initialHearts : null,
          startedAt: now,
          lastActivityAt: now,
          expiresAt,
          settings,
          questions: {
            create: snapshots.map((snapshot, sortOrder) => ({
              questionId: snapshot.id,
              sortOrder,
              snapshot,
            })),
          },
        },
      }),
    );
    const shortageCount = Math.max(0, dto.questionCount - snapshots.length);
    return {
      attempt: this.toAttempt(attempt),
      questions: snapshots.map(toStudentSnapshot),
      availability: {
        requestedQuestionCount: dto.questionCount,
        actualQuestionCount: snapshots.length,
        shortageCount,
        warningCode: shortageCount ? 'INSUFFICIENT_QUESTIONS' : null,
      },
    };
  }

  async answer(userId: string, attemptId: string, dto: SubmitQuizAnswerDto) {
    const retry = await this.findExistingAnswer(
      userId,
      attemptId,
      dto.questionId,
    );
    if (retry)
      return this.resolveRetry(
        retry.attempt,
        retry.answer,
        retry.snapshot,
        dto,
      );
    await this.ensureAnswerable(userId, attemptId);
    try {
      return await this.serializable(async (tx) => {
        const attempt = await tx.quizAttempt.findFirst({
          where: { id: attemptId, userId },
          include: {
            questions: {
              where: { questionId: dto.questionId },
              select: { snapshot: true },
            },
            answers: { where: { questionId: dto.questionId } },
          },
        });
        if (!attempt) throw quizNotFound();
        const relation = attempt.questions[0];
        if (!relation) {
          throw quizBadRequest(
            'QUIZ_QUESTION_NOT_IN_ATTEMPT',
            'Question is not part of this attempt',
          );
        }
        const snapshot = parseQuizSnapshot(relation.snapshot);
        const existing = attempt.answers[0];
        if (existing)
          return this.resolveRetry(attempt, existing, snapshot, dto);
        if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
          throw quizBadRequest(
            'QUIZ_ATTEMPT_NOT_ACTIVE',
            'Quiz attempt is not active',
          );
        }
        const settings = this.settings(attempt.settings);
        this.validateAnswerFeatures(snapshot, settings, dto);
        const evaluation = this.evaluateAnswer(snapshot, dto);
        const now = new Date();
        const serverElapsedMs = Math.max(
          0,
          now.getTime() - attempt.lastActivityAt.getTime(),
        );
        const score = this.scoring.score({
          isCorrect: evaluation.isCorrect,
          difficulty: snapshot.difficulty,
          serverElapsedMs,
          hintUsed: dto.hintUsed,
          eliminatedOptionUsed: dto.eliminatedOptionUsed,
        });
        const heartsRemaining =
          attempt.heartsRemaining === null
            ? null
            : Math.max(
                0,
                attempt.heartsRemaining - (evaluation.isCorrect ? 0 : 1),
              );
        const answer = await tx.quizAnswer.create({
          data: {
            attemptId,
            questionId: snapshot.id,
            selectedOptionId: dto.selectedOptionId ?? null,
            selectedBoolean: dto.selectedBoolean ?? null,
            isCorrect: evaluation.isCorrect,
            timeSpentMs: dto.timeSpentMs,
            hintUsed: dto.hintUsed,
            eliminatedOptionUsed: dto.eliminatedOptionUsed,
            pointsEarned: score.points,
            answeredAt: now,
          },
        });
        await this.progress.recordQuestionAnswer(tx, {
          userId,
          questionId: snapshot.id,
          attemptId,
          quizAnswerId: answer.id,
          isCorrect: answer.isCorrect,
          timeSpentMs: answer.timeSpentMs,
          selectedOptionId: answer.selectedOptionId,
          selectedBoolean: answer.selectedBoolean,
          answeredAt: answer.answeredAt,
        });
        await this.gamification.answer(
          tx,
          userId,
          attemptId,
          snapshot.id,
          evaluation.isCorrect,
          score,
        );
        let updated: AttemptRecord = await tx.quizAttempt.update({
          where: { id: attemptId },
          data: {
            correctCount: evaluation.isCorrect ? { increment: 1 } : undefined,
            wrongCount: evaluation.isCorrect ? undefined : { increment: 1 },
            unansweredCount: { decrement: 1 },
            pointsEarned: { increment: score.points },
            heartsRemaining,
            lastActivityAt: now,
          },
        });
        const reason =
          updated.unansweredCount === 0
            ? 'ALL_QUESTIONS_ANSWERED'
            : settings.heartsEnabled && updated.heartsRemaining === 0
              ? 'HEARTS_DEPLETED'
              : null;
        if (reason)
          updated = await this.completeInTransaction(
            tx,
            userId,
            attemptId,
            reason,
          );
        return this.answerResponse(updated, answer, snapshot, settings);
      });
    } catch (error) {
      if (this.errorCode(error) === 'P2002') {
        const existing = await this.findExistingAnswer(
          userId,
          attemptId,
          dto.questionId,
        );
        if (existing)
          return this.resolveRetry(
            existing.attempt,
            existing.answer,
            existing.snapshot,
            dto,
          );
        throw quizConflict(
          'QUESTION_ALREADY_ANSWERED',
          'Question has already been answered',
        );
      }
      throw error;
    }
  }

  async complete(userId: string, id: string) {
    const current = await this.findOwned(id, userId);
    if (current.status === QuizAttemptStatus.COMPLETED)
      return this.toAttempt(current);
    await this.ensureNotExpired(current);
    return this.toAttempt(
      await this.serializable((tx) =>
        this.completeInTransaction(tx, userId, id, 'MANUAL'),
      ),
    );
  }

  async abandon(userId: string, id: string) {
    const attempt = await this.findOwned(id, userId);
    if (attempt.status === QuizAttemptStatus.ABANDONED)
      return this.toAttempt(attempt);
    if (attempt.status === QuizAttemptStatus.COMPLETED) {
      throw quizConflict(
        'QUIZ_ATTEMPT_ALREADY_COMPLETED',
        'A completed attempt cannot be abandoned',
      );
    }
    if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
      throw quizBadRequest(
        'QUIZ_ATTEMPT_NOT_ACTIVE',
        'Quiz attempt is not active',
      );
    }
    const now = new Date();
    const result = await this.prisma.quizAttempt.updateMany({
      where: { id, userId, status: QuizAttemptStatus.IN_PROGRESS },
      data: {
        status: QuizAttemptStatus.ABANDONED,
        unansweredCount: Math.max(
          0,
          attempt.questionCount - attempt.correctCount - attempt.wrongCount,
        ),
        completedAt: now,
        lastActivityAt: now,
      },
    });
    if (!result.count) return this.toAttempt(await this.findOwned(id, userId));
    return this.toAttempt(await this.findOwned(id, userId));
  }

  async list(userId: string, query: QuizAttemptQueryDto) {
    const where: Prisma.QuizAttemptWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.quizAttempt.findMany({
        where,
        orderBy: this.historyOrder(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.quizAttempt.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toAttempt(item)),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async get(userId: string, id: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id, userId },
      include: {
        questions: {
          select: { questionId: true, sortOrder: true, snapshot: true },
          orderBy: { sortOrder: 'asc' },
        },
        answers: true,
      },
    });
    if (!attempt) throw quizNotFound();
    const answers = new Map(
      attempt.answers.map((answer) => [answer.questionId, answer]),
    );
    const settings = this.settings(attempt.settings);
    return {
      attempt: this.toAttempt(attempt),
      questions: attempt.questions.map((item) => {
        const snapshot = parseQuizSnapshot(item.snapshot);
        const answer = answers.get(item.questionId);
        const reveal =
          Boolean(answer) &&
          settings.explanationMode === ExplanationMode.AFTER_EACH;
        return {
          ...(reveal
            ? toAnsweredSnapshot(snapshot)
            : toStudentSnapshot(snapshot)),
          answered: Boolean(answer),
          ...(answer
            ? {
                selectedOptionId: answer.selectedOptionId,
                selectedBoolean: answer.selectedBoolean,
              }
            : {}),
        };
      }),
    };
  }

  async result(userId: string, id: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id, userId },
      include: {
        questions: {
          select: { questionId: true, sortOrder: true, snapshot: true },
          orderBy: { sortOrder: 'asc' },
        },
        answers: true,
      },
    });
    if (!attempt) throw quizNotFound();
    if (
      attempt.status === QuizAttemptStatus.IN_PROGRESS ||
      attempt.status === QuizAttemptStatus.CREATED
    ) {
      throw quizBadRequest(
        'QUIZ_RESULT_NOT_AVAILABLE',
        'Result is not available before the attempt ends',
      );
    }
    const settings = this.settings(attempt.settings);
    const reveal = settings.explanationMode !== ExplanationMode.DISABLED;
    const answers = new Map(
      attempt.answers.map((answer) => [answer.questionId, answer]),
    );
    const questions = attempt.questions.map((item) => {
      const snapshot = parseQuizSnapshot(item.snapshot);
      const answer = answers.get(item.questionId);
      return {
        snapshot,
        answer,
        response: {
          ...(reveal
            ? toAnsweredSnapshot(snapshot)
            : toStudentSnapshot(snapshot)),
          answered: Boolean(answer),
          selectedOptionId: answer?.selectedOptionId ?? null,
          selectedBoolean: answer?.selectedBoolean ?? null,
          ...(reveal ? { isCorrect: answer?.isCorrect ?? null } : {}),
          pointsEarned: answer?.pointsEarned ?? 0,
          timeSpentMs: answer?.timeSpentMs ?? null,
        },
      };
    });
    const wrong = questions.filter((item) => item.answer?.isCorrect === false);
    const unanswered = questions.filter((item) => !item.answer);
    const difficultyBreakdown = this.breakdown(
      questions,
      (item) => item.snapshot.difficulty,
    );
    const questionTypeBreakdown = this.breakdown(
      questions,
      (item) => item.snapshot.type,
    );
    return {
      summary: {
        ...this.toAttempt(attempt),
        answeredCount: attempt.answers.length,
        durationSeconds: Math.max(
          0,
          Math.round(
            ((attempt.completedAt ?? new Date()).getTime() -
              attempt.startedAt.getTime()) /
              1000,
          ),
        ),
      },
      breakdowns: {
        subject: attempt.subjectId
          ? [
              {
                id: attempt.subjectId,
                correct: attempt.correctCount,
                wrong: attempt.wrongCount,
              },
            ]
          : [],
        unit: attempt.unitId
          ? [
              {
                id: attempt.unitId,
                correct: attempt.correctCount,
                wrong: attempt.wrongCount,
              },
            ]
          : [],
        lesson: attempt.lessonId
          ? [
              {
                id: attempt.lessonId,
                correct: attempt.correctCount,
                wrong: attempt.wrongCount,
              },
            ]
          : [],
        difficulty: difficultyBreakdown,
        questionType: questionTypeBreakdown,
      },
      analysis: {
        strengths: difficultyBreakdown
          .filter(
            (item) => item.answered > 0 && item.correct / item.answered >= 0.8,
          )
          .map((item) => item.key),
        weaknesses: difficultyBreakdown
          .filter((item) => item.wrong > 0)
          .map((item) => item.key),
        slowQuestions: questions
          .filter((item) => (item.answer?.timeSpentMs ?? 0) >= 30_000)
          .sort(
            (left, right) =>
              (right.answer?.timeSpentMs ?? 0) -
              (left.answer?.timeSpentMs ?? 0),
          )
          .slice(0, 10)
          .map((item) => ({
            questionId: item.snapshot.id,
            timeSpentMs: item.answer?.timeSpentMs,
          })),
        wrongQuestions: reveal ? wrong.map((item) => item.response) : [],
        unansweredQuestions: unanswered.map((item) =>
          toStudentSnapshot(item.snapshot),
        ),
        recommendedLessons: [
          ...new Set(
            wrong
              .map((item) => item.snapshot.lessonId)
              .filter((lessonId): lessonId is string => Boolean(lessonId)),
          ),
        ],
      },
      questions: questions.map((item) => item.response),
      gamification: { points: attempt.pointsEarned, achievementsUnlocked: [] },
    };
  }

  private async completeInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    reason: CompletionReason,
  ): Promise<AttemptRecord> {
    const attempt = await tx.quizAttempt.findFirst({ where: { id, userId } });
    if (!attempt) throw quizNotFound();
    if (attempt.status === QuizAttemptStatus.COMPLETED) return attempt;
    if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
      throw quizBadRequest(
        'QUIZ_ATTEMPT_NOT_ACTIVE',
        'Quiz attempt is not active',
      );
    }
    const answers = await tx.quizAnswer.findMany({
      where: { attemptId: id },
      select: { isCorrect: true, pointsEarned: true },
    });
    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    const wrongCount = answers.length - correctCount;
    const unansweredCount = Math.max(0, attempt.questionCount - answers.length);
    const scorePercent = attempt.questionCount
      ? Number(((correctCount / attempt.questionCount) * 100).toFixed(2))
      : 0;
    const answerPoints = answers.reduce(
      (total, answer) => total + answer.pointsEarned,
      0,
    );
    const pointsEarned = answerPoints + QUIZ_COMPLETION_POINTS;
    const completedAt = new Date();
    const settings = {
      ...this.settings(attempt.settings),
      completionReason: reason,
    };
    const claimed = await tx.quizAttempt.updateMany({
      where: { id, userId, status: QuizAttemptStatus.IN_PROGRESS },
      data: {
        status: QuizAttemptStatus.COMPLETED,
        correctCount,
        wrongCount,
        unansweredCount,
        scorePercent,
        pointsEarned,
        completedAt,
        lastActivityAt: completedAt,
        settings,
      },
    });
    if (!claimed.count) {
      const completed = await tx.quizAttempt.findFirst({
        where: { id, userId },
      });
      if (!completed) throw quizNotFound();
      if (completed.status === QuizAttemptStatus.COMPLETED) return completed;
      throw quizBadRequest(
        'QUIZ_COMPLETION_FAILED',
        'Quiz completion could not be claimed',
      );
    }
    await this.progress.recordQuizCompleted(
      tx,
      userId,
      pointsEarned,
      completedAt,
    );
    await this.gamification.quizCompleted(tx, userId, id);
    const completed = await tx.quizAttempt.findFirst({ where: { id, userId } });
    if (!completed) throw quizNotFound();
    return completed;
  }

  private async findExistingAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
  ) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        answers: { where: { questionId } },
        questions: { where: { questionId }, select: { snapshot: true } },
      },
    });
    if (!attempt) throw quizNotFound();
    const answer = attempt.answers[0];
    const relation = attempt.questions[0];
    if (!answer || !relation) return null;
    return { attempt, answer, snapshot: parseQuizSnapshot(relation.snapshot) };
  }

  private resolveRetry(
    attempt: AttemptRecord,
    answer: QuizAnswer,
    snapshot: QuizQuestionSnapshot,
    dto: SubmitQuizAnswerDto,
  ) {
    if (!this.sameAnswer(answer, dto)) {
      throw quizConflict(
        'QUESTION_ALREADY_ANSWERED',
        'A different answer has already been recorded',
      );
    }
    return this.answerResponse(
      attempt,
      answer,
      snapshot,
      this.settings(attempt.settings),
    );
  }

  private sameAnswer(answer: QuizAnswer, dto: SubmitQuizAnswerDto) {
    return (
      answer.selectedOptionId === (dto.selectedOptionId ?? null) &&
      answer.selectedBoolean === (dto.selectedBoolean ?? null) &&
      answer.timeSpentMs === dto.timeSpentMs &&
      answer.hintUsed === dto.hintUsed &&
      answer.eliminatedOptionUsed === dto.eliminatedOptionUsed
    );
  }

  private answerResponse(
    attempt: AttemptRecord,
    answer: QuizAnswer,
    snapshot: QuizQuestionSnapshot,
    settings: AttemptSettings,
  ) {
    const reveal = settings.explanationMode === ExplanationMode.AFTER_EACH;
    const selected = snapshot.options.find(
      (option) => option.id === answer.selectedOptionId,
    );
    const correct = snapshot.options.find((option) => option.isCorrect);
    return {
      accepted: true,
      ...(reveal ? { isCorrect: answer.isCorrect } : {}),
      correctAnswer: reveal
        ? snapshot.type === QuestionType.MULTIPLE_CHOICE
          ? { optionId: correct?.id ?? null }
          : { value: snapshot.correctBoolean }
        : null,
      explanation: reveal
        ? {
            short: snapshot.explanationShort,
            detailed: snapshot.explanationDetailed,
            selectedOptionWhyWrong:
              selected?.isCorrect === false ? selected.whyWrong : null,
          }
        : null,
      score: {
        pointsEarned: answer.pointsEarned,
        attemptPoints: attempt.pointsEarned,
      },
      progress: {
        answered: attempt.correctCount + attempt.wrongCount,
        remaining: attempt.unansweredCount,
        correct: attempt.correctCount,
        wrong: attempt.wrongCount,
        heartsRemaining: attempt.heartsRemaining,
        status: attempt.status,
      },
    };
  }

  private evaluateAnswer(
    snapshot: QuizQuestionSnapshot,
    dto: SubmitQuizAnswerDto,
  ) {
    if (snapshot.type === QuestionType.MULTIPLE_CHOICE) {
      if (
        !dto.selectedOptionId ||
        (dto.selectedBoolean !== undefined && dto.selectedBoolean !== null)
      ) {
        throw quizBadRequest(
          'QUIZ_ANSWER_TYPE_INVALID',
          'MULTIPLE_CHOICE requires only selectedOptionId',
        );
      }
      const selected = snapshot.options.find(
        (option) => option.id === dto.selectedOptionId,
      );
      if (!selected)
        throw quizBadRequest(
          'QUIZ_OPTION_NOT_IN_QUESTION',
          'Selected option is not part of the question snapshot',
        );
      return { isCorrect: selected.isCorrect };
    }
    if (
      dto.selectedBoolean === undefined ||
      dto.selectedBoolean === null ||
      dto.selectedOptionId
    ) {
      throw quizBadRequest(
        'QUIZ_ANSWER_TYPE_INVALID',
        'TRUE_FALSE requires only selectedBoolean',
      );
    }
    return { isCorrect: dto.selectedBoolean === snapshot.correctBoolean };
  }

  private validateAnswerFeatures(
    snapshot: QuizQuestionSnapshot,
    settings: AttemptSettings,
    dto: SubmitQuizAnswerDto,
  ) {
    if (dto.hintUsed && !settings.hintsEnabled) {
      throw quizBadRequest(
        'QUIZ_SETTINGS_INVALID',
        'Hints are disabled for this attempt',
      );
    }
    if (
      dto.eliminatedOptionUsed &&
      (!settings.eliminationEnabled ||
        snapshot.type !== QuestionType.MULTIPLE_CHOICE)
    ) {
      throw quizBadRequest(
        'QUIZ_SETTINGS_INVALID',
        'Option elimination is unavailable for this attempt',
      );
    }
  }

  private validateSettings(dto: CreateQuizAttemptDto) {
    if (dto.timingMode === QuizTimingMode.TOTAL_TIME) {
      if (!dto.durationSeconds || dto.timePerQuestionSeconds) {
        throw quizBadRequest(
          'QUIZ_SETTINGS_INVALID',
          'TOTAL_TIME requires only durationSeconds',
        );
      }
    } else if (dto.timingMode === QuizTimingMode.PER_QUESTION) {
      if (!dto.timePerQuestionSeconds || dto.durationSeconds) {
        throw quizBadRequest(
          'QUIZ_SETTINGS_INVALID',
          'PER_QUESTION requires only timePerQuestionSeconds',
        );
      }
    } else if (dto.durationSeconds || dto.timePerQuestionSeconds) {
      throw quizBadRequest(
        'QUIZ_SETTINGS_INVALID',
        'NONE timing does not accept timing values',
      );
    }
    if (!dto.heartsEnabled && dto.initialHearts !== 3) {
      throw quizBadRequest(
        'QUIZ_SETTINGS_INVALID',
        'initialHearts is only configurable when hearts are enabled',
      );
    }
  }

  private async ensureAnswerable(userId: string, id: string) {
    const attempt = await this.findOwned(id, userId);
    await this.ensureNotExpired(attempt);
    if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
      throw quizBadRequest(
        'QUIZ_ATTEMPT_NOT_ACTIVE',
        'Quiz attempt is not active',
      );
    }
  }

  private async ensureNotExpired(attempt: AttemptRecord) {
    const settings = this.settings(attempt.settings);
    const now = Date.now();
    const totalExpired =
      attempt.expiresAt && attempt.expiresAt.getTime() <= now;
    const questionExpired =
      settings.timingMode === QuizTimingMode.PER_QUESTION &&
      settings.timePerQuestionSeconds &&
      now - attempt.lastActivityAt.getTime() >
        settings.timePerQuestionSeconds * 1000;
    if (!totalExpired && !questionExpired) return;
    await this.prisma.quizAttempt.updateMany({
      where: { id: attempt.id, status: QuizAttemptStatus.IN_PROGRESS },
      data: {
        status: QuizAttemptStatus.EXPIRED,
        completedAt: new Date(now),
        lastActivityAt: new Date(now),
        unansweredCount: Math.max(
          0,
          attempt.questionCount - attempt.correctCount - attempt.wrongCount,
        ),
      },
    });
    throw quizBadRequest(
      questionExpired ? 'QUIZ_QUESTION_TIME_EXPIRED' : 'QUIZ_ATTEMPT_EXPIRED',
      questionExpired
        ? 'The current question time has expired'
        : 'Quiz attempt has expired',
    );
  }

  private async findOwned(id: string, userId: string): Promise<AttemptRecord> {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id, userId },
    });
    if (!attempt) throw quizNotFound();
    return attempt;
  }

  private settings(value: Prisma.JsonValue): AttemptSettings {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw quizBadRequest(
        'QUIZ_SETTINGS_INVALID',
        'Quiz attempt settings are invalid',
      );
    }
    return value as unknown as AttemptSettings;
  }

  private toAttempt(attempt: AttemptRecord) {
    const settings = this.settings(attempt.settings);
    return {
      id: attempt.id,
      scope: attempt.scope,
      status: attempt.status,
      subjectId: attempt.subjectId,
      unitId: attempt.unitId,
      lessonId: attempt.lessonId,
      examModelId: attempt.examModelId,
      requestedQuestionCount:
        settings.requestedQuestionCount ?? attempt.questionCount,
      questionCount: attempt.questionCount,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      unansweredCount: attempt.unansweredCount,
      scorePercent: Number(attempt.scorePercent),
      pointsEarned: attempt.pointsEarned,
      heartsRemaining: attempt.heartsRemaining,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      expiresAt: attempt.expiresAt,
      lastActivityAt: attempt.lastActivityAt,
      settings: {
        timingMode: settings.timingMode,
        durationSeconds: settings.durationSeconds,
        timePerQuestionSeconds: settings.timePerQuestionSeconds,
        heartsEnabled: settings.heartsEnabled,
        hintsEnabled: settings.hintsEnabled,
        eliminationEnabled: settings.eliminationEnabled,
        explanationMode: settings.explanationMode,
        completionReason: settings.completionReason,
      },
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  private historyOrder(
    sort: QuizAttemptQueryDto['sort'],
  ): Prisma.QuizAttemptOrderByWithRelationInput[] {
    const stable = { id: 'asc' as const };
    switch (sort) {
      case 'created_asc':
        return [{ createdAt: 'asc' }, stable];
      case 'score_desc':
        return [{ scorePercent: 'desc' }, stable];
      case 'score_asc':
        return [{ scorePercent: 'asc' }, stable];
      case 'completed_desc':
        return [{ completedAt: 'desc' }, stable];
      default:
        return [{ createdAt: 'desc' }, stable];
    }
  }

  private breakdown<T>(items: T[], keyOf: (item: T) => string) {
    const groups = new Map<
      string,
      { key: string; answered: number; correct: number; wrong: number }
    >();
    for (const item of items as Array<T & { answer?: QuizAnswer }>) {
      const key = keyOf(item);
      const current = groups.get(key) ?? {
        key,
        answered: 0,
        correct: 0,
        wrong: 0,
      };
      if (item.answer) {
        current.answered += 1;
        current.correct += item.answer.isCorrect ? 1 : 0;
        current.wrong += item.answer.isCorrect ? 0 : 1;
      }
      groups.set(key, current);
    }
    return [...groups.values()];
  }

  private async serializable<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: 'Serializable',
        });
      } catch (error) {
        if (this.errorCode(error) !== 'P2034' || attempt === 3) throw error;
      }
    }
    throw quizBadRequest(
      'QUIZ_COMPLETION_FAILED',
      'Serializable transaction retry failed',
    );
  }

  private errorCode(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : null;
  }
}
