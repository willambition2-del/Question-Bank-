/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExplanationMode,
  QuestionDifficulty,
  QuestionType,
  QuizAttemptStatus,
} from '../../generated/prisma/enums';
import {
  QuestionContextMode,
  QuestionContextService,
} from './question-context.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('QuestionContextService', () => {
  const findAttempt = jest.fn();
  const findQuestion = jest.fn();
  const service = new QuestionContextService({
    quizAttempt: { findFirst: findAttempt },
    question: { findFirst: findQuestion },
  } as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('never includes solution fields in hint-safe context', async () => {
    findQuestion.mockResolvedValue({
      id: 'question-1',
      questionText: 'Question?',
      type: QuestionType.MULTIPLE_CHOICE,
      hintText: 'Think about the definition',
      correctBoolean: null,
      explanationDetailed: 'secret explanation',
      options: [
        { id: 'option-1', optionText: 'A', isCorrect: true },
        { id: 'option-2', optionText: 'B', isCorrect: false },
      ],
      readingPassage: null,
    });

    const result = await service.build(
      'user-1',
      'question-1',
      QuestionContextMode.HINT_SAFE,
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('isCorrect');
    expect(serialized).not.toContain('correctBoolean');
    expect(serialized).not.toContain('explanationDetailed');
  });

  it('blocks explanation during an active AT_END attempt', async () => {
    findAttempt.mockResolvedValue(
      attempt(QuizAttemptStatus.IN_PROGRESS, ExplanationMode.AT_END, true),
    );

    await expect(
      service.build(
        'user-1',
        'question-1',
        QuestionContextMode.EXPLANATION_AFTER_ANSWER,
        'attempt-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows explanation after a recorded answer when AFTER_EACH permits it', async () => {
    findAttempt.mockResolvedValue(
      attempt(QuizAttemptStatus.IN_PROGRESS, ExplanationMode.AFTER_EACH, true),
    );

    const result = await service.build(
      'user-1',
      'question-1',
      QuestionContextMode.EXPLANATION_AFTER_ANSWER,
      'attempt-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        correctBoolean: true,
        answer: expect.objectContaining({ isCorrect: true }),
      }),
    );
  });

  it('blocks full review until the owned attempt is completed', async () => {
    findAttempt.mockResolvedValue(
      attempt(QuizAttemptStatus.ABANDONED, ExplanationMode.AT_END, true),
    );

    await expect(
      service.build(
        'user-1',
        'question-1',
        QuestionContextMode.REVIEW_FULL,
        'attempt-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

function attempt(
  status: QuizAttemptStatus,
  explanationMode: ExplanationMode,
  answered: boolean,
) {
  return {
    status,
    settings: { explanationMode },
    questions: [{ snapshot: snapshot() }],
    answers: answered
      ? [{ selectedOptionId: null, selectedBoolean: true, isCorrect: true }]
      : [],
  };
}

function snapshot() {
  return {
    version: 1,
    id: 'question-1',
    subjectId: 'subject-1',
    unitId: null,
    lessonId: null,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.MEDIUM,
    questionText: 'Statement',
    questionImageUrl: null,
    isTrapQuestion: false,
    contentVersion: 1,
    readingPassage: null,
    options: [],
    correctBoolean: true,
    hintText: 'Recall the rule',
    explanationShort: 'Short',
    explanationDetailed: 'Detailed',
  };
}
