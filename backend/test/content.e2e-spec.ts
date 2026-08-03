import { INestApplication, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { QuestionsService } from '../src/content/questions/questions.service';
import { ReadingPassagesService } from '../src/content/reading-passages/reading-passages.service';
import { SourcesService } from '../src/content/sources/sources.service';
import type { User } from '../src/generated/prisma/client';
import {
  CompanionType,
  QuestionReviewStatus,
  QuestionType,
  SourceType,
  UserRole,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { QuizAttemptsService } from '../src/quiz/quiz-attempts.service';
import { UsersService } from '../src/users/users.service';
jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-07-17T00:00:00.000Z');
const makeUser = (id: string, username: string, role: UserRole): User => ({
  id,
  name: username,
  username,
  phone: null,
  passwordHash: 'not-used',
  refreshTokenHash: null,
  lastLoginAt: null,
  tokenVersion: 0,
  passwordChangedAt: null,
  role,
  companion: CompanionType.MALE,
  schoolName: null,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
});

describe('Content phase B (e2e)', () => {
  let app: INestApplication<App>;
  let creatorToken: string;
  let reviewerToken: string;
  let studentToken: string;
  let sourceId: string;
  let questionId: string;
  let question: Record<string, unknown> | undefined;

  const sourcesService = {
    create: jest.fn((dto: Record<string, unknown>) => {
      const source = { id: randomUUID(), ...dto, deletedAt: null };
      return Promise.resolve(source);
    }),
  };
  const questionsService = {
    create: jest.fn((actorId: string, dto: Record<string, unknown>) => {
      question = {
        id: randomUUID(),
        ...dto,
        createdById: actorId,
        reviewStatus: QuestionReviewStatus.DRAFT,
        isActive: true,
        isPublished: false,
        correctBoolean: null,
      };
      return Promise.resolve(question);
    }),
    submitReview: jest.fn(() => {
      question = {
        ...question,
        reviewStatus: QuestionReviewStatus.REVIEW_REQUIRED,
      };
      return Promise.resolve(question);
    }),
    approve: jest.fn(() => {
      question = { ...question, reviewStatus: QuestionReviewStatus.READY };
      return Promise.resolve(question);
    }),
    publish: jest.fn(() => {
      question = { ...question, isPublished: true };
      return Promise.resolve(question);
    }),
    getStudent: jest.fn(() => {
      if (!question || question.isPublished !== true) {
        throw new NotFoundException();
      }
      const rawOptions = question.options as Array<Record<string, unknown>>;
      return Promise.resolve({
        id: question.id,
        subjectId: question.subjectId,
        type: question.type,
        questionText: question.questionText,
        options: rawOptions.map((option) => ({
          id: option.id ?? randomUUID(),
          optionText: option.optionText,
          sortOrder: option.sortOrder,
        })),
      });
    }),
  };
  const quizAttemptsService = {
    create: jest.fn(() =>
      Promise.resolve({
        attempt: {
          id: randomUUID(),
          scope: 'SUBJECT',
          status: 'IN_PROGRESS',
          questionCount: 1,
        },
        questions: [
          {
            id: questionId,
            questionText: 'Safe quiz question',
            type: QuestionType.MULTIPLE_CHOICE,
            options: [{ id: randomUUID(), optionText: 'Option', sortOrder: 0 }],
          },
        ],
      }),
    ),
  };

  beforeAll(async () => {
    const creator = makeUser(
      '70000000-0000-4000-8000-000000000001',
      'creator_admin',
      UserRole.ADMIN,
    );
    const reviewer = makeUser(
      '70000000-0000-4000-8000-000000000002',
      'reviewer_admin',
      UserRole.ADMIN,
    );
    const student = makeUser(
      '70000000-0000-4000-8000-000000000003',
      'content_student',
      UserRole.STUDENT,
    );
    const users = new Map([
      [creator.id, creator],
      [reviewer.id, reviewer],
      [student.id, student],
    ]);
    const secret = 'content-e2e-access-secret';
    const config = new ConfigService({
      API_PREFIX: 'api/v1',
      JWT_ACCESS_SECRET: secret,
      JWT_REFRESH_SECRET: 'content-e2e-refresh-secret',
    });
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]) })
      .overrideProvider(UsersService)
      .useValue({
        findById: (id: string) => Promise.resolve(users.get(id) ?? null),
      })
      .overrideProvider(SourcesService)
      .useValue(sourcesService)
      .overrideProvider(ReadingPassagesService)
      .useValue({})
      .overrideProvider(QuestionsService)
      .useValue(questionsService)
      .overrideProvider(QuizAttemptsService)
      .useValue(quizAttemptsService)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    const jwt = new JwtService();
    const sign = (user: User) =>
      jwt.signAsync(
        {
          sub: user.id,
          role: user.role,
          username: user.username,
          tokenVersion: 0,
        },
        { secret, expiresIn: '15m' },
      );
    [creatorToken, reviewerToken, studentToken] = await Promise.all([
      sign(creator),
      sign(reviewer),
      sign(student),
    ]);
  });

  it('allows an admin to create a source', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/sources')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        name: 'اختبار وزاري',
        type: SourceType.MINISTRY_EXAM,
        year: 2025,
        isOfficial: true,
      })
      .expect(201);
    sourceId = (response.body as { data: { id: string } }).data.id;
  });

  it('creates, reviews, approves, and publishes an MCQ', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/questions')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        subjectId: '10000000-0000-4000-8000-000000000001',
        sourceId,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: 'ما وحدة قياس القوة؟',
        explanationShort: 'النيوتن.',
        options: [
          { optionText: 'نيوتن', sortOrder: 1, isCorrect: true },
          { optionText: 'جول', sortOrder: 2, isCorrect: false },
        ],
      })
      .expect(201);
    questionId = (created.body as { data: { id: string } }).data.id;
    await request(app.getHttpServer())
      .post(`/api/v1/admin/questions/${questionId}/submit-review`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/questions/${questionId}/approve`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ note: 'مراجعة ناجحة' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/questions/${questionId}/publish`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(201);
  });

  it('never exposes the solution through the student endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/questions/${questionId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const data = (response.body as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty('correctBoolean');
    expect(data).not.toHaveProperty('explanationShort');
    const responseOptions = data.options as Array<Record<string, unknown>>;
    expect(responseOptions[0]).not.toHaveProperty('isCorrect');
    expect(responseOptions[1]).not.toHaveProperty('whyWrong');
  });

  it('creates a quiz attempt without exposing solutions', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/quiz-attempts')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        scope: 'SUBJECT',
        subjectId: '10000000-0000-4000-8000-000000000001',
        questionCount: 1,
      })
      .expect(201);
    const data = (
      response.body as {
        data: { questions: Array<Record<string, unknown>> };
      }
    ).data;
    expect(data.questions[0]).not.toHaveProperty('correctBoolean');
    expect(data.questions[0]).not.toHaveProperty('explanationShort');
    const options = data.questions[0].options as Array<Record<string, unknown>>;
    expect(options[0]).not.toHaveProperty('isCorrect');
  });

  it('rejects a student attempting an admin content route', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/sources')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'غير مسموح', type: SourceType.OTHER })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/admin/question-imports/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('documents content routes in Swagger', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const body = response.body as { paths: Record<string, unknown> };
    expect(body.paths).toHaveProperty('/api/v1/admin/questions');
    expect(body.paths).toHaveProperty('/api/v1/questions/{id}');
    expect(body.paths).toHaveProperty('/api/v1/admin/reading-passages');
    expect(body.paths).toHaveProperty('/api/v1/exam-models');
    expect(body.paths).toHaveProperty('/api/v1/exam-models/{id}');
    expect(body.paths).toHaveProperty('/api/v1/admin/exam-models');
    expect(body.paths).toHaveProperty('/api/v1/admin/question-imports/upload');
    expect(body.paths).toHaveProperty(
      '/api/v1/admin/question-imports/{id}/execute',
    );
    expect(body.paths).toHaveProperty('/api/v1/quiz-attempts');
    expect(body.paths).toHaveProperty(
      '/api/v1/quiz-attempts/{attemptId}/answers',
    );
    expect(body.paths).toHaveProperty(
      '/api/v1/quiz-attempts/{attemptId}/result',
    );
    expect(body.paths).toHaveProperty('/api/v1/mistakes');
    expect(body.paths).toHaveProperty(
      '/api/v1/mistakes/{questionId}/mark-mastered',
    );
    expect(body.paths).toHaveProperty('/api/v1/saved-questions');
    expect(body.paths).toHaveProperty('/api/v1/saved-questions/{questionId}');
    expect(body.paths).toHaveProperty('/api/v1/statistics/overview');
    expect(body.paths).toHaveProperty('/api/v1/statistics/accuracy-trend');
    expect(body.paths).toHaveProperty('/api/v1/statistics/heatmap');
    expect(body.paths).toHaveProperty('/api/v1/recommendations');
    expect(body.paths).toHaveProperty('/api/v1/recommendations/weaknesses');
    expect(body.paths).toHaveProperty('/api/v1/recommendations/lessons');
    expect(body.paths).toHaveProperty('/api/v1/recommendations/weakness-quiz');
    expect(body.paths).toHaveProperty('/api/v1/gamification/points');
    expect(body.paths).toHaveProperty('/api/v1/gamification/points/history');
    expect(body.paths).toHaveProperty('/api/v1/achievements');
    expect(body.paths).toHaveProperty('/api/v1/achievements/my');
    expect(body.paths).toHaveProperty('/api/v1/daily-tasks/today');
    expect(body.paths).toHaveProperty('/api/v1/daily-tasks/{id}/claim');
    expect(body.paths).toHaveProperty('/api/v1/leaderboards');
    expect(body.paths).toHaveProperty('/api/v1/leaderboards/me');
    expect(body.paths).toHaveProperty('/api/v1/updates');
    expect(body.paths).toHaveProperty('/api/v1/admin/updates');
    expect(body.paths).toHaveProperty('/api/v1/notifications');
    expect(body.paths).toHaveProperty('/api/v1/notifications/unread-count');
    expect(body.paths).toHaveProperty('/api/v1/notifications/read-all');
    expect(body.paths).toHaveProperty('/api/v1/notifications/{id}/read');
    expect(body.paths).toHaveProperty('/api/v1/challenges/modes');
    expect(body.paths).toHaveProperty('/api/v1/challenges/matchmaking');
    expect(body.paths).toHaveProperty('/api/v1/challenges');
    expect(body.paths).toHaveProperty('/api/v1/challenges/{id}');
    expect(body.paths).toHaveProperty('/api/v1/challenges/{id}/join');
    expect(body.paths).toHaveProperty('/api/v1/challenges/{id}/leave');
    expect(body.paths).toHaveProperty('/api/v1/challenges/{id}/ready');
    expect(body.paths).toHaveProperty('/api/v1/challenges/{id}/result');
    expect(body.paths).toHaveProperty('/api/v1/challenges/{id}/rematch');
  });

  afterAll(async () => app.close());
});
