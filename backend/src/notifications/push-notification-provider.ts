export const PUSH_NOTIFICATION_PROVIDER = Symbol('PUSH_NOTIFICATION_PROVIDER');

export type PushNotificationMessage = {
  targets: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type PushNotificationResult = {
  sentCount: number;
  failureCount: number;
  invalidTargets: string[];
  skipped: boolean;
};

export interface PushNotificationProvider {
  send(message: PushNotificationMessage): Promise<PushNotificationResult>;
}
