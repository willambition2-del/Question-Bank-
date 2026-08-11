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
  QuestionDifficulty,
  QuestionReviewStatus,
  QuestionType,
  QuizAttemptStatus,
  QuizScope,
  UserRole,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponse {
  tokens: { accessToken: string };
}
interface DataResponse<T> {
  data: T;
}

describe('Statistics and Recommendations PostgreSQL hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const password = 'Password123';
  const api = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hash(password);
    for (const key of ['studentA', 'studentB'] as const) {
      const username = `analytics_${key.toLowerCase()}_${suffix}`;
      const user = await prisma.user.create({
        data: {
          name: `Analytics ${key}`,
          username,
          passwordHash,
          role: UserRole.STUDENT,
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
        name: `Analytics Grade ${suffix}`,
        slug: `analytics-grade-${suffix}`,
      },
    });
    const curriculum = await prisma.curriculum.create({
      data: {
        name: `Analytics Curriculum ${suffix}`,
        slug: `analytics-curriculum-${suffix}`,
        countryCode: 'YE',
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
        name: `Analytics Physics ${suffix}`,
        slug: `analytics-physics-${suffix}`,
        isPublished: true,
      },
    });
    const unit = await prisma.unit.create({
      data: {
        subjectId: subject.id,
        name: `Analytics Unit ${suffix}`,
        slug: `analytics-unit-${suffix}`,
        isPublished: true,
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        name: `Analytics Lesson ${suffix}`,
        slug: `analytics-lesson-${suffix}`,
        isPublished: true,
      },
    });
    const question = await prisma.question.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        lessonId: lesson.id,
        type: QuestionType.TRUE_FALSE,
        questionText: `Analytics question ${suffix}`,
        correctBoolean: true,
        difficulty: QuestionDifficulty.HARD,
        reviewStatus: QuestionReviewStatus.READY,
        isPublished: true,
      },
    });
    Object.assign(ids, {
      subjectId: subject.id,
      unitId: unit.id,
      lessonId: lesson.id,
      questionId: question.id,
    });

    const now = new Date();
    const date = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    await prisma.studentQuestionProgress.create({
      data: {
        userId: ids.studentAId,
        questionId: question.id,
        attemptsCount: 3,
        correctCount: 1,
        wrongCount: 2,
        consecutiveWrong: 2,
        masteryScore: 30,
        averageTimeMs: 30000,
        firstAnsweredAt: now,
        lastAnsweredAt: now,
        lastWrongAt: now,
      },
    });
    await prisma.studentLessonProgress.create({
      data: {
        userId: ids.studentAId,
        lessonId: lesson.id,
        answeredQuestions: 3,
        correctAnswers: 1,
        wrongAnswers: 2,
        accuracyPercent: 33.33,
        masteryPercent: 30,
        averageTimeMs: 30000,
        lastActivityAt: now,
      },
    });
    await prisma.studentUnitProgress.create({
      data: {
        userId: ids.studentAId,
        unitId: unit.id,
        answeredQuestions: 3,
        correctAnswers: 1,
        wrongAnswers: 2,
        accuracyPercent: 33.33,
        masteryPercent: 30,
        averageTimeMs: 30000,
        lastActivityAt: now,
      },
    });
    await prisma.studentSubjectProgress.create({
      data: {
        userId: ids.studentAId,
        subjectId: subject.id,
        answeredQuestions: 3,
        correctAnswers: 1,
        wrongAnswers: 2,
        accuracyPercent: 33.33,
        masteryPercent: 30,
        averageTimeMs: 30000,
        lastActivityAt: now,
      },
    });
    await prisma.studentDailyActivity.create({
      data: {
        userId: ids.studentAId,
        date,
        answeredQuestions: 3,
        correctAnswers: 1,
        wrongAnswers: 2,
        quizzesCompleted: 1,
        studyTimeSeconds: 90,
      },
    });
    await prisma.quizAttempt.create({
      data: {
        userId: ids.studentAId,
        scope: QuizScope.LESSON,
        subjectId: subject.id,
        unitId: unit.id,
        lessonId: lesson.id,
        status: QuizAttemptStatus.COMPLETED,
        questionCount: 1,
        correctCount: 1,
        scorePercent: 100,
        completedAt: now,
        settings: {},
      },
    });
  });

  it('returns persisted dashboard, time, performance, and question analytics', async () => {
    const overview = await api()
      .get('/api/v1/statistics/overview?range=all')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect(
      (overview.body as DataResponse<Record<string, number>>).data,
    ).toMatchObject({
      totalAttempts: 3,
      totalQuestions: 1,
      totalAvailableQuestions: 1,
      totalCorrect: 1,
      totalWrong: 2,
      studyTimeSeconds: 90,
      masteryPercent: 0,
    });

    const time = await api()
      .get('/api/v1/statistics/time-analytics?range=all')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect(
      (time.body as DataResponse<{ totals: { answeredQuestions: number } }>)
        .data.totals.answeredQuestions,
    ).toBe(3);

    const performance = await api()
      .get('/api/v1/statistics/performance')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect(
      (
        performance.body as DataResponse<{
          weakLessons: Array<{ id: string }>;
        }>
      ).data.weakLessons[0]?.id,
    ).toBe(ids.lessonId);

    const questions = await api()
      .get('/api/v1/statistics/questions?range=all')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect(
      (
        questions.body as DataResponse<{
          difficultyDistribution: Record<string, number>;
          mistakeFrequency: Array<{ questionId: string }>;
        }>
      ).data,
    ).toMatchObject({
      difficultyDistribution: { HARD: 3 },
      mistakeFrequency: [{ questionId: ids.questionId }],
    });
  });

  it('returns explainable owner-scoped recommendations and actions', async () => {
    const weaknesses = await api()
      .get(`/api/v1/recommendations/weaknesses?subjectId=${ids.subjectId}`)
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    const rows = (
      weaknesses.body as DataResponse<
        Array<{ question: { id: string }; reason: string }>
      >
    ).data;
    expect(rows[0]?.question.id).toBe(ids.questionId);
    expect(rows[0]?.reason).toContain('incorrect answers');
    expect(JSON.stringify(rows)).not.toContain('correctBoolean');

    const actions = await api()
      .get(`/api/v1/recommendations/actions?subjectId=${ids.subjectId}`)
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect(
      (
        actions.body as DataResponse<
          Array<{ type: string; reason: string; priority: number }>
        >
      ).data.map((item) => item.type),
    ).toEqual(
      expect.arrayContaining([
        'REVIEW_LESSON',
        'TAKE_UNIT_QUIZ',
        'FOCUS_SUBJECT',
      ]),
    );

    const other = await api()
      .get('/api/v1/recommendations/weaknesses')
      .set('Authorization', auth(tokens.studentB))
      .expect(200);
    expect((other.body as DataResponse<unknown[]>).data).toEqual([]);
  });

  it('rejects hidden scopes and documents all hardened routes', async () => {
    await prisma.subject.update({
      where: { id: ids.subjectId },
      data: { isPublished: false },
    });
    await api()
      .get(`/api/v1/recommendations?subjectId=${ids.subjectId}`)
      .set('Authorization', auth(tokens.studentA))
      .expect(404);
    await prisma.subject.update({
      where: { id: ids.subjectId },
      data: { isPublished: true },
    });

    const swagger = await api().get('/api/docs-json').expect(200);
    const paths = (swagger.body as { paths: Record<string, unknown> }).paths;
    for (const path of [
      '/api/v1/statistics/overview',
      '/api/v1/statistics/performance',
      '/api/v1/statistics/questions',
      '/api/v1/statistics/time-analytics',
      '/api/v1/recommendations/actions',
    ]) {
      expect(paths).toHaveProperty(path);
    }
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    await prisma.quizAttempt.deleteMany({
      where: {
        userId: { in: [ids.studentAId, ids.studentBId].filter(Boolean) },
      },
    });
    if (ids.questionId)
      await prisma.question.deleteMany({ where: { id: ids.questionId } });
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
        id: { in: [ids.studentAId, ids.studentBId].filter(Boolean) },
      },
    });
    await app.close();
  });
});
