import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ChallengeGameplayService } from '../src/challenges/challenge-gameplay.service';
import {
  ChallengeMode,
  ChallengeStatus,
  CompanionType,
  QuestionDifficulty,
  QuestionReviewStatus,
  QuestionType,
  UserRole,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponse {
  tokens: { accessToken: string };
}
interface DataResponse<T> {
  data: T;
}

describe('Challenges multiplayer PostgreSQL hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let gameplay: ChallengeGameplayService;
  const suffix = randomUUID().slice(0, 8);
  const password = 'Password123';
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
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
    gameplay = app.get(ChallengeGameplayService);

    const passwordHash = await hash(password);
    for (const key of ['a', 'b', 'c', 'd'] as const) {
      const username = `challenge_${key}_${suffix}`;
      const user = await prisma.user.create({
        data: {
          name: `Challenge ${key.toUpperCase()}`,
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
        name: `Challenge Grade ${suffix}`,
        slug: `challenge-grade-${suffix}`,
      },
    });
    const curriculum = await prisma.curriculum.create({
      data: {
        name: `Challenge Curriculum ${suffix}`,
        slug: `challenge-curriculum-${suffix}`,
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
        name: `Challenge Physics ${suffix}`,
        slug: `challenge-physics-${suffix}`,
        isPublished: true,
      },
    });
    const unit = await prisma.unit.create({
      data: {
        subjectId: subject.id,
        name: `Challenge Unit ${suffix}`,
        slug: `challenge-unit-${suffix}`,
        isPublished: true,
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        name: `Challenge Lesson ${suffix}`,
        slug: `challenge-lesson-${suffix}`,
        isPublished: true,
      },
    });
    const question = await prisma.question.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        lessonId: lesson.id,
        type: QuestionType.TRUE_FALSE,
        questionText: `Server-authoritative challenge ${suffix}`,
        correctBoolean: true,
        difficulty: QuestionDifficulty.MEDIUM,
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
  });

  it('supports invite rejection and creator cancellation for 1v1', async () => {
    const created = await api()
      .post('/api/v1/challenges')
      .set('Authorization', auth(tokens.a))
      .send({
        mode: ChallengeMode.ONE_VS_ONE,
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        lessonId: ids.lessonId,
        questionCount: 1,
        timePerQuestionSeconds: 5,
        difficulty: QuestionDifficulty.MEDIUM,
        maxPlayers: 2,
      })
      .expect(201);
    const challengeId = (created.body as DataResponse<{ id: string }>).data.id;
    ids.cancelledChallengeId = challengeId;

    await api()
      .post(`/api/v1/challenges/${challengeId}/invitations`)
      .set('Authorization', auth(tokens.a))
      .send({ userId: ids.bId })
      .expect(201);
    expect(
      await prisma.notification.count({
        where: { userId: ids.bId, type: 'CHALLENGE_INVITE' },
      }),
    ).toBeGreaterThan(0);

    await api()
      .post(`/api/v1/challenges/${challengeId}/reject`)
      .set('Authorization', auth(tokens.b))
      .expect(201);
    await api()
      .post(`/api/v1/challenges/${challengeId}/cancel`)
      .set('Authorization', auth(tokens.a))
      .expect(201);
    expect(
      (
        await prisma.challenge.findUniqueOrThrow({
          where: { id: challengeId },
        })
      ).status,
    ).toBe(ChallengeStatus.CANCELLED);
  });

  it('runs a concurrent 2v2 lifecycle with server time, teams, and no answer leakage', async () => {
    const created = await api()
      .post('/api/v1/challenges')
      .set('Authorization', auth(tokens.a))
      .send({
        mode: ChallengeMode.TWO_VS_TWO,
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        lessonId: ids.lessonId,
        questionCount: 1,
        timePerQuestionSeconds: 5,
        difficulty: QuestionDifficulty.MEDIUM,
        maxPlayers: 4,
      })
      .expect(201);
    const challengeId = (created.body as DataResponse<{ id: string }>).data.id;
    ids.teamChallengeId = challengeId;

    for (const [key, team] of [
      ['b', 1],
      ['c', 2],
      ['d', 2],
    ] as const) {
      await api()
        .post(`/api/v1/challenges/${challengeId}/invitations`)
        .set('Authorization', auth(tokens.a))
        .send({ userId: ids[`${key}Id`], team })
        .expect(201);
      await api()
        .post(`/api/v1/challenges/${challengeId}/accept`)
        .set('Authorization', auth(tokens[key]))
        .expect(201);
    }

    const ready = await Promise.all(
      (['a', 'b', 'c', 'd'] as const).map((key) =>
        api()
          .post(`/api/v1/challenges/${challengeId}/ready`)
          .set('Authorization', auth(tokens[key]))
          .expect(201),
      ),
    );
    expect(ready).toHaveLength(4);
    expect(
      (
        await prisma.challenge.findUniqueOrThrow({
          where: { id: challengeId },
        })
      ).status,
    ).toBe(ChallengeStatus.COUNTDOWN);
    expect(
      await prisma.challengeQuestion.count({ where: { challengeId } }),
    ).toBe(1);

    await gameplay.start(ids.aId, challengeId);
    await prisma.challenge.update({
      where: { id: challengeId },
      data: { startedAt: new Date(Date.now() - 1_000) },
    });

    const state = await api()
      .get(`/api/v1/challenges/${challengeId}`)
      .set('Authorization', auth(tokens.a))
      .expect(200);
    const stateJson = JSON.stringify(state.body);
    expect(
      (
        state.body as DataResponse<{
          questions: Array<{ question: { id: string } }>;
        }>
      ).data.questions,
    ).toHaveLength(1);
    expect(stateJson).not.toContain('correctBoolean');
    expect(stateJson).not.toContain('isCorrect');

    const duplicate = await Promise.allSettled([
      gameplay.answer(ids.aId, {
        challengeId,
        questionId: ids.questionId,
        selectedBoolean: true,
      }),
      gameplay.answer(ids.aId, {
        challengeId,
        questionId: ids.questionId,
        selectedBoolean: true,
      }),
    ]);
    expect(
      duplicate.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const fulfilled = duplicate.find(
      (result): result is PromiseFulfilledResult<Record<string, unknown>> =>
        result.status === 'fulfilled',
    );
    expect(fulfilled?.value).not.toHaveProperty('correctAnswer');
    expect(
      await prisma.challengeAnswer.count({
        where: { challengeId, participant: { userId: ids.aId } },
      }),
    ).toBe(1);

    const teammate = await gameplay.answer(ids.bId, {
      challengeId,
      questionId: ids.questionId,
      selectedBoolean: true,
    });
    expect(teammate).not.toHaveProperty('correctAnswer');

    await prisma.challenge.update({
      where: { id: challengeId },
      data: { startedAt: new Date(Date.now() - 6_000) },
    });
    await expect(gameplay.expireTimedOut(challengeId)).resolves.toBe(true);

    const result = await api()
      .get(`/api/v1/challenges/${challengeId}/result`)
      .set('Authorization', auth(tokens.a))
      .expect(200);
    const resultData = (
      result.body as DataResponse<{
        winnerTeam: number;
        standings: Array<{ team: number; rank: number; score: number }>;
      }>
    ).data;
    expect(resultData.winnerTeam).toBe(1);
    expect(
      resultData.standings
        .filter((entry) => entry.team === 1)
        .map((entry) => entry.rank),
    ).toEqual([1, 1]);
    expect(
      await prisma.pointTransaction.count({
        where: {
          userId: { in: [ids.aId, ids.bId] },
          type: 'CHALLENGE_WIN',
          referenceId: challengeId,
        },
      }),
    ).toBe(2);
  });

  it('documents invitation, cancellation, and multiplayer routes', async () => {
    const swagger = await api().get('/api/docs-json').expect(200);
    const paths = (swagger.body as { paths: Record<string, unknown> }).paths;
    for (const path of [
      '/api/v1/challenges/{id}/invitations',
      '/api/v1/challenges/{id}/accept',
      '/api/v1/challenges/{id}/reject',
      '/api/v1/challenges/{id}/cancel',
      '/api/v1/challenges/{id}/ready',
      '/api/v1/challenges/{id}/result',
    ]) {
      expect(paths).toHaveProperty(path);
    }
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    await prisma.challenge.deleteMany({
      where: {
        id: {
          in: [ids.cancelledChallengeId, ids.teamChallengeId].filter(Boolean),
        },
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
        id: { in: [ids.aId, ids.bId, ids.cId, ids.dId].filter(Boolean) },
      },
    });
    await app.close();
  });
});
