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
  QuestionType,
  SourceType,
  UserRole,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

interface IdResponse {
  data: { id: string; [key: string]: unknown };
}

interface LoginResponse {
  tokens: { accessToken: string };
}

describe('Question bank PostgreSQL hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const password = 'Password123';
  const ids: Record<string, string | undefined> = {};
  const tokens: Record<string, string> = {};

  const auth = (token: string) => 'Bearer ' + token;
  const post = (path: string, token: string) =>
    request(app.getHttpServer()).post(path).set('Authorization', auth(token));

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
      const username = 'qb_' + key + '_' + suffix;
      const user = await prisma.user.create({
        data: {
          name: 'Question Bank ' + key,
          username,
          passwordHash,
          role,
          companion: CompanionType.MALE,
        },
      });
      ids[key + 'Id'] = user.id;
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: username, password })
        .expect(200);
      tokens[key] = (login.body as LoginResponse).tokens.accessToken;
    }

    const grade = await post('/api/v1/admin/grades', tokens.admin)
      .send({
        name: 'QB Grade ' + suffix,
        slug: 'qb-grade-' + suffix,
        sortOrder: 9100,
      })
      .expect(201);
    ids.gradeId = (grade.body as IdResponse).data.id;

    const curriculum = await post('/api/v1/admin/curricula', tokens.admin)
      .send({
        name: 'QB Curriculum ' + suffix,
        slug: 'qb-curriculum-' + suffix,
        countryCode: 'YE',
      })
      .expect(201);
    ids.curriculumId = (curriculum.body as IdResponse).data.id;

    const subject = await post('/api/v1/admin/subjects', tokens.admin)
      .send({
        curriculumId: ids.curriculumId,
        gradeId: ids.gradeId,
        name: 'الفيزياء ' + suffix,
        slug: 'qb-physics-' + suffix,
      })
      .expect(201);
    ids.subjectId = (subject.body as IdResponse).data.id;
    await post(
      '/api/v1/admin/subjects/' + ids.subjectId + '/publish',
      tokens.admin,
    ).expect(201);

    const unit = await post('/api/v1/admin/units', tokens.admin)
      .send({
        subjectId: ids.subjectId,
        name: 'القوة والحركة ' + suffix,
        slug: 'qb-force-' + suffix,
      })
      .expect(201);
    ids.unitId = (unit.body as IdResponse).data.id;
    await post(
      '/api/v1/admin/units/' + ids.unitId + '/publish',
      tokens.admin,
    ).expect(201);

    const lesson = await post('/api/v1/admin/lessons', tokens.admin)
      .send({
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        name: 'قوانين نيوتن ' + suffix,
        slug: 'qb-newton-' + suffix,
      })
      .expect(201);
    ids.lessonId = (lesson.body as IdResponse).data.id;
    await post(
      '/api/v1/admin/lessons/' + ids.lessonId + '/publish',
      tokens.admin,
    ).expect(201);
  });

  it('enforces review, publication, duplicates, and student-safe responses', async () => {
    const source = await post('/api/v1/admin/sources', tokens.admin)
      .send({
        name: 'اختبار وزارة التربية ' + suffix,
        type: SourceType.MINISTRY_EXAM,
        year: 2026,
        referenceUrl: 'https://example.test/exams/' + suffix,
        isOfficial: true,
      })
      .expect(201);
    ids.sourceId = (source.body as IdResponse).data.id;

    const passage = await post('/api/v1/admin/reading-passages', tokens.admin)
      .send({
        subjectId: ids.subjectId,
        sourceId: ids.sourceId,
        title: 'نص عن قوانين الحركة',
        passageText: 'تصف قوانين نيوتن العلاقة بين القوة والحركة.',
        languageCode: 'ar',
      })
      .expect(201);
    ids.passageId = (passage.body as IdResponse).data.id;
    expect((passage.body as IdResponse).data.isPublished).toBe(false);

    const questionText = 'ما وحدة قياس القوة؟ ' + suffix;
    const main = await post('/api/v1/admin/questions', tokens.admin)
      .send({
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        lessonId: ids.lessonId,
        sourceId: ids.sourceId,
        readingPassageId: ids.passageId,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText,
        explanationDetailed: 'تقاس القوة بوحدة النيوتن.',
        options: [
          { optionText: 'نيوتن', sortOrder: 1, isCorrect: true },
          {
            optionText: 'جول',
            sortOrder: 2,
            isCorrect: false,
            whyWrong: 'الجول وحدة طاقة.',
          },
        ],
      })
      .expect(201);
    ids.mainQuestionId = (main.body as IdResponse).data.id;

    await request(app.getHttpServer())
      .get('/api/v1/questions/' + ids.mainQuestionId)
      .set('Authorization', auth(tokens.student))
      .expect(404);

    await post(
      '/api/v1/admin/questions/' + ids.mainQuestionId + '/submit-review',
      tokens.admin,
    )
      .send({ note: 'جاهز للمراجعة' })
      .expect(201);
    await post(
      '/api/v1/admin/questions/' + ids.mainQuestionId + '/approve',
      tokens.reviewer,
    )
      .send({ note: 'تمت المراجعة' })
      .expect(201);

    await post(
      '/api/v1/admin/questions/' + ids.mainQuestionId + '/publish',
      tokens.admin,
    ).expect(400);

    await post(
      '/api/v1/admin/reading-passages/' + ids.passageId + '/publish',
      tokens.admin,
    ).expect(201);
    await post(
      '/api/v1/admin/questions/' + ids.mainQuestionId + '/publish',
      tokens.admin,
    ).expect(201);

    const studentQuestion = await request(app.getHttpServer())
      .get('/api/v1/questions/' + ids.mainQuestionId)
      .set('Authorization', auth(tokens.student))
      .expect(200);
    const safe = (studentQuestion.body as { data: Record<string, unknown> })
      .data;
    expect(safe).not.toHaveProperty('correctBoolean');
    expect(safe).not.toHaveProperty('explanationShort');
    expect(safe).not.toHaveProperty('explanationDetailed');
    expect(safe).not.toHaveProperty('fingerprint');
    expect(safe).not.toHaveProperty('createdById');
    const options = safe.options as Array<Record<string, unknown>>;
    expect(options[0]).not.toHaveProperty('isCorrect');
    expect(options[1]).not.toHaveProperty('whyWrong');

    const duplicate = await post('/api/v1/admin/questions', tokens.admin)
      .send({
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        lessonId: ids.lessonId,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: '  ما   وحدة قياس القوة؟ ' + suffix + '!! ',
        options: [
          { optionText: 'نيوتن', sortOrder: 1, isCorrect: true },
          { optionText: 'جول', sortOrder: 2, isCorrect: false },
        ],
      })
      .expect(409);
    expect(duplicate.body).toMatchObject({ code: 'QUESTION_DUPLICATE' });
  });

  it('enforces self-approval, rejection resubmission, and question types', async () => {
    const self = await post('/api/v1/admin/questions', tokens.admin)
      .send({
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        lessonId: ids.lessonId,
        type: QuestionType.TRUE_FALSE,
        questionText: 'القوة كمية متجهة ' + suffix,
        correctBoolean: true,
      })
      .expect(201);
    ids.selfQuestionId = (self.body as IdResponse).data.id;

    await post(
      '/api/v1/admin/questions/' + ids.selfQuestionId + '/publish',
      tokens.admin,
    ).expect(400);
    await post(
      '/api/v1/admin/questions/' + ids.selfQuestionId + '/submit-review',
      tokens.admin,
    )
      .send({})
      .expect(201);
    const selfApproval = await post(
      '/api/v1/admin/questions/' + ids.selfQuestionId + '/approve',
      tokens.admin,
    )
      .send({})
      .expect(403);
    expect(selfApproval.body).toMatchObject({
      code: 'QUESTION_SELF_APPROVAL_FORBIDDEN',
    });

    const rejected = await post(
      '/api/v1/admin/questions/' + ids.selfQuestionId + '/reject',
      tokens.reviewer,
    )
      .send({ reason: 'يحتاج إلى صياغة أدق' })
      .expect(201);
    expect((rejected.body as IdResponse).data.rejectionReason).toBe(
      'يحتاج إلى صياغة أدق',
    );

    const edited = await request(app.getHttpServer())
      .patch('/api/v1/admin/questions/' + ids.selfQuestionId)
      .set('Authorization', auth(tokens.admin))
      .send({ questionText: 'القوة الفيزيائية كمية متجهة ' + suffix })
      .expect(200);
    expect((edited.body as IdResponse).data).toMatchObject({
      reviewStatus: 'DRAFT',
      rejectionReason: null,
      isPublished: false,
    });
    await post(
      '/api/v1/admin/questions/' + ids.selfQuestionId + '/submit-review',
      tokens.admin,
    )
      .send({})
      .expect(201);

    await post('/api/v1/admin/questions', tokens.admin)
      .send({
        subjectId: ids.subjectId,
        type: QuestionType.TRUE_FALSE,
        questionText: 'سؤال صواب وخطأ غير صالح ' + suffix,
        correctBoolean: true,
        options: [
          { optionText: 'صح', sortOrder: 1, isCorrect: true },
          { optionText: 'خطأ', sortOrder: 2, isCorrect: false },
        ],
      })
      .expect(400);

    await post('/api/v1/admin/questions', tokens.admin)
      .send({
        subjectId: ids.subjectId,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: 'سؤال متعدد غير صالح ' + suffix,
        options: [
          { optionText: 'أ', sortOrder: 1, isCorrect: true },
          { optionText: 'ب', sortOrder: 2, isCorrect: true },
        ],
      })
      .expect(400);
  });

  it('keeps similar responses safe and bulk actions atomic', async () => {
    const similar = await post('/api/v1/admin/questions', tokens.admin)
      .send({
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        lessonId: ids.lessonId,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: 'أي القوانين يصف القصور الذاتي؟ ' + suffix,
        options: [
          { optionText: 'قانون نيوتن الأول', sortOrder: 1, isCorrect: true },
          { optionText: 'قانون نيوتن الثاني', sortOrder: 2, isCorrect: false },
        ],
      })
      .expect(201);
    ids.similarQuestionId = (similar.body as IdResponse).data.id;
    await post(
      '/api/v1/admin/questions/' + ids.similarQuestionId + '/submit-review',
      tokens.admin,
    )
      .send({})
      .expect(201);
    await post(
      '/api/v1/admin/questions/' + ids.similarQuestionId + '/approve',
      tokens.reviewer,
    )
      .send({})
      .expect(201);
    await post(
      '/api/v1/admin/questions/' + ids.similarQuestionId + '/publish',
      tokens.admin,
    ).expect(201);

    const similarResponse = await request(app.getHttpServer())
      .get('/api/v1/questions/' + ids.mainQuestionId + '/similar')
      .set('Authorization', auth(tokens.student))
      .expect(200);
    const items = (
      similarResponse.body as {
        data: Array<Record<string, unknown>>;
      }
    ).data;
    expect(items.some((item) => item.id === ids.mainQuestionId)).toBe(false);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.similarQuestionId }),
      ]),
    );
    for (const item of items) {
      expect(item).not.toHaveProperty('correctBoolean');
      expect(item).not.toHaveProperty('fingerprint');
      for (const option of item.options as Array<Record<string, unknown>>) {
        expect(option).not.toHaveProperty('isCorrect');
      }
    }

    const validBulk = await post(
      '/api/v1/admin/questions/bulk-action',
      tokens.admin,
    )
      .send({
        questionIds: [
          ids.mainQuestionId,
          ids.similarQuestionId,
          ids.mainQuestionId,
        ],
        action: 'unpublish',
      })
      .expect(201);
    const bulkResult = (
      validBulk.body as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(bulkResult).toMatchObject({
      processed: 2,
      succeeded: 2,
      failed: 0,
    });

    await post('/api/v1/admin/questions/bulk-action', tokens.admin)
      .send({
        questionIds: [ids.mainQuestionId, ids.selfQuestionId],
        action: 'publish',
      })
      .expect(400);
    const unchanged = await prisma.question.findUniqueOrThrow({
      where: { id: ids.mainQuestionId },
    });
    expect(unchanged.isPublished).toBe(false);

    await post('/api/v1/admin/questions/bulk-action', tokens.admin)
      .send({
        questionIds: [ids.mainQuestionId, ids.similarQuestionId],
        action: 'publish',
      })
      .expect(201);
  });

  it('applies hierarchy visibility, soft delete, authorization, health, and Swagger', async () => {
    await post(
      '/api/v1/admin/subjects/' + ids.subjectId + '/unpublish',
      tokens.admin,
    ).expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/questions/' + ids.mainQuestionId)
      .set('Authorization', auth(tokens.student))
      .expect(404);
    await post(
      '/api/v1/admin/subjects/' + ids.subjectId + '/publish',
      tokens.admin,
    ).expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/questions/' + ids.mainQuestionId)
      .set('Authorization', auth(tokens.student))
      .expect(200);

    await request(app.getHttpServer())
      .delete('/api/v1/admin/questions/' + ids.mainQuestionId)
      .set('Authorization', auth(tokens.admin))
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/questions/' + ids.mainQuestionId)
      .set('Authorization', auth(tokens.student))
      .expect(404);
    const restored = await post(
      '/api/v1/admin/questions/' + ids.mainQuestionId + '/restore',
      tokens.admin,
    ).expect(201);
    expect((restored.body as IdResponse).data.isPublished).toBe(false);

    await request(app.getHttpServer())
      .get('/api/v1/questions/' + ids.mainQuestionId)
      .expect(401);
    await post('/api/v1/admin/questions', tokens.student).send({}).expect(403);
    await post(
      '/api/v1/admin/questions/' + ids.similarQuestionId + '/publish',
      tokens.reviewer,
    ).expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/questions/not-a-uuid')
      .set('Authorization', auth(tokens.student))
      .expect(400);

    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const swagger = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const paths = (swagger.body as { paths: Record<string, unknown> }).paths;
    expect(paths).toHaveProperty('/api/v1/questions/{id}');
    expect(paths).toHaveProperty('/api/v1/questions/{id}/similar');
    expect(paths).toHaveProperty('/api/v1/admin/questions/bulk-action');
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    const userIds = [ids.adminId, ids.reviewerId, ids.studentId].filter(
      (id): id is string => Boolean(id),
    );
    if (ids.adminId) {
      await prisma.question.deleteMany({
        where: { createdById: ids.adminId },
      });
      await prisma.readingPassage.deleteMany({
        where: { createdById: ids.adminId },
      });
    }
    if (ids.sourceId) {
      await prisma.source.deleteMany({ where: { id: ids.sourceId } });
    }
    if (ids.lessonId) {
      await prisma.lesson.deleteMany({ where: { id: ids.lessonId } });
    }
    if (ids.unitId) {
      await prisma.unit.deleteMany({ where: { id: ids.unitId } });
    }
    if (ids.subjectId) {
      await prisma.subject.deleteMany({ where: { id: ids.subjectId } });
    }
    if (ids.curriculumId || ids.gradeId) {
      await prisma.curriculumGrade.deleteMany({
        where: {
          OR: [
            ...(ids.curriculumId ? [{ curriculumId: ids.curriculumId }] : []),
            ...(ids.gradeId ? [{ gradeId: ids.gradeId }] : []),
          ],
        },
      });
    }
    if (ids.curriculumId) {
      await prisma.curriculum.deleteMany({
        where: { id: ids.curriculumId },
      });
    }
    if (ids.gradeId) {
      await prisma.grade.deleteMany({ where: { id: ids.gradeId } });
    }
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
  });
});
