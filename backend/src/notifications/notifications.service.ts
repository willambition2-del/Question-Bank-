import { Inject, Injectable, Logger } from '@nestjs/common';
import { createPageMeta } from '../common/pagination/pagination';
import { educationNotFound } from '../education/education-errors';
import type { Notification, Prisma } from '../generated/prisma/client';
import { NotificationType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import type { RegisterPushDeviceDto } from './dto/push-device.dto';
import {
  PUSH_NOTIFICATION_PROVIDER,
  type PushNotificationProvider,
  type PushNotificationResult,
} from './push-notification-provider';

type NotificationClient = Pick<Prisma.TransactionClient, 'notification'>;

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  dedupeKey?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly push: PushNotificationProvider,
  ) {}

  async create(client: NotificationClient, input: CreateNotificationInput) {
    if (!input.dedupeKey) {
      return client.notification.create({ data: input });
    }
    await client.notification.createMany({
      data: [input],
      skipDuplicates: true,
    });
    return client.notification.findUniqueOrThrow({
      where: { dedupeKey: input.dedupeKey },
    });
  }

  async notify(input: CreateNotificationInput) {
    let notification: Notification;
    if (input.dedupeKey) {
      const claimed = await this.prisma.notification.createMany({
        data: [input],
        skipDuplicates: true,
      });
      notification = await this.prisma.notification.findUniqueOrThrow({
        where: { dedupeKey: input.dedupeKey },
      });
      if (claimed.count === 0) return notification;
    } else {
      notification = await this.prisma.notification.create({ data: input });
    }
    await this.dispatch(notification.id, input.userId);
    return notification;
  }

  async dispatch(
    notificationId: string,
    userId: string,
  ): Promise<PushNotificationResult> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw educationNotFound(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found',
      );
    }
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId, isActive: true },
      select: { target: true },
    });
    try {
      const result = await this.push.send({
        targets: devices.map((device) => device.target),
        title: notification.title,
        body: notification.body,
        data: this.pushData(notification.data),
      });
      await this.prisma.$transaction([
        this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            pushAttempts: { increment: 1 },
            ...(result.sentCount > 0 ? { pushSentAt: new Date() } : {}),
          },
        }),
        ...(result.invalidTargets.length > 0
          ? [
              this.prisma.pushDevice.updateMany({
                where: { target: { in: result.invalidTargets } },
                data: { isActive: false },
              }),
            ]
          : []),
      ]);
      return result;
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { pushAttempts: { increment: 1 } },
      });
      this.logger.warn(
        `Push delivery failed for notification ${notification.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return {
        sentCount: 0,
        failureCount: devices.length,
        invalidTargets: [],
        skipped: false,
      };
    }
  }

  registerDevice(userId: string, dto: RegisterPushDeviceDto) {
    const target = dto.target.trim();
    return this.prisma.pushDevice.upsert({
      where: { target },
      create: {
        userId,
        target,
        platform: dto.platform,
      },
      update: {
        userId,
        platform: dto.platform,
        isActive: true,
        lastUsedAt: new Date(),
      },
      select: this.deviceProjection(),
    });
  }

  async removeDevice(userId: string, id: string) {
    const result = await this.prisma.pushDevice.updateMany({
      where: { id, userId, isActive: true },
      data: { isActive: false },
    });
    if (result.count === 0) {
      throw educationNotFound('PUSH_DEVICE_NOT_FOUND', 'Push device not found');
    }
    return { deleted: true };
  }

  dailyReminder(userId: string, date = new Date()) {
    const day = date.toISOString().slice(0, 10);
    return this.notify({
      userId,
      type: NotificationType.DAILY_REMINDER,
      title: 'Daily study reminder',
      body: 'Your daily questions are ready',
      data: { day },
      dedupeKey: `daily-reminder:${userId}:${day}`,
    });
  }

  weakSubjectAlert(
    userId: string,
    subject: { id: string; name: string },
    date = new Date(),
  ) {
    const day = date.toISOString().slice(0, 10);
    return this.notify({
      userId,
      type: NotificationType.WEAK_SUBJECT,
      title: 'Subject needs attention',
      body: `Review ${subject.name} to improve your mastery`,
      data: { subjectId: subject.id },
      dedupeKey: `weak-subject:${userId}:${subject.id}:${day}`,
    });
  }

  achievementUnlocked(
    userId: string,
    achievement: { id: string; name: string },
  ) {
    return this.notify({
      userId,
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      title: 'Achievement unlocked',
      body: achievement.name,
      data: { achievementId: achievement.id },
      dedupeKey: `achievement:${userId}:${achievement.id}`,
    });
  }

  challengeInvite(
    userId: string,
    challengeId: string,
    invitedByUserId: string,
  ) {
    return this.notify({
      userId,
      type: NotificationType.CHALLENGE_INVITE,
      title: 'Challenge invitation',
      body: 'You have been invited to a challenge',
      data: { challengeId, invitedByUserId },
      dedupeKey: `challenge-invite:${challengeId}:${userId}`,
    });
  }

  challengeResult(
    userId: string,
    challengeId: string,
    result: 'WIN' | 'LOSS' | 'DRAW',
  ) {
    return this.notify({
      userId,
      type: NotificationType.CHALLENGE_RESULT,
      title: 'Challenge result',
      body:
        result === 'WIN'
          ? 'You won the challenge'
          : result === 'LOSS'
            ? 'Challenge completed'
            : 'The challenge ended in a draw',
      data: { challengeId, result },
      dedupeKey: `challenge-result:${challengeId}:${userId}`,
    });
  }

  async list(userId: string, query: NotificationQueryDto) {
    const where = {
      userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.unreadOnly ? { isRead: false } : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, meta: createPageMeta(query.page, query.limit, totalItems) };
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async read(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
    if (result.count === 0) {
      throw educationNotFound(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found',
      );
    }
    return this.prisma.notification.findFirst({ where: { id, userId } });
  }

  async readAll(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      throw educationNotFound(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found',
      );
    }
    return { deleted: true };
  }

  private pushData(data: Prisma.JsonValue | null) {
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : undefined;
  }

  private deviceProjection() {
    return {
      id: true,
      platform: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    } as const;
  }
}
