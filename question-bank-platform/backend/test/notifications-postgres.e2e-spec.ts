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
  NotificationType,
  PushDevicePlatform,
  UserRole,
} from '../src/generated/prisma/enums';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponse {
  tokens: { accessToken: string };
}
interface DataResponse<T> {
  data: T;
}
interface NotificationResponse {
  id: string;
  type: NotificationType;
  isRead: boolean;
}

describe('Notifications PostgreSQL hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let notifications: NotificationsService;
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
    notifications = app.get(NotificationsService);

    const passwordHash = await hash(password);
    for (const key of ['a', 'b'] as const) {
      const username = `notifications_${key}_${suffix}`;
      const user = await prisma.user.create({
        data: {
          name: `Notifications ${key.toUpperCase()}`,
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
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { id: { in: [ids.aId, ids.bId].filter(Boolean) } },
      });
    }
    await app?.close();
  });

  it('registers an owned push target without exposing it', async () => {
    const target = `fcm-installation-${suffix}-secure-target`;
    const response = await api()
      .post('/api/v1/notifications/devices')
      .set('Authorization', auth(tokens.a))
      .send({ target, platform: PushDevicePlatform.ANDROID })
      .expect(201);
    const device = (response.body as DataResponse<Record<string, unknown>>)
      .data;
    expect(device).not.toHaveProperty('target');
    ids.deviceId = String(device.id);
    const persisted = await prisma.pushDevice.findUniqueOrThrow({
      where: { target },
    });
    expect(persisted.userId).toBe(ids.aId);
  });

  it('persists all required event types and deduplicates reminders', async () => {
    const date = new Date('2026-07-19T00:00:00.000Z');
    await Promise.all([
      notifications.dailyReminder(ids.aId, date),
      notifications.dailyReminder(ids.aId, date),
    ]);
    await notifications.weakSubjectAlert(
      ids.aId,
      { id: randomUUID(), name: 'Physics' },
      date,
    );
    await notifications.achievementUnlocked(ids.aId, {
      id: randomUUID(),
      name: 'First quiz',
    });
    await notifications.challengeInvite(ids.aId, randomUUID(), ids.bId);
    await notifications.challengeResult(ids.aId, randomUUID(), 'WIN');

    const rows = await prisma.notification.findMany({
      where: { userId: ids.aId },
    });
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((row) => row.type))).toEqual(
      new Set([
        NotificationType.DAILY_REMINDER,
        NotificationType.WEAK_SUBJECT,
        NotificationType.ACHIEVEMENT_UNLOCKED,
        NotificationType.CHALLENGE_INVITE,
        NotificationType.CHALLENGE_RESULT,
      ]),
    );
    ids.notificationId = rows[0].id;

    const response = await api()
      .get('/api/v1/notifications?unreadOnly=true')
      .set('Authorization', auth(tokens.a))
      .expect(200);
    expect(
      (response.body as DataResponse<NotificationResponse[]>).data,
    ).toHaveLength(5);
  });

  it('enforces ownership for PATCH/read, DELETE and device removal', async () => {
    await api()
      .patch(`/api/v1/notifications/${ids.notificationId}/read`)
      .set('Authorization', auth(tokens.b))
      .expect(404);
    const read = await api()
      .patch(`/api/v1/notifications/${ids.notificationId}/read`)
      .set('Authorization', auth(tokens.a))
      .expect(200);
    expect((read.body as DataResponse<NotificationResponse>).data.isRead).toBe(
      true,
    );
    await api()
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', auth(tokens.a))
      .expect(200);
    const unread = await api()
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', auth(tokens.a))
      .expect(200);
    expect((unread.body as DataResponse<{ count: number }>).data.count).toBe(0);
    await api()
      .delete(`/api/v1/notifications/devices/${ids.deviceId}`)
      .set('Authorization', auth(tokens.b))
      .expect(404);
    await api()
      .delete(`/api/v1/notifications/devices/${ids.deviceId}`)
      .set('Authorization', auth(tokens.a))
      .expect(200);
    await api()
      .delete(`/api/v1/notifications/${ids.notificationId}`)
      .set('Authorization', auth(tokens.b))
      .expect(404);
    await api()
      .delete(`/api/v1/notifications/${ids.notificationId}`)
      .set('Authorization', auth(tokens.a))
      .expect(200);
  });
});
