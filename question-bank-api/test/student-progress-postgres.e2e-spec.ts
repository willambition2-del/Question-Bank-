import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  CompanionType,
  ExplanationMode,
  QuestionDifficulty,
  QuestionReviewStatus,
  QuestionType,
  QuizScope,
  QuizTimingMode,
  UserRole,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProgressReconciliationService } from '../src/progress/progress-reconciliation.service';

interface AuthResponse {
  tokens: { accessToken: string };
}
interface DataResponse<T> {
  data: T;
}
type QuizQuestion = {
  id: string;
  type: QuestionType;
  options: Array<{ id: string; optionText: string; isCorrect?: unknown }>;
  correctBoolean?: unknown;
};
type CreatedQuiz = {
  attempt: { id: string; questionCount: number };
  questions: QuizQuestion[];
  availability: {
    requestedQuestionCount: number;
    actualQuestionCount: number;
  };
};

describe('Student Progress PostgreSQL hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let reconciliation: ProgressReconciliationService;
  const suffix = randomUUID().slice(0, 8);
  const password = 'Password123';
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const correctOptions: Record<string, string> = {};
  const correctBooleans: Record<string, boolean> = {};
  let quiz: CreatedQuiz;

  const auth = (token: string) => `Bearer ${token}`;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    reconciliation = app.get(ProgressReconciliationService);

    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['admin', UserRole.ADMIN],
      ['studentA', UserRole.STUDENT],
      ['studentB', UserRole.STUDENT],
    ] as const) {
      const username = `progress_${key.toLowerCase()}_${suffix}`;
      const user = await prisma.user.create({
        data: {
          name: `Progress ${key}`,
          username,
          passwordHash,
          role,
          companion: CompanionType.MALE,
        },
      });
      ids[`${key}Id`] = user.id;
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ identifier: username, password })
        .expect(200);
      tokens[key] = (login.body as AuthResponse).tokens.accessToken;
    }

    const grade = await prisma.grade.create({
      data: {
        name: `Progress Grade ${suffix}`,
        slug: `progress-grade-${suffix}`,
        isActive: true,
      },
    });
    const curriculum = await prisma.curriculum.create({
      data: {
        name: `Progress Curriculum ${suffix}`,
        slug: `progress-curriculum-${suffix}`,
        countryCode: 'YE',
        isActive: true,
      },
    });
    ids.gradeId = grade.id;
    ids.curriculumId = curriculum.id;
    await prisma.curriculumGrade.create({
      data: { curriculumId: curriculum.id, gradeId: grade.id },
    });
    const subject = await prisma.subject.create({
      data: {
        curriculumId: curriculum.id,
        gradeId: grade.id,
        name: `Progress Physics ${suffix}`,
        slug: `progress-physics-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    const unit = await prisma.unit.create({
      data: {
        subjectId: subject.id,
        name: `Progress Unit ${suffix}`,
        slug: `progress-unit-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        name: `Progress Lesson ${suffix}`,
        slug: `progress-lesson-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    ids.subjectId = subject.id;
    ids.unitId = unit.id;
    ids.lessonId = lesson.id;

    const questionData = [
      {
        key: 'mcq1',
        type: QuestionType.MULTIPLE_CHOICE,
        difficulty: QuestionDifficulty.EASY,
        text: 'قوة نيوتن',
      },
      {
        key: 'tf1',
        type: QuestionType.TRUE_FALSE,
        difficulty: QuestionDifficulty.MEDIUM,
        text: 'الطاقة محفوظة',
        correctBoolean: true,
      },
      {
        key: 'tf2',
        type: QuestionType.TRUE_FALSE,
        difficulty: QuestionDifficulty.HARD,
        text: 'الكتلة تساوي السرعة',
        correctBoolean: false,
      },
      {
        key: 'mcq2',
        type: QuestionType.MULTIPLE_CHOICE,
        difficulty: QuestionDifficulty.MEDIUM,
        text: 'وحدة الطاقة',
      },
    ] as const;
    for (const entry of questionData) {
      const created = await prisma.question.create({
        data: {
          subjectId: subject.id,
          unitId: unit.id,
          lessonId: lesson.id,
          type: entry.type,
          difficulty: entry.difficulty,
          questionText: `${entry.text} ${suffix}`,
          correctBoolean:
            'correctBoolean' in entry ? entry.correctBoolean : undefined,
          reviewStatus: QuestionReviewStatus.READY,
          isActive: true,
          isPublished: true,
          explanationShort: 'لا يجب أن يظهر في المجموعة',
          options:
            entry.type === QuestionType.MULTIPLE_CHOICE
              ? {
                  create: [
                    {
                      optionText: `صحيح ${entry.key}`,
                      sortOrder: 0,
                      isCorrect: true,
                    },
                    {
                      optionText: `خطأ ${entry.key}`,
                      sortOrder: 1,
                      isCorrect: false,
                      whyWrong: 'حل سري',
                    },
                  ],
                }
              : undefined,
        },
        include: { options: true },
      });
      ids[`${entry.key}Id`] = created.id;
      const correct = created.options.find((option) => option.isCorrect);
      if (correct) correctOptions[created.id] = correct.id;
      if ('correctBoolean' in entry)
        correctBooleans[created.id] = entry.correctBoolean;
    }
  });

  const createQuiz = async (
    path: string,
    body: Record<string, unknown>,
    token = tokens.studentA,
  ) => {
    const response = await api()
      .post(path)
      .set('Authorization', auth(token))
      .send(body)
      .expect(201);
    return (response.body as DataResponse<CreatedQuiz>).data;
  };

  const answerPayload = (question: QuizQuestion, correct: boolean) => {
    if (question.type === QuestionType.MULTIPLE_CHOICE) {
      const correctId = correctOptions[question.id];
      const wrongId = question.options.find(
        (option) => option.id !== correctId,
      )?.id;
      return {
        questionId: question.id,
        selectedOptionId: correct ? correctId : wrongId,
        timeSpentMs: 1000,
        hintUsed: false,
        eliminatedOptionUsed: false,
      };
    }
    const expected = correctBooleans[question.id];
    return {
      questionId: question.id,
      selectedBoolean: correct ? expected : !expected,
      timeSpentMs: 1000,
      hintUsed: false,
      eliminatedOptionUsed: false,
    };
  };

  it('updates question and hierarchy progress from persisted answers without lost concurrent updates', async () => {
    await api().get('/api/v1/mistakes').expect(401);
    quiz = await createQuiz('/api/v1/quiz-attempts', {
      scope: QuizScope.LESSON,
      subjectId: ids.subjectId,
      unitId: ids.unitId,
      lessonId: ids.lessonId,
      questionCount: 4,
      timingMode: QuizTimingMode.NONE,
      explanationMode: ExplanationMode.AFTER_EACH,
    });
    expect(quiz.questions).toHaveLength(4);
    const first = quiz.questions.find((item) => item.id === ids.mcq1Id)!;
    const mistake = quiz.questions.find((item) => item.id === ids.tf1Id)!;
    const concurrent = quiz.questions.filter(
      (item) => item.id === ids.tf2Id || item.id === ids.mcq2Id,
    );

    await api()
      .post(`/api/v1/quiz-attempts/${quiz.attempt.id}/answers`)
      .set('Authorization', auth(tokens.studentA))
      .send(answerPayload(first, true))
      .expect(201);
    const wrongPayload = answerPayload(mistake, false);
    await api()
      .post(`/api/v1/quiz-attempts/${quiz.attempt.id}/answers`)
      .set('Authorization', auth(tokens.studentA))
      .send(wrongPayload)
      .expect(201);
    await api()
      .post(`/api/v1/quiz-attempts/${quiz.attempt.id}/answers`)
      .set('Authorization', auth(tokens.studentA))
      .send(wrongPayload)
      .expect(201);

    const concurrentResponses = await Promise.all(
      concurrent.map((question) =>
        api()
          .post(`/api/v1/quiz-attempts/${quiz.attempt.id}/answers`)
          .set('Authorization', auth(tokens.studentA))
          .send(answerPayload(question, true)),
      ),
    );
    expect(concurrentResponses.map((response) => response.status)).toEqual([
      201, 201,
    ]);

    const progressRows = await prisma.studentQuestionProgress.findMany({
      where: { userId: ids.studentAId },
      orderBy: { questionId: 'asc' },
    });
    expect(progressRows).toHaveLength(4);
    expect(
      progressRows.find((row) => row.questionId === ids.tf1Id),
    ).toMatchObject({
      attemptsCount: 1,
      correctCount: 0,
      wrongCount: 1,
      consecutiveCorrect: 0,
      consecutiveWrong: 1,
      averageTimeMs: 1000,
      lastTimeMs: 1000,
      lastAnswerCorrect: false,
    });
    const lesson = await prisma.studentLessonProgress.findUniqueOrThrow({
      where: {
        userId_lessonId: {
          userId: ids.studentAId,
          lessonId: ids.lessonId,
        },
      },
    });
    expect(lesson).toMatchObject({
      answeredQuestions: 4,
      correctAnswers: 3,
      wrongAnswers: 1,
    });
    expect(Number(lesson.accuracyPercent)).toBe(75);
    expect(
      await prisma.studentQuestionProgress.count({
        where: { userId: ids.studentBId },
      }),
    ).toBe(0);
  });

  it('keeps mistakes owned, visible, filterable, safe and delegates mistake quiz creation', async () => {
    const list = await api()
      .get('/api/v1/mistakes?minWrongCount=1&sort=wrong_count_desc')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    const items = (list.body as DataResponse<Array<Record<string, unknown>>>)
      .data;
    expect(items).toHaveLength(1);
    expect((items[0].question as Record<string, unknown>).id).toBe(ids.tf1Id);
    expect(items[0].question).not.toHaveProperty('correctBoolean');
    expect(items[0].question).not.toHaveProperty('explanationShort');

    await api()
      .get(`/api/v1/mistakes/${ids.tf1Id}`)
      .set('Authorization', auth(tokens.studentB))
      .expect(404);
    const reviewed = await api()
      .post(`/api/v1/mistakes/${ids.tf1Id}/mark-mastered`)
      .set('Authorization', auth(tokens.studentA))
      .expect(201);
    expect(
      (reviewed.body as DataResponse<{ isMastered: boolean }>).data.isMastered,
    ).toBe(false);
    await api()
      .post(`/api/v1/mistakes/${ids.tf1Id}/mark-mastered`)
      .set('Authorization', auth(tokens.studentA))
      .expect(201);

    const mistakesQuiz = await createQuiz('/api/v1/mistakes/quiz', {
      subjectId: ids.subjectId,
      unitId: ids.unitId,
      lessonId: ids.lessonId,
      questionCount: 5,
    });
    expect(mistakesQuiz.questions.map((item) => item.id)).toEqual([ids.tf1Id]);
  });

  it('makes saved questions idempotent, owner-safe, normalized and quiz-integrated', async () => {
    const savePath = `/api/v1/saved-questions/${ids.mcq1Id}`;
    const first = await api()
      .post(savePath)
      .set('Authorization', auth(tokens.studentA))
      .send({ note: '  أحتاج مراجعة هذا السؤال  ' })
      .expect(201);
    const saved = (first.body as DataResponse<Record<string, unknown>>).data;
    expect(saved.note).toBe('أحتاج مراجعة هذا السؤال');
    expect(saved).not.toHaveProperty('userId');
    expect(saved.question).not.toHaveProperty('correctBoolean');

    await api()
      .post(savePath)
      .set('Authorization', auth(tokens.studentA))
      .send({})
      .expect(201);
    expect(
      await prisma.savedQuestion.count({
        where: { userId: ids.studentAId, questionId: ids.mcq1Id },
      }),
    ).toBe(1);
    await api()
      .patch(savePath)
      .set('Authorization', auth(tokens.studentB))
      .send({ note: 'IDOR' })
      .expect(404);
    await api()
      .patch(savePath)
      .set('Authorization', auth(tokens.studentA))
      .send({ note: '' })
      .expect(200)
      .expect(({ body }) =>
        expect(
          (body as DataResponse<{ note: string | null }>).data.note,
        ).toBeNull(),
      );

    const concurrent = await Promise.all([
      api()
        .post(`/api/v1/saved-questions/${ids.tf2Id}`)
        .set('Authorization', auth(tokens.studentA))
        .send({ note: 'أ' }),
      api()
        .post(`/api/v1/saved-questions/${ids.tf2Id}`)
        .set('Authorization', auth(tokens.studentA))
        .send({ note: 'ب' }),
    ]);
    expect(concurrent.map((response) => response.status)).toEqual([201, 201]);
    expect(
      await prisma.savedQuestion.count({
        where: { userId: ids.studentAId, questionId: ids.tf2Id },
      }),
    ).toBe(1);

    const list = await api()
      .get(
        `/api/v1/saved-questions?subjectId=${ids.subjectId}&search=${suffix}&sort=question_text_asc`,
      )
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect((list.body as DataResponse<unknown[]>).data).toHaveLength(2);

    const savedQuiz = await createQuiz('/api/v1/saved-questions/quiz', {
      subjectId: ids.subjectId,
      questionCount: 10,
    });
    expect(new Set(savedQuiz.questions.map((item) => item.id))).toEqual(
      new Set([ids.mcq1Id, ids.tf2Id]),
    );

    const racePath = `/api/v1/saved-questions/${ids.mcq2Id}`;
    await api()
      .post(racePath)
      .set('Authorization', auth(tokens.studentA))
      .send({ note: 'سباق' })
      .expect(201);
    const [raceUpdate, raceDelete] = await Promise.all([
      api()
        .patch(racePath)
        .set('Authorization', auth(tokens.studentA))
        .send({ note: 'تحديث' }),
      api().delete(racePath).set('Authorization', auth(tokens.studentA)),
    ]);
    expect([200, 404]).toContain(raceUpdate.status);
    expect(raceDelete.status).toBe(200);
    expect(
      await prisma.savedQuestion.count({
        where: { userId: ids.studentAId, questionId: ids.mcq2Id },
      }),
    ).toBe(0);

    await api()
      .delete(savePath)
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    await api()
      .delete(savePath)
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect(await prisma.question.count({ where: { id: ids.mcq1Id } })).toBe(1);
  });

  it('reconciles corrupted aggregates and hides content without deleting history', async () => {
    await prisma.studentQuestionProgress.update({
      where: {
        userId_questionId: {
          userId: ids.studentAId,
          questionId: ids.tf1Id,
        },
      },
      data: { attemptsCount: 999, wrongCount: 999, averageTimeMs: 999999 },
    });
    await reconciliation.rebuildUserProgress(ids.studentAId);
    expect(
      await prisma.studentQuestionProgress.findUniqueOrThrow({
        where: {
          userId_questionId: {
            userId: ids.studentAId,
            questionId: ids.tf1Id,
          },
        },
      }),
    ).toMatchObject({
      attemptsCount: 1,
      correctCount: 0,
      wrongCount: 1,
      averageTimeMs: 1000,
    });

    await prisma.studentLessonProgress.update({
      where: {
        userId_lessonId: {
          userId: ids.studentAId,
          lessonId: ids.lessonId,
        },
      },
      data: { answeredQuestions: 999, accuracyPercent: 0 },
    });
    await reconciliation.rebuildUserProgress(ids.studentAId);
    const repairedLesson = await prisma.studentLessonProgress.findUniqueOrThrow(
      {
        where: {
          userId_lessonId: {
            userId: ids.studentAId,
            lessonId: ids.lessonId,
          },
        },
      },
    );
    expect(repairedLesson.answeredQuestions).toBe(4);
    expect(Number(repairedLesson.accuracyPercent)).toBe(75);

    await prisma.question.update({
      where: { id: ids.tf2Id },
      data: { isPublished: false },
    });
    const hiddenList = await api()
      .get('/api/v1/saved-questions')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect(
      (
        hiddenList.body as DataResponse<Array<{ question: { id: string } }>>
      ).data.map((item) => item.question.id),
    ).not.toContain(ids.tf2Id);
    expect(
      await prisma.savedQuestion.count({
        where: { userId: ids.studentAId, questionId: ids.tf2Id },
      }),
    ).toBe(1);
    expect(
      await prisma.studentQuestionProgress.count({
        where: { userId: ids.studentAId, questionId: ids.tf2Id },
      }),
    ).toBe(1);
  });

  it('validates UUIDs and exposes Health and documented Progress collections', async () => {
    await api()
      .get('/api/v1/mistakes/not-a-uuid')
      .set('Authorization', auth(tokens.studentA))
      .expect(400);
    await api().get('/api/v1/health').expect(200);
    const swagger = await api().get('/api/docs-json').expect(200);
    const paths = (swagger.body as { paths: Record<string, unknown> }).paths;
    for (const path of [
      '/api/v1/mistakes',
      '/api/v1/mistakes/{questionId}',
      '/api/v1/mistakes/quiz',
      '/api/v1/mistakes/{questionId}/mark-mastered',
      '/api/v1/saved-questions',
      '/api/v1/saved-questions/{questionId}',
      '/api/v1/saved-questions/quiz',
    ])
      expect(paths).toHaveProperty(path);
    await api().get('/api/docs').expect(200);
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    await prisma.quizAttempt.deleteMany({
      where: {
        userId: { in: [ids.studentAId, ids.studentBId].filter(Boolean) },
      },
    });
    await prisma.question.deleteMany({
      where: {
        id: {
          in: [ids.mcq1Id, ids.tf1Id, ids.tf2Id, ids.mcq2Id].filter(Boolean),
        },
      },
    });
    if (ids.lessonId)
      await prisma.lesson.deleteMany({ where: { id: ids.lessonId } });
    if (ids.unitId) await prisma.unit.deleteMany({ where: { id: ids.unitId } });
    if (ids.subjectId)
      await prisma.subject.deleteMany({ where: { id: ids.subjectId } });
    if (ids.curriculumId || ids.gradeId)
      await prisma.curriculumGrade.deleteMany({
        where: {
          OR: [{ curriculumId: ids.curriculumId }, { gradeId: ids.gradeId }],
        },
      });
    if (ids.curriculumId)
      await prisma.curriculum.deleteMany({ where: { id: ids.curriculumId } });
    if (ids.gradeId)
      await prisma.grade.deleteMany({ where: { id: ids.gradeId } });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [ids.adminId, ids.studentAId, ids.studentBId].filter(Boolean),
        },
      },
    });
    await app.close();
  });
});
