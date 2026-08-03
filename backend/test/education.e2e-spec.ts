import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CurriculaService } from '../src/education/curricula/curricula.service';
import { EducationContextService } from '../src/education/education-context.service';
import { GradesService } from '../src/education/grades/grades.service';
import { LessonsService } from '../src/education/lessons/lessons.service';
import { SubjectsService } from '../src/education/subjects/subjects.service';
import { UnitsService } from '../src/education/units/units.service';
import type { User } from '../src/generated/prisma/client';
import { CompanionType, UserRole } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-07-17T00:00:00.000Z');
const makeUser = (id: string, role: UserRole): User => ({
  id,
  name: role === UserRole.ADMIN ? 'Admin' : 'Student',
  username: role === UserRole.ADMIN ? 'admin' : 'student',
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

describe('Education phase A (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let studentToken: string;
  let gradeId: string;
  let curriculumId: string;
  let subjectId: string;
  let unitId: string;
  let lessonId: string;
  const grades = new Map<string, Record<string, unknown>>();
  const curricula = new Map<string, Record<string, unknown>>();
  const subjects = new Map<string, Record<string, unknown>>();
  const units = new Map<string, Record<string, unknown>>();
  const lessons = new Map<string, Record<string, unknown>>();
  const favoriteSubjects = new Set<string>();

  const gradesService = {
    create: jest.fn((dto: Record<string, unknown>) => {
      const item = { id: randomUUID(), ...dto, deletedAt: null };
      grades.set(item.id, item);
      return Promise.resolve(item);
    }),
  };
  const curriculaService = {
    create: jest.fn((dto: Record<string, unknown>) => {
      const item = { id: randomUUID(), ...dto, deletedAt: null };
      curricula.set(item.id, item);
      return Promise.resolve(item);
    }),
  };
  const subjectsService = {
    create: jest.fn((dto: Record<string, unknown>) => {
      const item = {
        id: randomUUID(),
        ...dto,
        isActive: true,
        isPublished: false,
        deletedAt: null,
      };
      subjects.set(item.id, item);
      return Promise.resolve(item);
    }),
    publish: jest.fn((id: string) => {
      const item = subjects.get(id);
      if (!item) throw new Error('subject missing in test fixture');
      const updated = { ...item, isPublished: true };
      subjects.set(id, updated);
      return Promise.resolve(updated);
    }),
    listPublished: jest.fn(
      (_userId: string, query?: { favorite?: boolean }) => {
        const items = [...subjects.values()].filter(
          (item) => item.isPublished === true && item.deletedAt === null,
        );
        const visibleItems =
          query?.favorite === true
            ? items.filter((item) => favoriteSubjects.has(String(item.id)))
            : items;
        return Promise.resolve({
          items: visibleItems,
          meta: {
            page: 1,
            limit: 20,
            totalItems: visibleItems.length,
            totalPages: visibleItems.length === 0 ? 0 : 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
      },
    ),
    favorite: jest.fn((_userId: string, id: string) => {
      favoriteSubjects.add(id);
      return Promise.resolve({ subjectId: id, isFavorite: true });
    }),
    unfavorite: jest.fn((_userId: string, id: string) => {
      favoriteSubjects.delete(id);
      return Promise.resolve({ subjectId: id, isFavorite: false });
    }),
  };
  const unitsService = {
    create: jest.fn((dto: Record<string, unknown>) => {
      const item = {
        id: randomUUID(),
        ...dto,
        isPublished: true,
        deletedAt: null,
      };
      units.set(item.id, item);
      return Promise.resolve(item);
    }),
    listPublishedBySubject: jest.fn((_userId: string, id: string) =>
      Promise.resolve(
        [...units.values()].filter((item) => item.subjectId === id),
      ),
    ),
  };
  const lessonsService = {
    create: jest.fn((dto: Record<string, unknown>) => {
      const item = {
        id: randomUUID(),
        ...dto,
        isPublished: true,
        deletedAt: null,
      };
      lessons.set(item.id, item);
      return Promise.resolve(item);
    }),
    listPublishedByUnit: jest.fn((_userId: string, id: string) =>
      Promise.resolve(
        [...lessons.values()].filter((item) => item.unitId === id),
      ),
    ),
  };
  const contextService = {
    getDefaultContext: jest.fn(() =>
      Promise.resolve({
        grade: { id: gradeId, name: 'الثالث الثانوي', slug: 'grade-12' },
        curriculum: {
          id: curriculumId,
          name: 'المنهج اليمني',
          slug: 'yemeni-curriculum',
          academicYear: null,
        },
        countryCode: 'YE',
      }),
    ),
  };

  beforeAll(async () => {
    const admin = makeUser(
      '40000000-0000-4000-8000-000000000001',
      UserRole.ADMIN,
    );
    const student = makeUser(
      '40000000-0000-4000-8000-000000000002',
      UserRole.STUDENT,
    );
    const users = new Map([
      [admin.id, admin],
      [student.id, student],
    ]);
    const config = new ConfigService({
      API_PREFIX: 'api/v1',
      JWT_ACCESS_SECRET: 'education-e2e-access-secret',
      JWT_REFRESH_SECRET: 'education-e2e-refresh-secret',
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
      .overrideProvider(GradesService)
      .useValue(gradesService)
      .overrideProvider(CurriculaService)
      .useValue(curriculaService)
      .overrideProvider(SubjectsService)
      .useValue(subjectsService)
      .overrideProvider(UnitsService)
      .useValue(unitsService)
      .overrideProvider(LessonsService)
      .useValue(lessonsService)
      .overrideProvider(EducationContextService)
      .useValue(contextService)
      .compile();

    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    const jwt = new JwtService();
    adminToken = await jwt.signAsync(
      {
        sub: admin.id,
        role: admin.role,
        username: admin.username,
        tokenVersion: 0,
      },
      { secret: 'education-e2e-access-secret', expiresIn: '15m' },
    );
    studentToken = await jwt.signAsync(
      {
        sub: student.id,
        role: student.role,
        username: student.username,
        tokenVersion: 0,
      },
      { secret: 'education-e2e-access-secret', expiresIn: '15m' },
    );
  });

  it('rejects unauthenticated admin access', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/grades')
      .send({})
      .expect(401);
  });

  it('rejects student access to an admin route', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/subjects')
      .set('Authorization', 'Bearer ' + studentToken)
      .expect(403);
  });

  it('rejects an invalid UUID path parameter', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/subjects/not-a-uuid')
      .set('Authorization', 'Bearer ' + studentToken)
      .expect(400);
  });

  it('rejects an invalid education DTO', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/subjects')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: '', slug: 'Invalid Slug' })
      .expect(400);
  });

  it('validates pagination query parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/subjects?page=0&limit=101')
      .set('Authorization', 'Bearer ' + studentToken)
      .expect(400);
  });
  it('allows an admin to create the education hierarchy', async () => {
    const grade = await request(app.getHttpServer())
      .post('/api/v1/admin/grades')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'الثالث الثانوي', slug: 'grade-12', sortOrder: 1 })
      .expect(201);
    gradeId = (grade.body as { data: { id: string } }).data.id;
    const curriculum = await request(app.getHttpServer())
      .post('/api/v1/admin/curricula')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'المنهج اليمني',
        slug: 'yemeni-curriculum',
        countryCode: 'YE',
      })
      .expect(201);
    curriculumId = (curriculum.body as { data: { id: string } }).data.id;
    const subject = await request(app.getHttpServer())
      .post('/api/v1/admin/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ curriculumId, gradeId, name: 'الفيزياء', slug: 'physics' })
      .expect(201);
    subjectId = (subject.body as { data: { id: string } }).data.id;
    const unit = await request(app.getHttpServer())
      .post('/api/v1/admin/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId, name: 'الميكانيكا', slug: 'mechanics' })
      .expect(201);
    unitId = (unit.body as { data: { id: string } }).data.id;
    const lesson = await request(app.getHttpServer())
      .post('/api/v1/admin/lessons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId, unitId, name: 'الحركة', slug: 'motion' })
      .expect(201);
    lessonId = (lesson.body as { data: { id: string } }).data.id;
    expect(lessonId).toEqual(expect.any(String));
  });

  it('hides an unpublished subject from a student', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(response.body).toMatchObject({ data: [] });
  });

  it('publishes the subject and exposes its hierarchy to a student', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/subjects/${subjectId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const subjectList = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(subjectList.body).toMatchObject({ data: [{ id: subjectId }] });
    const unitList = await request(app.getHttpServer())
      .get(`/api/v1/subjects/${subjectId}/units`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(unitList.body).toMatchObject({ data: [{ id: unitId }] });
    const lessonList = await request(app.getHttpServer())
      .get(`/api/v1/units/${unitId}/lessons`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(lessonList.body).toMatchObject({ data: [{ id: lessonId }] });
  });

  it('returns the education context', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/education/context')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(response.body).toMatchObject({ data: { countryCode: 'YE' } });
  });

  it('persists and filters a student subject favorite', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/subjects/${subjectId}/favorite`)
      .set('Authorization', 'Bearer ' + studentToken)
      .expect(201);
    const favoriteList = await request(app.getHttpServer())
      .get('/api/v1/subjects?favorite=true')
      .set('Authorization', 'Bearer ' + studentToken)
      .expect(200);
    expect(favoriteList.body).toMatchObject({ data: [{ id: subjectId }] });
    await request(app.getHttpServer())
      .delete(`/api/v1/subjects/${subjectId}/favorite`)
      .set('Authorization', 'Bearer ' + studentToken)
      .expect(200);
    const emptyFavoriteList = await request(app.getHttpServer())
      .get('/api/v1/subjects?favorite=true')
      .set('Authorization', 'Bearer ' + studentToken)
      .expect(200);
    expect(emptyFavoriteList.body).toMatchObject({ data: [] });
  });
  it('documents education routes in Swagger', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const body = response.body as { paths: Record<string, unknown> };
    expect(body.paths).toHaveProperty('/api/v1/education/context');
    expect(body.paths).toHaveProperty('/api/v1/subjects');
    expect(body.paths).toHaveProperty('/api/v1/subjects/{subjectId}/favorite');
    expect(body.paths).toHaveProperty('/api/v1/admin/subjects');
    expect(body.paths).toHaveProperty('/api/v1/admin/units/{id}/publish');
    expect(body.paths).toHaveProperty('/api/v1/admin/lessons/{id}/publish');
  });

  afterAll(async () => app.close());
});
