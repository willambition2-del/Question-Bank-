import { Module } from '@nestjs/common';
import { FcmPushNotificationProvider } from './fcm-push-notification.provider';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PUSH_NOTIFICATION_PROVIDER } from './push-notification-provider';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    FcmPushNotificationProvider,
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useExisting: FcmPushNotificationProvider,
    },
  ],
  exports: [NotificationsService, PUSH_NOTIFICATION_PROVIDER],
})
export class NotificationsModule {}
