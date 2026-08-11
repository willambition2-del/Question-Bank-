import { NotFoundException } from '@nestjs/common';
import { PushDevicePlatform } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { PushNotificationProvider } from './push-notification-provider';
import { NotificationsService } from './notifications.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const sendPush = jest.fn().mockResolvedValue({
  sentCount: 1,
  failureCount: 0,
  invalidTargets: [],
  skipped: false,
});
const push: PushNotificationProvider = { send: sendPush };

describe('NotificationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enforces ownership when marking a notification read', async () => {
    const prisma = {
      notification: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn(),
      },
    };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
      push,
    );
    await expect(
      service.read('user-1', 'notification-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
  });

  it('scopes unread counts to the authenticated user', async () => {
    const prisma = {
      notification: { count: jest.fn().mockResolvedValue(3) },
    };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
      push,
    );
    expect(await service.countUnread('user-1')).toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
    });
  });

  it('deduplicates event notifications before dispatching push', async () => {
    const notification = {
      id: 'notification-1',
      userId: 'user-1',
      title: 'Daily study reminder',
      body: 'Ready',
      data: { day: '2026-07-19' },
    };
    const prisma = {
      notification: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(notification),
        findFirst: jest.fn().mockResolvedValue(notification),
        update: jest.fn().mockResolvedValue(notification),
      },
      pushDevice: {
        findMany: jest.fn().mockResolvedValue([{ target: 'device-target' }]),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
      push,
    );
    await service.dailyReminder('user-1', new Date('2026-07-19T00:00:00Z'));
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(sendPush).toHaveBeenCalledWith(
      expect.objectContaining({ targets: ['device-target'] }),
    );
  });

  it('registers an FCM target without returning the target secret', async () => {
    const prisma = {
      pushDevice: {
        upsert: jest.fn().mockResolvedValue({
          id: 'device-1',
          platform: PushDevicePlatform.ANDROID,
          isActive: true,
        }),
      },
    };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
      push,
    );
    const result: unknown = await service.registerDevice('user-1', {
      target: 'a-valid-device-target',
      platform: PushDevicePlatform.ANDROID,
    });
    expect(result).not.toHaveProperty('target');

    expect(prisma.pushDevice.upsert).toHaveBeenCalledTimes(1);
  });
});
