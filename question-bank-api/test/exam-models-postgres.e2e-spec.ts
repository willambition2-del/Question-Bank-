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
  QuestionReviewStatus,
  QuestionType,
  SourceType,
  UserRole,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponse {
  tokens: { accessToken: string };
}
interface DataResponse {
  data: Record<string, unknown>;
}

const codeOf = (body: unknown) => (body as { code?: string }).code;

describe('Exam models PostgreSQL hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const password = 'Password123';
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const auth = (token: string) => `Bearer ${token}`;
  const adminPost = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', auth(tokens.admin));

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['admin', UserRole.ADMIN],
      ['reviewer', UserRole.REVIEWER],
      ['student', UserRole.STUDENT],
    ] as const) {
      const username = `exam_${key}_${suffix}`;
      const user = await prisma.user.create({
        data: {
          name: `Exam ${key}`,
          username,
          passwordHash,
          role,
          companion: CompanionType.MALE,
        },
      });
      ids[`${key}Id`] = user.id;
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: username, password })
        .expect(200);
      tokens[key] = (login.body as AuthResponse).tokens.accessToken;
    }

    const grade = await prisma.grade.create({
      data: {
        name: `Exam Grade ${suffix}`,
        slug: `exam-grade-${suffix}`,
        isActive: true,
      },
    });
    const curriculum = await prisma.curriculum.create({
      data: {
        name: `Exam Curriculum ${suffix}`,
        slug: `exam-curriculum-${suffix}`,
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
        name: `Exam Physics ${suffix}`,
        slug: `exam-physics-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    const otherSubject = await prisma.subject.create({
      data: {
        curriculumId: curriculum.id,
        gradeId: grade.id,
        name: `Exam Chemistry ${suffix}`,
        slug: `exam-chemistry-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    ids.subjectId = subject.id;
    ids.otherSubjectId = otherSubject.id;
    const unit = await prisma.unit.create({
      data: {
        subjectId: subject.id,
        name: `Motion ${suffix}`,
        slug: `motion-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        name: `Newton ${suffix}`,
        slug: `newton-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    ids.unitId = unit.id;
    ids.lessonId = lesson.id;
    const source = await prisma.source.create({
      data: {
        name: `Ministry ${suffix}`,
        type: SourceType.MINISTRY_EXAM,
        year: 2026,
        isOfficial: true,
        isActive: true,
      },
    });
    ids.sourceId = source.id;

    const q1 = await prisma.question.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        lessonId: lesson.id,
        sourceId: source.id,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: `Exam force question ${suffix}`,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
        correctBoolean: null,
        explanationShort: 'secret explanation',
        fingerprint: `exam-fp-${suffix}`,
        options: {
          create: [
            { optionText: 'Newton', sortOrder: 0, isCorrect: true },
            {
              optionText: 'Joule',
              sortOrder: 1,
              isCorrect: false,
              whyWrong: 'secret reason',
            },
          ],
        },
      },
    });
    const q2 = await prisma.question.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        lessonId: lesson.id,
        type: QuestionType.TRUE_FALSE,
        questionText: `Exam vector question ${suffix}`,
        correctBoolean: true,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
      },
    });
    const draft = await prisma.question.create({
      data: {
        subjectId: subject.id,
        type: QuestionType.TRUE_FALSE,
        questionText: `Exam draft ${suffix}`,
        correctBoolean: false,
        reviewStatus: QuestionReviewStatus.DRAFT,
        isActive: true,
        isPublished: false,
      },
    });
    const foreign = await prisma.question.create({
      data: {
        subjectId: otherSubject.id,
        type: QuestionType.TRUE_FALSE,
        questionText: `Exam foreign ${suffix}`,
        correctBoolean: true,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
      },
    });
    ids.q1 = q1.id;
    ids.q2 = q2.id;
    ids.draft = draft.id;
    ids.foreign = foreign.id;
  });

  it('enforces auth, DTO validation, creation, uniqueness, filters, and pre-publication hiding', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/exam-models')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/admin/exam-models')
      .set('Authorization', auth(tokens.student))
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/admin/exam-models')
      .set('Authorization', auth(tokens.reviewer))
      .send({})
      .expect(403);

    await adminPost('/api/v1/admin/exam-models')
      .send({
        subjectId: ids.subjectId,
        title: 'x',
        slug: 'Invalid Slug',
        durationMinutes: 0,
      })
      .expect(400);

    const created = await adminPost('/api/v1/admin/exam-models')
      .send({
        subjectId: ids.subjectId,
        sourceId: ids.sourceId,
        title: `Ministry Exam ${suffix}`,
        slug: `ministry-exam-${suffix}`,
        year: 2026,
        governorate: 'Sanaa',
        description: 'A hardened exam model',
        durationMinutes: 120,
        isOfficial: true,
        sortOrder: 7,
      })
      .expect(201);
    const data = (created.body as DataResponse).data;
    ids.examId = data.id as string;
    expect(data).toMatchObject({
      isPublished: false,
      questionsCount: 0,
      totalPoints: 0,
    });

    const duplicate = await adminPost('/api/v1/admin/exam-models')
      .send({
        subjectId: ids.subjectId,
        title: 'Duplicate',
        slug: `ministry-exam-${suffix}`,
        durationMinutes: 60,
      })
      .expect(409);
    expect(codeOf(duplicate.body)).toBe('EXAM_MODEL_SLUG_EXISTS');

    const listing = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/exam-models?subjectId=${ids.subjectId}&year=2026&isOfficial=true&isPublished=false&sort=title_asc`,
      )
      .set('Authorization', auth(tokens.admin))
      .expect(200);
    expect(
      (listing.body as { data: Array<{ id: string }> }).data.some(
        (item) => item.id === ids.examId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get('/api/v1/exam-models')
      .set('Authorization', auth(tokens.student))
      .expect(200)
      .expect(({ body }) => {
        expect(
          (body as { data: Array<{ id: string }> }).data.some(
            (item) => item.id === ids.examId,
          ),
        ).toBe(false);
      });
    await request(app.getHttpServer())
      .get(`/api/v1/exam-models/${ids.examId}`)
      .set('Authorization', auth(tokens.student))
      .expect(404);
    const emptyPublish = await adminPost(
      `/api/v1/admin/exam-models/${ids.examId}/publish`,
    ).expect(400);
    expect(codeOf(emptyPublish.body)).toBe('EXAM_MODEL_EMPTY');
  });

  it('enforces membership readiness, subject, uniqueness, points, bulk atomicity, and reorder', async () => {
    await adminPost(`/api/v1/admin/exam-models/${ids.examId}/questions`)
      .send({ questionId: ids.q1, sortOrder: 0, points: 2.5 })
      .expect(201);

    const duplicate = await adminPost(
      `/api/v1/admin/exam-models/${ids.examId}/questions`,
    )
      .send({ questionId: ids.q1, sortOrder: 1, points: 1 })
      .expect(409);
    expect(codeOf(duplicate.body)).toBe('EXAM_MODEL_QUESTION_ALREADY_EXISTS');

    const sortConflict = await adminPost(
      `/api/v1/admin/exam-models/${ids.examId}/questions`,
    )
      .send({ questionId: ids.q2, sortOrder: 0, points: 1 })
      .expect(409);
    expect(codeOf(sortConflict.body)).toBe('EXAM_MODEL_SORT_ORDER_CONFLICT');

    const notReady = await adminPost(
      `/api/v1/admin/exam-models/${ids.examId}/questions`,
    )
      .send({ questionId: ids.draft, sortOrder: 3, points: 1 })
      .expect(400);
    expect(codeOf(notReady.body)).toBe('EXAM_MODEL_QUESTION_NOT_READY');

    const mismatch = await adminPost(
      `/api/v1/admin/exam-models/${ids.examId}/questions`,
    )
      .send({ questionId: ids.foreign, sortOrder: 3, points: 1 })
      .expect(400);
    expect(codeOf(mismatch.body)).toBe('EXAM_MODEL_QUESTION_SUBJECT_MISMATCH');

    await adminPost(`/api/v1/admin/exam-models/${ids.examId}/questions`)
      .send({ questionId: ids.q2, sortOrder: 2, points: 0 })
      .expect(400);

    const bulk = await adminPost(
      `/api/v1/admin/exam-models/${ids.examId}/questions/bulk`,
    )
      .send({ questions: [{ questionId: ids.q2, sortOrder: 2, points: 1.5 }] })
      .expect(201);
    expect((bulk.body as DataResponse).data).toEqual({
      examModelId: ids.examId,
      addedCount: 1,
      totalQuestions: 2,
    });

    await adminPost(`/api/v1/admin/exam-models/${ids.examId}/questions/bulk`)
      .send({
        questions: [
          { questionId: ids.draft, sortOrder: 4 },
          { questionId: ids.foreign, sortOrder: 5 },
        ],
      })
      .expect(400);
    expect(
      await prisma.examModelQuestion.count({
        where: { examModelId: ids.examId },
      }),
    ).toBe(2);

    const reordered = await request(app.getHttpServer())
      .patch(`/api/v1/admin/exam-models/${ids.examId}/questions/reorder`)
      .set('Authorization', auth(tokens.admin))
      .send({
        items: [
          { questionId: ids.q1, sortOrder: 2 },
          { questionId: ids.q2, sortOrder: 0 },
        ],
      })
      .expect(200);
    const questions = (reordered.body as DataResponse).data.questions as Array<{
      question: { id: string };
      sortOrder: number;
    }>;
    expect(questions.map((item) => [item.question.id, item.sortOrder])).toEqual(
      [
        [ids.q2, 0],
        [ids.q1, 2],
      ],
    );

    const duplicateOrder = await request(app.getHttpServer())
      .patch(`/api/v1/admin/exam-models/${ids.examId}/questions/reorder`)
      .set('Authorization', auth(tokens.admin))
      .send({
        items: [
          { questionId: ids.q1, sortOrder: 1 },
          { questionId: ids.q2, sortOrder: 1 },
        ],
      })
      .expect(409);
    expect(codeOf(duplicateOrder.body)).toBe('EXAM_MODEL_SORT_ORDER_CONFLICT');
  });

  it('publishes safely, exposes no answers, and forbids published mutation', async () => {
    const published = await adminPost(
      `/api/v1/admin/exam-models/${ids.examId}/publish`,
    ).expect(201);
    expect((published.body as DataResponse).data.isPublished).toBe(true);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/exam-models?subjectId=${ids.subjectId}&sort=sort_order`)
      .set('Authorization', auth(tokens.student))
      .expect(200);
    const listItem = (
      list.body as { data: Array<Record<string, unknown>> }
    ).data.find((item) => item.id === ids.examId);
    expect(listItem).toMatchObject({ questionsCount: 2, totalPoints: 4 });
    expect(listItem).not.toHaveProperty('isPublished');
    expect(listItem).not.toHaveProperty('deletedAt');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/exam-models/${ids.examId}`)
      .set('Authorization', auth(tokens.student))
      .expect(200);
    const safe = (detail.body as DataResponse).data;
    expect(safe).toMatchObject({ questionsCount: 2, totalPoints: 4 });
    const questions = safe.questions as Array<{
      sortOrder: number;
      question: Record<string, unknown>;
    }>;
    expect(questions.map((item) => item.sortOrder)).toEqual([0, 2]);
    for (const item of questions) {
      expect(item.question).not.toHaveProperty('correctBoolean');
      expect(item.question).not.toHaveProperty('explanationShort');
      expect(item.question).not.toHaveProperty('fingerprint');
      expect(item.question).not.toHaveProperty('reviewStatus');
      for (const option of (item.question.options ?? []) as Array<
        Record<string, unknown>
      >) {
        expect(option).not.toHaveProperty('isCorrect');
        expect(option).not.toHaveProperty('whyWrong');
      }
    }

    await prisma.question.update({
      where: { id: ids.q1 },
      data: { isPublished: false },
    });
    const filtered = await request(app.getHttpServer())
      .get(`/api/v1/exam-models/${ids.examId}`)
      .set('Authorization', auth(tokens.student))
      .expect(200);
    expect((filtered.body as DataResponse).data).toMatchObject({
      questionsCount: 1,
      totalPoints: 1.5,
    });
    const adminWarning = await request(app.getHttpServer())
      .get(`/api/v1/admin/exam-models/${ids.examId}`)
      .set('Authorization', auth(tokens.admin))
      .expect(200);
    expect(
      ((adminWarning.body as DataResponse).data.warnings as string[]).some(
        (warning) => warning.includes('QUESTION_NOT_PUBLISHED'),
      ),
    ).toBe(true);
    await prisma.question.update({
      where: { id: ids.q1 },
      data: { isPublished: true },
    });

    const blockedActions = [
      () =>
        request(app.getHttpServer())
          .patch(`/api/v1/admin/exam-models/${ids.examId}`)
          .send({ title: 'Blocked' }),
      () =>
        request(app.getHttpServer())
          .post(`/api/v1/admin/exam-models/${ids.examId}/questions`)
          .send({ questionId: ids.draft }),
      () =>
        request(app.getHttpServer()).delete(
          `/api/v1/admin/exam-models/${ids.examId}/questions/${ids.q1}`,
        ),
      () =>
        request(app.getHttpServer())
          .patch(`/api/v1/admin/exam-models/${ids.examId}/questions/reorder`)
          .send({ items: [{ questionId: ids.q1, sortOrder: 1 }] }),
    ];
    for (const makeRequest of blockedActions) {
      const response = await makeRequest()
        .set('Authorization', auth(tokens.admin))
        .expect(409);
      expect(codeOf(response.body)).toBe(
        'EXAM_MODEL_PUBLISHED_MODIFICATION_FORBIDDEN',
      );
    }
  });

  it('enforces current parent visibility, unpublish/remove policy, soft delete/restore, and Swagger routes', async () => {
    await prisma.subject.update({
      where: { id: ids.subjectId },
      data: { isPublished: false },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/exam-models/${ids.examId}`)
      .set('Authorization', auth(tokens.student))
      .expect(404);
    const hiddenList = await request(app.getHttpServer())
      .get('/api/v1/exam-models')
      .set('Authorization', auth(tokens.student))
      .expect(200);
    expect(
      (hiddenList.body as { data: Array<{ id: string }> }).data.some(
        (item) => item.id === ids.examId,
      ),
    ).toBe(false);
    await prisma.subject.update({
      where: { id: ids.subjectId },
      data: { isPublished: true },
    });
    await prisma.source.update({
      where: { id: ids.sourceId },
      data: { isActive: false },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/exam-models/${ids.examId}`)
      .set('Authorization', auth(tokens.student))
      .expect(404);
    await prisma.source.update({
      where: { id: ids.sourceId },
      data: { isActive: true },
    });

    await adminPost(`/api/v1/admin/exam-models/${ids.examId}/unpublish`).expect(
      201,
    );
    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/admin/exam-models/${ids.examId}/questions/${ids.q2}`)
      .set('Authorization', auth(tokens.admin))
      .expect(200);
    expect((removed.body as DataResponse).data).toMatchObject({
      removedQuestionId: ids.q2,
      totalQuestions: 1,
    });
    const missing = await request(app.getHttpServer())
      .delete(`/api/v1/admin/exam-models/${ids.examId}/questions/${ids.q2}`)
      .set('Authorization', auth(tokens.admin))
      .expect(404);
    expect(codeOf(missing.body)).toBe('EXAM_MODEL_QUESTION_NOT_FOUND');

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/exam-models/${ids.examId}`)
      .set('Authorization', auth(tokens.admin))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/exam-models/${ids.examId}`)
      .set('Authorization', auth(tokens.student))
      .expect(404);
    const restored = await adminPost(
      `/api/v1/admin/exam-models/${ids.examId}/restore`,
    ).expect(201);
    expect((restored.body as DataResponse).data).toMatchObject({
      isPublished: false,
      deletedAt: null,
    });
    expect(
      await prisma.examModelQuestion.count({
        where: { examModelId: ids.examId },
      }),
    ).toBe(1);

    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const swagger = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const paths = (swagger.body as { paths: Record<string, unknown> }).paths;
    for (const path of [
      '/api/v1/exam-models',
      '/api/v1/exam-models/{id}',
      '/api/v1/admin/exam-models',
      '/api/v1/admin/exam-models/{id}/questions/bulk',
      '/api/v1/admin/exam-models/{id}/questions/reorder',
      '/api/v1/admin/exam-models/{id}/publish',
    ])
      expect(paths).toHaveProperty(path);
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    if (ids.examId)
      await prisma.examModel.deleteMany({ where: { id: ids.examId } });
    await prisma.question.deleteMany({
      where: {
        id: { in: [ids.q1, ids.q2, ids.draft, ids.foreign].filter(Boolean) },
      },
    });
    if (ids.lessonId)
      await prisma.lesson.deleteMany({ where: { id: ids.lessonId } });
    if (ids.unitId) await prisma.unit.deleteMany({ where: { id: ids.unitId } });
    if (ids.sourceId)
      await prisma.source.deleteMany({ where: { id: ids.sourceId } });
    await prisma.subject.deleteMany({
      where: {
        id: { in: [ids.subjectId, ids.otherSubjectId].filter(Boolean) },
      },
    });
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
          in: [ids.adminId, ids.reviewerId, ids.studentId].filter(Boolean),
        },
      },
    });
    await app.close();
  });
});
