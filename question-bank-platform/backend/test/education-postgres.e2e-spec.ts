import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  CompanionType,
  QuestionReviewStatus,
  QuestionType,
  UserRole,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

interface DataResponse {
  data: { id: string };
}

interface AuthResponse {
  tokens: { accessToken: string };
}

describe('Education PostgreSQL integration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let secondStudentToken: string;
  const suffix = randomUUID().slice(0, 8);
  const ids: Record<string, string | undefined> = {};

  const authorization = (token: string) => 'Bearer ' + token;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const admin = await prisma.user.create({
      data: {
        name: 'PostgreSQL E2E Admin',
        username: 'pg_admin_' + suffix,
        passwordHash: 'not-used-by-this-test',
        role: UserRole.ADMIN,
        companion: CompanionType.MALE,
      },
    });
    ids.adminId = admin.id;

    const jwt = app.get(JwtService);
    const config = app.get(ConfigService);
    adminToken = await jwt.signAsync(
      {
        sub: admin.id,
        role: admin.role,
        username: admin.username,
        tokenVersion: admin.tokenVersion,
      },
      {
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );

    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'PostgreSQL E2E Student',
        username: 'pg_student_' + suffix,
        password: 'Password123',
        companion: CompanionType.MALE,
      })
      .expect(201);
    studentToken = (registration.body as AuthResponse).tokens.accessToken;
    const student = await prisma.user.findUniqueOrThrow({
      where: { username: 'pg_student_' + suffix },
    });
    ids.studentId = student.id;

    const secondRegistration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'PostgreSQL E2E Peer',
        username: 'pg_peer_' + suffix,
        password: 'Password123',
        companion: CompanionType.FEMALE,
      })
      .expect(201);
    secondStudentToken = (secondRegistration.body as AuthResponse).tokens
      .accessToken;
    const secondStudent = await prisma.user.findUniqueOrThrow({
      where: { username: 'pg_peer_' + suffix },
    });
    ids.secondStudentId = secondStudent.id;

    const grade = await request(app.getHttpServer())
      .post('/api/v1/admin/grades')
      .set('Authorization', authorization(adminToken))
      .send({
        name: 'PG Grade ' + suffix,
        slug: 'pg-grade-' + suffix,
        sortOrder: 9000,
      })
      .expect(201);
    ids.gradeId = (grade.body as DataResponse).data.id;

    const curriculum = await request(app.getHttpServer())
      .post('/api/v1/admin/curricula')
      .set('Authorization', authorization(adminToken))
      .send({
        name: 'PG Curriculum ' + suffix,
        slug: 'pg-curriculum-' + suffix,
        countryCode: 'YE',
      })
      .expect(201);
    ids.curriculumId = (curriculum.body as DataResponse).data.id;

    const createSubject = async (label: string) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/subjects')
        .set('Authorization', authorization(adminToken))
        .send({
          curriculumId: ids.curriculumId,
          gradeId: ids.gradeId,
          name: 'PG Subject ' + label + ' ' + suffix,
          slug: 'pg-subject-' + label.toLowerCase() + '-' + suffix,
        })
        .expect(201);
      const id = (response.body as DataResponse).data.id;
      await request(app.getHttpServer())
        .post('/api/v1/admin/subjects/' + id + '/publish')
        .set('Authorization', authorization(adminToken))
        .expect(201);
      return id;
    };
    ids.subjectId = await createSubject('A');
    ids.secondSubjectId = await createSubject('B');

    const createUnit = async (subjectId: string, label: string) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/units')
        .set('Authorization', authorization(adminToken))
        .send({
          subjectId,
          name: 'PG Unit ' + label + ' ' + suffix,
          slug: 'pg-unit-' + label.toLowerCase() + '-' + suffix,
        })
        .expect(201);
      return (response.body as DataResponse).data.id;
    };
    ids.unitId = await createUnit(ids.subjectId, 'A');
    ids.secondUnitId = await createUnit(ids.secondSubjectId, 'B');
    await request(app.getHttpServer())
      .post('/api/v1/admin/units/' + ids.unitId + '/publish')
      .set('Authorization', authorization(adminToken))
      .expect(201);

    const lesson = await request(app.getHttpServer())
      .post('/api/v1/admin/lessons')
      .set('Authorization', authorization(adminToken))
      .send({
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        name: 'PG Lesson ' + suffix,
        slug: 'pg-lesson-' + suffix,
      })
      .expect(201);
    ids.lessonId = (lesson.body as DataResponse).data.id;
    await request(app.getHttpServer())
      .post('/api/v1/admin/lessons/' + ids.lessonId + '/publish')
      .set('Authorization', authorization(adminToken))
      .expect(201);

    const question = await prisma.question.create({
      data: {
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        lessonId: ids.lessonId,
        type: QuestionType.TRUE_FALSE,
        questionText: 'PostgreSQL integration question ' + suffix,
        correctBoolean: true,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
      },
    });
    ids.questionId = question.id;
    await prisma.studentSubjectProgress.create({
      data: {
        userId: ids.studentId,
        subjectId: ids.subjectId,
        answeredQuestions: 10,
        correctAnswers: 8,
        wrongAnswers: 2,
        accuracyPercent: 80,
        masteryPercent: 65,
        lastActivityAt: new Date(),
      },
    });
  });

  it('persists personalization and enforces hierarchy invariants through HTTP', async () => {
    const health = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(health.body).toMatchObject({
      status: 'ok',
      database: 'connected',
    });

    const swagger = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const swaggerPaths = (swagger.body as { paths: Record<string, unknown> })
      .paths;
    expect(swaggerPaths).toHaveProperty(
      '/api/v1/subjects/{subjectId}/favorite',
    );
    await request(app.getHttpServer())
      .post('/api/v1/subjects/' + ids.subjectId + '/favorite')
      .set('Authorization', authorization(studentToken))
      .expect(201);

    const subjects = await request(app.getHttpServer())
      .get(
        '/api/v1/subjects?search=' +
          encodeURIComponent(suffix) +
          '&sort=questions_desc',
      )
      .set('Authorization', authorization(studentToken))
      .expect(200);
    const subjectItems = (
      subjects.body as {
        data: Array<Record<string, unknown>>;
      }
    ).data;
    expect(subjectItems).toHaveLength(2);
    expect(subjectItems[0]).toMatchObject({
      id: ids.subjectId,
      unitsCount: 1,
      lessonsCount: 1,
      questionsCount: 1,
      isFavorite: true,
      progress: {
        answeredQuestions: 10,
        correctAnswers: 8,
        accuracyPercent: 80,
        masteryPercent: 65,
      },
    });

    const favorites = await request(app.getHttpServer())
      .get('/api/v1/subjects?favorite=true')
      .set('Authorization', authorization(studentToken))
      .expect(200);
    expect(favorites.body).toMatchObject({
      data: [{ id: ids.subjectId, isFavorite: true }],
    });
    const peerFavorites = await request(app.getHttpServer())
      .get('/api/v1/subjects?favorite=true')
      .set('Authorization', authorization(secondStudentToken))
      .expect(200);
    expect(peerFavorites.body).toMatchObject({ data: [] });

    await request(app.getHttpServer())
      .post('/api/v1/admin/units/reorder')
      .set('Authorization', authorization(adminToken))
      .send({
        items: [
          { id: ids.unitId, sortOrder: 1 },
          { id: ids.secondUnitId, sortOrder: 2 },
        ],
      })
      .expect(400);

    await prisma.grade.update({
      where: { id: ids.gradeId },
      data: { deletedAt: new Date(), isActive: false },
    });
    await request(app.getHttpServer())
      .get('/api/v1/subjects/' + ids.subjectId)
      .set('Authorization', authorization(studentToken))
      .expect(404);
    await prisma.grade.update({
      where: { id: ids.gradeId },
      data: { deletedAt: null, isActive: true },
    });

    await request(app.getHttpServer())
      .delete('/api/v1/subjects/' + ids.subjectId + '/favorite')
      .set('Authorization', authorization(studentToken))
      .expect(200);
    await expect(
      prisma.userSubjectFavorite.findUnique({
        where: {
          userId_subjectId: {
            userId: ids.studentId!,
            subjectId: ids.subjectId!,
          },
        },
      }),
    ).resolves.toBeNull();
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    if (ids.questionId)
      await prisma.question.deleteMany({ where: { id: ids.questionId } });
    const studentIds = [ids.studentId, ids.secondStudentId].filter(
      (id): id is string => Boolean(id),
    );
    if (studentIds.length)
      await prisma.user.deleteMany({ where: { id: { in: studentIds } } });
    if (ids.lessonId)
      await prisma.lesson.deleteMany({ where: { id: ids.lessonId } });

    const unitIds = [ids.unitId, ids.secondUnitId].filter((id): id is string =>
      Boolean(id),
    );
    if (unitIds.length)
      await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });

    const subjectIds = [ids.subjectId, ids.secondSubjectId].filter(
      (id): id is string => Boolean(id),
    );
    if (subjectIds.length)
      await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });

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
    if (ids.curriculumId)
      await prisma.curriculum.deleteMany({
        where: { id: ids.curriculumId },
      });
    if (ids.gradeId)
      await prisma.grade.deleteMany({ where: { id: ids.gradeId } });
    if (ids.adminId)
      await prisma.user.deleteMany({ where: { id: ids.adminId } });
    await app.close();
  });
});
