import { HttpException } from '@nestjs/common';
import {
  QuestionDifficulty,
  QuestionOrigin,
  QuestionReviewStatus,
  QuestionType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionHierarchyValidator } from '../questions/question-hierarchy.validator';
import { ExamModelHierarchyValidator } from './exam-model-hierarchy.validator';
import { ExamModelsService } from './exam-models.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-07-18T00:00:00.000Z');
const subject = {
  id: '80000000-0000-4000-8000-000000000001',
  curriculumId: 'c',
  gradeId: 'g',
  name: 'Physics',
  slug: 'physics',
  description: null,
  iconKey: null,
  colorHex: null,
  sortOrder: 0,
  isActive: true,
  isPublished: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};
const exam = {
  id: '80000000-0000-4000-8000-000000000002',
  subjectId: subject.id,
  sourceId: null,
  title: 'Official model',
  slug: 'official-model',
  year: 2026,
  governorate: null,
  description: null,
  durationMinutes: 120,
  difficulty: QuestionDifficulty.MIXED,
  isOfficial: true,
  isPublished: true,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  subject,
  source: null,
};
const question = {
  id: '80000000-0000-4000-8000-000000000003',
  subjectId: subject.id,
  unitId: null,
  lessonId: null,
  sourceId: null,
  readingPassageId: null,
  type: QuestionType.MULTIPLE_CHOICE,
  questionText: 'Which answer is correct?',
  questionImageUrl: null,
  correctBoolean: null,
  hintText: 'Secret hint',
  explanationShort: 'Secret explanation',
  explanationDetailed: null,
  dangerKeyword: null,
  commonMistake: 'Secret mistake',
  difficulty: QuestionDifficulty.EASY,
  reviewStatus: QuestionReviewStatus.READY,
  origin: QuestionOrigin.MANUAL,
  fingerprint: 'secret-fingerprint',
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
      id: '80000000-0000-4000-8000-000000000004',
      questionId: '80000000-0000-4000-8000-000000000003',
      optionText: 'A',
      optionImageUrl: null,
      sortOrder: 0,
      isCorrect: true,
      whyWrong: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '80000000-0000-4000-8000-000000000005',
      questionId: '80000000-0000-4000-8000-000000000003',
      optionText: 'B',
      optionImageUrl: null,
      sortOrder: 1,
      isCorrect: false,
      whyWrong: 'Secret',
      createdAt: now,
      updatedAt: now,
    },
  ],
};
const membership = (overrides: Record<string, unknown> = {}) => ({
  id: '80000000-0000-4000-8000-000000000006',
  examModelId: exam.id,
  questionId: question.id,
  sortOrder: 0,
  points: 2,
  question,
  ...overrides,
});

const errorCode = (error: unknown) =>
  error instanceof HttpException
    ? (error.getResponse() as { code?: string }).code
    : undefined;

describe('ExamModelsService hardening', () => {
  const prisma = {
    examModel: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    examModelQuestion: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    question: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const examHierarchy = {
    validate: jest.fn(),
    load: jest.fn(),
    isVisible: jest.fn(),
  };
  const questionHierarchy = { validate: jest.fn() };
  let service: ExamModelsService;

  beforeEach(() => {
    jest.clearAllMocks();
    examHierarchy.validate.mockResolvedValue({});
    examHierarchy.load.mockResolvedValue({});
    examHierarchy.isVisible.mockReturnValue(true);
    questionHierarchy.validate.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (input: unknown) =>
      typeof input === 'function'
        ? (input as (tx: typeof prisma) => Promise<unknown>)(prisma)
        : Promise.all(input as Promise<unknown>[]),
    );
    service = new ExamModelsService(
      prisma as unknown as PrismaService,
      examHierarchy as unknown as ExamModelHierarchyValidator,
      questionHierarchy as unknown as QuestionHierarchyValidator,
    );
  });

  it('returns student questions without solution or review fields', async () => {
    prisma.examModel.findFirst.mockResolvedValue({
      ...exam,
      questions: [membership()],
    });
    const result = await service.getStudent(exam.id);
    expect(result.questionsCount).toBe(1);
    expect(result.totalPoints).toBe(2);
    const mapped = result.questions[0].question;
    expect(mapped).not.toHaveProperty('correctBoolean');
    expect(mapped).not.toHaveProperty('explanationShort');
    expect(mapped).not.toHaveProperty('fingerprint');
    expect(mapped).not.toHaveProperty('reviewStatus');
    expect(mapped.options[0]).not.toHaveProperty('isCorrect');
    expect(mapped.options[1]).not.toHaveProperty('whyWrong');
  });

  it('hides a student exam when its parent hierarchy is not visible', async () => {
    prisma.examModel.findFirst.mockResolvedValue({
      ...exam,
      questions: [membership()],
    });
    examHierarchy.isVisible.mockReturnValue(false);
    await expect(service.getStudent(exam.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('hides a student exam when no membership remains currently valid', async () => {
    prisma.examModel.findFirst.mockResolvedValue({
      ...exam,
      questions: [
        membership({ question: { ...question, isPublished: false } }),
      ],
    });
    await expect(service.getStudent(exam.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects publication of an empty exam with a stable code', async () => {
    prisma.examModel.findUnique.mockResolvedValue({
      ...exam,
      isPublished: false,
      questions: [],
    });
    await service
      .publish(exam.id)
      .catch((error) => expect(errorCode(error)).toBe('EXAM_MODEL_EMPTY'));
    expect(prisma.examModel.update).not.toHaveBeenCalled();
  });

  it('rejects publication with invalid points', async () => {
    prisma.examModel.findUnique.mockResolvedValue({
      ...exam,
      isPublished: false,
      questions: [membership({ points: 0 })],
    });
    await service
      .publish(exam.id)
      .catch((error) =>
        expect(errorCode(error)).toBe('EXAM_MODEL_INVALID_POINTS'),
      );
  });

  it('forbids all metadata mutation while published', async () => {
    prisma.examModel.findUnique.mockResolvedValue(exam);
    await service
      .update(exam.id, { title: 'Changed' })
      .catch((error) =>
        expect(errorCode(error)).toBe(
          'EXAM_MODEL_PUBLISHED_MODIFICATION_FORBIDDEN',
        ),
      );
    expect(prisma.examModel.update).not.toHaveBeenCalled();
  });

  it('rejects duplicate membership before writing', async () => {
    prisma.examModel.findUnique.mockResolvedValue({
      ...exam,
      isPublished: false,
    });
    prisma.question.findFirst.mockResolvedValue(question);
    prisma.examModelQuestion.findUnique
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null);
    await service
      .addQuestion(exam.id, {
        questionId: question.id,
        sortOrder: 0,
        points: 1,
      })
      .catch((error) =>
        expect(errorCode(error)).toBe('EXAM_MODEL_QUESTION_ALREADY_EXISTS'),
      );
  });

  it('rejects duplicate IDs in bulk atomically', async () => {
    prisma.examModel.findUnique.mockResolvedValue({
      ...exam,
      isPublished: false,
    });
    await service
      .bulkAdd(exam.id, {
        questions: [{ questionId: question.id }, { questionId: question.id }],
      })
      .catch((error) =>
        expect(errorCode(error)).toBe('EXAM_MODEL_QUESTION_ALREADY_EXISTS'),
      );
    expect(prisma.examModelQuestion.createMany).not.toHaveBeenCalled();
  });

  it('rejects duplicate reorder positions', async () => {
    prisma.examModel.findUnique.mockResolvedValue({
      ...exam,
      isPublished: false,
    });
    await service
      .reorder(exam.id, {
        items: [
          { questionId: question.id, sortOrder: 0 },
          { questionId: '80000000-0000-4000-8000-000000000099', sortOrder: 0 },
        ],
      })
      .catch((error) =>
        expect(errorCode(error)).toBe('EXAM_MODEL_SORT_ORDER_CONFLICT'),
      );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns a clear bulk result after one transactional write', async () => {
    prisma.examModel.findUnique.mockResolvedValue({
      ...exam,
      isPublished: false,
    });
    prisma.question.findFirst.mockResolvedValue(question);
    prisma.examModelQuestion.findFirst.mockResolvedValue(null);
    prisma.examModelQuestion.createMany.mockResolvedValue({ count: 1 });
    prisma.examModelQuestion.count.mockResolvedValue(1);
    const result = await service.bulkAdd(exam.id, {
      questions: [{ questionId: question.id, sortOrder: 0, points: 2 }],
    });
    expect(result).toEqual({
      examModelId: exam.id,
      addedCount: 1,
      totalQuestions: 1,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
