import { BadRequestException } from '@nestjs/common';
import type { Question, QuestionOption } from '../../generated/prisma/client';
import {
  QuestionDifficulty,
  QuestionOrigin,
  QuestionReviewStatus,
  QuestionType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { toStudentQuestion } from '../content.mapper';
import { QuestionHierarchyValidator } from './question-hierarchy.validator';
import { QuestionsService } from './questions.service';
jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-07-17T00:00:00.000Z');
const baseQuestion: Question = {
  id: '50000000-0000-4000-8000-000000000001',
  subjectId: '50000000-0000-4000-8000-000000000002',
  unitId: null,
  lessonId: null,
  sourceId: null,
  readingPassageId: null,
  type: QuestionType.MULTIPLE_CHOICE,
  questionText: 'ما وحدة قياس القوة؟',
  questionImageUrl: null,
  correctBoolean: null,
  hintText: 'فكر في نيوتن',
  explanationShort: 'النيوتن هو وحدة القوة.',
  explanationDetailed: 'تعريف تفصيلي.',
  dangerKeyword: null,
  commonMistake: 'الخلط مع الجول',
  difficulty: QuestionDifficulty.EASY,
  reviewStatus: QuestionReviewStatus.DRAFT,
  origin: QuestionOrigin.MANUAL,
  fingerprint: 'fingerprint',
  isTrapQuestion: false,
  isActive: true,
  isPublished: false,
  contentVersion: 1,
  createdById: 'creator-1',
  reviewedById: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};
const options: QuestionOption[] = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    questionId: baseQuestion.id,
    optionText: 'نيوتن',
    optionImageUrl: null,
    sortOrder: 1,
    isCorrect: true,
    whyWrong: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: '60000000-0000-4000-8000-000000000002',
    questionId: baseQuestion.id,
    optionText: 'جول',
    optionImageUrl: null,
    sortOrder: 2,
    isCorrect: false,
    whyWrong: 'الجول وحدة طاقة.',
    createdAt: now,
    updatedAt: now,
  },
];

describe('QuestionsService', () => {
  const prisma = {
    subject: { findFirst: jest.fn() },
    unit: { findFirst: jest.fn() },
    lesson: { findFirst: jest.fn() },
    source: { findFirst: jest.fn() },
    readingPassage: { findFirst: jest.fn() },
    question: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    questionReview: { create: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const hierarchy = {
    validate: jest.fn(),
    load: jest.fn(),
    isVisible: jest.fn().mockReturnValue(true),
  };
  let service: QuestionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.subject.findFirst.mockResolvedValue({ id: baseQuestion.subjectId });
    prisma.$transaction.mockImplementation(
      (
        input:
          Promise<unknown>[] | ((client: typeof prisma) => Promise<unknown>),
      ) => (typeof input === 'function' ? input(prisma) : Promise.all(input)),
    );
    hierarchy.validate.mockResolvedValue({});
    service = new QuestionsService(
      prisma as unknown as PrismaService,
      hierarchy as unknown as QuestionHierarchyValidator,
    );
  });

  const validMcq = () => ({
    subjectId: baseQuestion.subjectId,
    type: QuestionType.MULTIPLE_CHOICE,
    questionText: baseQuestion.questionText,
    options: [
      { optionText: 'نيوتن', sortOrder: 1, isCorrect: true },
      { optionText: 'جول', sortOrder: 2, isCorrect: false },
    ],
  });

  it('creates a valid MCQ with a SHA-256 fingerprint', async () => {
    prisma.question.create.mockResolvedValue({
      ...baseQuestion,
      options,
      readingPassage: null,
    });

    const result = await service.create('creator-1', validMcq());

    expect(result.type).toBe(QuestionType.MULTIPLE_CHOICE);
    expect(prisma.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) as string,
          reviewStatus: QuestionReviewStatus.DRAFT,
          isPublished: false,
        }) as object,
      }),
    );
  });

  it('rejects an MCQ without a correct option', async () => {
    const dto = validMcq();
    dto.options[0].isCorrect = false;
    await expect(service.create('creator-1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an MCQ with multiple correct options', async () => {
    const dto = validMcq();
    dto.options[1].isCorrect = true;
    await expect(service.create('creator-1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates a true/false question without options', async () => {
    prisma.question.create.mockResolvedValue({
      ...baseQuestion,
      type: QuestionType.TRUE_FALSE,
      correctBoolean: true,
      options: [],
      readingPassage: null,
    });
    const result = await service.create('creator-1', {
      subjectId: baseQuestion.subjectId,
      type: QuestionType.TRUE_FALSE,
      questionText: 'القوة كمية متجهة.',
      correctBoolean: true,
    });
    expect(result.correctBoolean).toBe(true);
  });

  it('rejects a true/false question containing options', async () => {
    await expect(
      service.create('creator-1', {
        subjectId: baseQuestion.subjectId,
        type: QuestionType.TRUE_FALSE,
        questionText: 'القوة كمية متجهة.',
        correctBoolean: true,
        options: validMcq().options,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes every solution field from the student mapper', () => {
    const mapped = toStudentQuestion({
      ...baseQuestion,
      reviewStatus: QuestionReviewStatus.READY,
      isPublished: true,
      options,
      readingPassage: null,
    });
    expect(mapped).not.toHaveProperty('correctBoolean');
    expect(mapped).not.toHaveProperty('explanationShort');
    expect(mapped).not.toHaveProperty('hintText');
    expect(mapped.options[0]).not.toHaveProperty('isCorrect');
    expect(mapped.options[1]).not.toHaveProperty('whyWrong');
  });

  it('approves a submitted question and records the review', async () => {
    const submitted = {
      ...baseQuestion,
      reviewStatus: QuestionReviewStatus.REVIEW_REQUIRED,
      options,
      readingPassage: null,
    };
    prisma.question.findUnique.mockResolvedValue(submitted);
    prisma.question.update.mockResolvedValue({
      ...submitted,
      reviewStatus: QuestionReviewStatus.READY,
    });
    prisma.questionReview.create.mockResolvedValue({ id: 'review-1' });

    const result = await service.approve(
      baseQuestion.id,
      'different-admin',
      'Approved',
    );
    expect(result.reviewStatus).toBe(QuestionReviewStatus.READY);
    expect(prisma.questionReview.create).toHaveBeenCalled();
  });

  it('rejects a submitted question with a recorded reason', async () => {
    const submitted = {
      ...baseQuestion,
      reviewStatus: QuestionReviewStatus.REVIEW_REQUIRED,
      options,
      readingPassage: null,
    };
    prisma.question.findUnique.mockResolvedValue(submitted);
    prisma.question.update.mockResolvedValue({
      ...submitted,
      reviewStatus: QuestionReviewStatus.REJECTED,
      rejectionReason: 'Needs correction',
    });
    prisma.questionReview.create.mockResolvedValue({ id: 'review-2' });

    const result = await service.reject(
      baseQuestion.id,
      'different-admin',
      'Needs correction',
    );
    expect(result.rejectionReason).toBe('Needs correction');
  });

  it('soft-deletes and unpublishes a question', async () => {
    prisma.question.findUnique.mockResolvedValue({
      ...baseQuestion,
      options,
      readingPassage: null,
    });
    prisma.question.update.mockResolvedValue({
      ...baseQuestion,
      isActive: false,
      isPublished: false,
      deletedAt: now,
      options,
      readingPassage: null,
    });
    const result = await service.remove(baseQuestion.id);
    expect(result.deletedAt).toEqual(now);
    expect(result.isPublished).toBe(false);
  });
});
