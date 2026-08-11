import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  AchievementCategory,
  AchievementConditionType,
  ChallengeMode,
  ChallengeStatus,
  CompanionType,
  PointType,
  UserRole,
} from '../src/generated/prisma/enums';
import { AchievementsService } from '../src/gamification/achievements.service';
import { PointsService } from '../src/gamification/points.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponse {
  tokens: { accessToken: string };
}
interface DataResponse<T> {
  data: T;
}

describe('Gamification and Leaderboards PostgreSQL hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let points: PointsService;
  let achievements: AchievementsService;
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
    points = app.get(PointsService);
    achievements = app.get(AchievementsService);

    const passwordHash = await hash(password);
    for (const key of ['studentA', 'studentB'] as const) {
      const username = `game_${key.toLowerCase()}_${suffix}`;
      const user = await prisma.user.create({
        data: {
          name: `Game ${key}`,
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

    const achievement = await prisma.achievement.create({
      data: {
        key: `ledger-points-${suffix}`,
        name: `Ledger Champion ${suffix}`,
        description: 'Reach the ledger threshold',
        category: AchievementCategory.SPECIAL,
        conditionType: AchievementConditionType.TOTAL_POINTS,
        conditionValue: 50,
        pointsReward: 0,
      },
    });
    ids.achievementId = achievement.id;
  });

  it('awards an idempotent event once under real concurrency', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        prisma.$transaction((tx) =>
          points.award(tx, ids.studentAId, {
            amount: 50,
            type: PointType.ADMIN_ADJUSTMENT,
            idempotencyKey: `concurrent-award:${suffix}`,
            referenceType: 'E2E',
            referenceId: suffix,
          }),
        ),
      ),
    );
    expect(results.filter((result) => result.awarded)).toHaveLength(1);
    expect(
      await prisma.pointTransaction.count({
        where: { idempotencyKey: `concurrent-award:${suffix}` },
      }),
    ).toBe(1);
    const balance = await prisma.userPoints.findUniqueOrThrow({
      where: { userId: ids.studentAId },
    });
    expect(balance.totalPoints).toBe(50);
    expect(balance.lifetimePoints).toBe(50);
  });

  it('unlocks a badge and notification once under concurrent evaluation', async () => {
    await Promise.all(
      Array.from({ length: 4 }, () =>
        prisma.$transaction((tx) => achievements.evaluate(tx, ids.studentAId)),
      ),
    );
    expect(
      await prisma.userAchievement.count({
        where: {
          userId: ids.studentAId,
          achievementId: ids.achievementId,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: {
          userId: ids.studentAId,
          data: { path: ['achievementId'], equals: ids.achievementId },
        },
      }),
    ).toBe(1);

    const list = await api()
      .get('/api/v1/achievements/my')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect(
      (
        list.body as DataResponse<
          Array<{ achievementId: string; achievement: { name: string } }>
        >
      ).data,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ achievementId: ids.achievementId }),
      ]),
    );
  });

  it('ranks server-ledger XP and persisted challenge wins', async () => {
    await prisma.$transaction((tx) =>
      points.award(tx, ids.studentBId, {
        amount: 10,
        type: PointType.ADMIN_ADJUSTMENT,
        idempotencyKey: `second-award:${suffix}`,
      }),
    );
    const challenge = await prisma.challenge.create({
      data: {
        mode: ChallengeMode.ONE_VS_ONE,
        status: ChallengeStatus.COMPLETED,
        questionCount: 1,
        timePerQuestionSeconds: 30,
        maxPlayers: 2,
        winnerUserId: ids.studentAId,
        completedAt: new Date(),
        settings: {},
      },
    });
    ids.challengeId = challenge.id;

    const xp = await api()
      .get('/api/v1/leaderboards?period=daily&metric=xp')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    const xpData = (
      xp.body as DataResponse<{
        metric: string;
        topPlayers: Array<{ userId: string; points: number }>;
      }>
    ).data;
    expect(xpData.metric).toBe('xp');
    expect(xpData.topPlayers[0]).toMatchObject({
      userId: ids.studentAId,
      points: 50,
    });

    const wins = await api()
      .get('/api/v1/leaderboards?period=all&metric=wins')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    const winsData = (
      wins.body as DataResponse<{
        metric: string;
        topPlayers: Array<{ userId: string; points: number }>;
      }>
    ).data;
    expect(winsData.metric).toBe('wins');
    expect(winsData.topPlayers[0]).toMatchObject({
      userId: ids.studentAId,
      points: 1,
    });
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    if (ids.challengeId)
      await prisma.challenge.deleteMany({ where: { id: ids.challengeId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ids.studentAId, ids.studentBId].filter(Boolean) } },
    });
    if (ids.achievementId)
      await prisma.achievement.deleteMany({ where: { id: ids.achievementId } });
    await app.close();
  });
});
