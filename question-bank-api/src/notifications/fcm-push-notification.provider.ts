import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  applicationDefault,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type {
  PushNotificationMessage,
  PushNotificationProvider,
  PushNotificationResult,
} from './push-notification-provider';

const FIREBASE_APP_NAME = 'question-bank-api';
const INVALID_TARGET_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

@Injectable()
export class FcmPushNotificationProvider implements PushNotificationProvider {
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(
    message: PushNotificationMessage,
  ): Promise<PushNotificationResult> {
    if (!this.enabled() || message.targets.length === 0) {
      return {
        sentCount: 0,
        failureCount: 0,
        invalidTargets: [],
        skipped: true,
      };
    }
    const data = Object.fromEntries(
      Object.entries(message.data ?? {}).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      ]),
    );
    let sentCount = 0;
    let failureCount = 0;
    const invalidTargets: string[] = [];
    for (let index = 0; index < message.targets.length; index += 500) {
      const targets = message.targets.slice(index, index + 500);
      const result = await getMessaging(
        this.firebaseApp(),
      ).sendEachForMulticast({
        tokens: targets,
        notification: { title: message.title, body: message.body },
        data,
      });
      sentCount += result.successCount;
      failureCount += result.failureCount;
      result.responses.forEach((response, responseIndex) => {
        if (
          !response.success &&
          response.error &&
          INVALID_TARGET_CODES.has(response.error.code)
        ) {
          invalidTargets.push(targets[responseIndex]);
        }
      });
    }
    return { sentCount, failureCount, invalidTargets, skipped: false };
  }

  private enabled() {
    return (
      this.config.get<string>('FCM_ENABLED', 'false').toLowerCase() === 'true'
    );
  }

  private firebaseApp() {
    if (this.app) return this.app;
    const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
    this.app =
      existing ??
      initializeApp(
        {
          credential: applicationDefault(),
          projectId: this.config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
        },
        FIREBASE_APP_NAME,
      );
    return this.app;
  }
}
