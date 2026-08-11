import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  ExplanationMode,
  QuizAttemptStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  parseQuizSnapshot,
  type QuizQuestionSnapshot,
} from '../../quiz/quiz-snapshot';

export enum QuestionContextMode {
  HINT_SAFE = 'HINT_SAFE',
  EXPLANATION_AFTER_ANSWER = 'EXPLANATION_AFTER_ANSWER',
  REVIEW_FULL = 'REVIEW_FULL',
  ADMIN_CONTENT_GENERATION = 'ADMIN_CONTENT_GENERATION',
}

type AttemptSettings = {
  explanationMode?: ExplanationMode;
  hintsEnabled?: boolean;
};

@Injectable()
export class QuestionContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    userId: string,
    questionId: string,
    mode: QuestionContextMode,
    attemptId?: string,
  ): Promise<Record<string, unknown>> {
    if (mode === QuestionContextMode.HINT_SAFE) {
      return this.safeQuestion(userId, questionId);
    }
    if (!attemptId) {
      throw new ForbiddenException({
        code: 'ATTEMPT_CONTEXT_REQUIRED',
        message: 'An owned quiz attempt is required for this operation',
      });
    }
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        questions: {
          where: { questionId },
          select: { snapshot: true },
        },
        answers: {
          where: { questionId },
          select: {
            selectedOptionId: true,
            selectedBoolean: true,
            isCorrect: true,
          },
        },
      },
    });
    const relation = attempt?.questions[0];
    if (!attempt || !relation?.snapshot) {
      throw new NotFoundException({
        code: 'QUESTION_ATTEMPT_NOT_FOUND',
        message: 'Question was not found in the owned attempt',
      });
    }
    const snapshot = parseQuizSnapshot(relation.snapshot);
    const answer = attempt.answers[0];
    const settings = this.settings(attempt.settings);

    if (mode === QuestionContextMode.EXPLANATION_AFTER_ANSWER) {
      if (!answer) {
        throw this.protected();
      }
      if (settings.explanationMode === ExplanationMode.DISABLED) {
        throw this.protected();
      }
      const active =
        attempt.status === QuizAttemptStatus.CREATED ||
        attempt.status === QuizAttemptStatus.IN_PROGRESS;
      if (active && settings.explanationMode !== ExplanationMode.AFTER_EACH) {
        throw this.protected();
      }
      return this.fullSnapshot(snapshot, answer);
    }

    if (
      mode === QuestionContextMode.REVIEW_FULL &&
      (attempt.status !== QuizAttemptStatus.COMPLETED ||
        settings.explanationMode === ExplanationMode.DISABLED)
    ) {
      throw this.protected();
    }
    return this.fullSnapshot(snapshot, answer ?? null);
  }

  private async safeQuestion(userId: string, questionId: string) {
    const activeAttempt = await this.prisma.quizAttempt.findFirst({
      where: {
        userId,
        status: {
          in: [QuizAttemptStatus.CREATED, QuizAttemptStatus.IN_PROGRESS],
        },
        questions: { some: { questionId } },
      },
      select: { settings: true },
    });
    if (
      activeAttempt &&
      this.settings(activeAttempt.settings).hintsEnabled !== true
    ) {
      throw new ForbiddenException({
        code: 'QUIZ_HINT_NOT_ALLOWED',
        message: 'Hints are disabled for the active quiz attempt',
      });
    }
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        isActive: true,
        isPublished: true,
        deletedAt: null,
      },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, optionText: true },
        },
        readingPassage: {
          select: { title: true, passageText: true },
        },
      },
    });
    if (!question) {
      throw new NotFoundException({
        code: 'QUESTION_NOT_FOUND',
        message: 'Question was not found',
      });
    }
    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.type,
      options: question.options.map((option) => ({
        id: option.id,
        optionText: option.optionText,
      })),
      readingPassage: question.readingPassage,
      existingHint: question.hintText,
    };
  }

  private fullSnapshot(
    snapshot: QuizQuestionSnapshot,
    answer: {
      selectedOptionId: string | null;
      selectedBoolean: boolean | null;
      isCorrect: boolean;
    } | null,
  ) {
    return {
      questionId: snapshot.id,
      questionText: snapshot.questionText,
      questionType: snapshot.type,
      options: snapshot.options,
      correctBoolean: snapshot.correctBoolean,
      hint: snapshot.hintText,
      explanationShort: snapshot.explanationShort,
      explanationDetailed: snapshot.explanationDetailed,
      answer,
    };
  }

  private settings(value: Prisma.JsonValue): AttemptSettings {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {};
  }

  private protected() {
    return new ForbiddenException({
      code: 'ACTIVE_QUIZ_ANSWER_PROTECTED',
      message: 'Answer details are protected by the quiz rules',
    });
  }
}
