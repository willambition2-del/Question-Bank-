import { HttpException } from '@nestjs/common';
import {
  QuestionDifficulty,
  QuizScope,
  QuizTimingMode,
  ExplanationMode,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ExamModelHierarchyValidator } from '../content/exam-models/exam-model-hierarchy.validator';
import { QuestionHierarchyValidator } from '../content/questions/question-hierarchy.validator';
import { QuestionSelectionService } from './question-selection.service';
import { QuizScopeValidator } from './quiz-scope.validator';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const dto = (scope: QuizScope, values: Record<string, unknown> = {}) => ({
  scope,
  questionCount: 5,
  difficulty: QuestionDifficulty.MIXED,
  timingMode: QuizTimingMode.NONE,
  heartsEnabled: false,
  initialHearts: 3,
  hintsEnabled: true,
  eliminationEnabled: false,
  explanationMode: ExplanationMode.AFTER_EACH,
  excludeMastered: false,
  unansweredOnly: false,
  ...values,
});
const code = (error: unknown) =>
  error instanceof HttpException
    ? (error.getResponse() as { code?: string }).code
    : undefined;

describe('QuizScopeValidator', () => {
  const prisma = {
    unit: { findFirst: jest.fn() },
    lesson: { findFirst: jest.fn() },
    examModel: { findFirst: jest.fn() },
  };
  const hierarchy = { validate: jest.fn() };
  const examHierarchy = { load: jest.fn(), isVisible: jest.fn() };
  let validator: QuizScopeValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    hierarchy.validate.mockResolvedValue({});
    examHierarchy.load.mockResolvedValue({});
    examHierarchy.isVisible.mockReturnValue(true);
    validator = new QuizScopeValidator(
      prisma as unknown as PrismaService,
      hierarchy as unknown as QuestionHierarchyValidator,
      examHierarchy as unknown as ExamModelHierarchyValidator,
    );
  });

  it('accepts a visible subject and rejects unrelated identifiers', async () => {
    await expect(
      validator.validate(dto(QuizScope.SUBJECT, { subjectId: 'subject' })),
    ).resolves.toEqual({ subjectId: 'subject' });
    await validator
      .validate(
        dto(QuizScope.SUBJECT, { subjectId: 'subject', unitId: 'unit' }),
      )
      .catch((error) => expect(code(error)).toBe('QUIZ_SCOPE_INVALID'));
  });

  it('resolves and verifies unit ownership', async () => {
    prisma.unit.findFirst.mockResolvedValue({
      id: 'unit',
      subjectId: 'subject',
    });
    await expect(
      validator.validate(
        dto(QuizScope.UNIT, { unitId: 'unit', subjectId: 'subject' }),
      ),
    ).resolves.toEqual({ subjectId: 'subject', unitId: 'unit' });
    await validator
      .validate(dto(QuizScope.UNIT, { unitId: 'unit', subjectId: 'other' }))
      .catch((error) => expect(code(error)).toBe('QUIZ_SCOPE_INVALID'));
  });

  it('resolves lesson hierarchy and rejects hidden parents', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson',
      unitId: 'unit',
      subjectId: 'subject',
    });
    hierarchy.validate.mockRejectedValueOnce(new Error('hidden'));
    await validator
      .validate(dto(QuizScope.LESSON, { lessonId: 'lesson' }))
      .catch((error) => expect(code(error)).toBe('QUIZ_SCOPE_INVALID'));
  });

  it('requires a published visible exam model', async () => {
    prisma.examModel.findFirst.mockResolvedValue({
      id: 'exam',
      subjectId: 'subject',
      sourceId: null,
    });
    await expect(
      validator.validate(dto(QuizScope.EXAM_MODEL, { examModelId: 'exam' })),
    ).resolves.toEqual({ subjectId: 'subject', examModelId: 'exam' });
    examHierarchy.isVisible.mockReturnValue(false);
    await validator
      .validate(dto(QuizScope.EXAM_MODEL, { examModelId: 'exam' }))
      .catch((error) => expect(code(error)).toBe('QUIZ_SCOPE_INVALID'));
  });
});

describe('QuestionSelectionService', () => {
  const question = (id: string, difficulty = QuestionDifficulty.EASY) => ({
    id,
    subjectId: 'subject',
    unitId: null,
    lessonId: null,
    sourceId: null,
    readingPassageId: null,
    type: 'TRUE_FALSE' as const,
    questionText: id,
    questionImageUrl: null,
    correctBoolean: true,
    hintText: null,
    explanationShort: null,
    explanationDetailed: null,
    dangerKeyword: null,
    commonMistake: null,
    difficulty,
    reviewStatus: 'READY' as const,
    origin: 'MANUAL' as const,
    fingerprint: null,
    isTrapQuestion: false,
    isActive: true,
    isPublished: true,
    contentVersion: 1,
    createdById: null,
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    options: [],
    readingPassage: null,
  });
  const prisma = {
    quizAttemptQuestion: { findMany: jest.fn() },
    question: {
      findMany: jest.fn<
        (args: {
          where: {
            reviewStatus: string;
            isActive: boolean;
            isPublished: boolean;
            deletedAt: null;
          };
          take: number;
        }) => Promise<unknown[]>
      >(),
    },
    examModel: { findFirst: jest.fn() },
    studentQuestionProgress: { findMany: jest.fn() },
    savedQuestion: {
      findMany:
        jest.fn<(args: { where: { userId: string } }) => Promise<unknown[]>>(),
    },
  };
  const hierarchy = { validate: jest.fn() };
  let selection: QuestionSelectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    hierarchy.validate.mockResolvedValue({});
    selection = new QuestionSelectionService(
      prisma as unknown as PrismaService,
      hierarchy as unknown as QuestionHierarchyValidator,
    );
  });

  it('requests only eligible content with a bounded candidate pool', async () => {
    prisma.quizAttemptQuestion.findMany.mockResolvedValue([]);
    let questionQuery:
      | {
          where: {
            reviewStatus: string;
            isActive: boolean;
            isPublished: boolean;
            deletedAt: null;
          };
          take: number;
        }
      | undefined;
    prisma.question.findMany.mockImplementation(
      (args: NonNullable<typeof questionQuery>) => {
        questionQuery = args;
        return Promise.resolve([question('q1')]);
      },
    );
    const result = await selection.select(
      'user',
      dto(QuizScope.SUBJECT, { subjectId: 'subject', questionCount: 1 }),
    );
    expect(result.map((item) => item.question.id)).toEqual(['q1']);
    expect(questionQuery).toMatchObject({
      where: {
        reviewStatus: 'READY',
        isActive: true,
        isPublished: true,
        deletedAt: null,
      },
      take: 5,
    });
  });

  it('preserves fixed Exam Model order', async () => {
    prisma.examModel.findFirst.mockResolvedValue({
      questions: [{ question: question('q2') }, { question: question('q1') }],
    });
    const result = await selection.select(
      'user',
      dto(QuizScope.EXAM_MODEL, { examModelId: 'exam', questionCount: 2 }),
    );
    expect(result.map((item) => item.question.id)).toEqual(['q2', 'q1']);
  });

  it('uses only the current user saved collection', async () => {
    let savedQuery: { where: { userId: string } } | undefined;
    prisma.savedQuestion.findMany.mockImplementation(
      (args: NonNullable<typeof savedQuery>) => {
        savedQuery = args;
        return Promise.resolve([{ question: question('q1') }]);
      },
    );
    await selection.select('owner', dto(QuizScope.SAVED, { questionCount: 1 }));
    expect(savedQuery?.where.userId).toBe('owner');
  });

  it('removes duplicates and hidden hierarchy candidates', async () => {
    prisma.quizAttemptQuestion.findMany.mockResolvedValue([]);
    prisma.question.findMany.mockResolvedValue([
      question('q1'),
      question('q1'),
      question('q2'),
    ]);
    hierarchy.validate.mockImplementation((input: { id: string }) =>
      input.id === 'q2'
        ? Promise.reject(new Error('hidden'))
        : Promise.resolve({}),
    );
    const result = await selection.select(
      'user',
      dto(QuizScope.RANDOM, { questionCount: 3 }),
    );
    expect(result.map((item) => item.question.id)).toEqual(['q1']);
  });
});
