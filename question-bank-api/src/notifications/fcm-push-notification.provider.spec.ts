import { FcmPushNotificationProvider } from './fcm-push-notification.provider';

describe('FcmPushNotificationProvider', () => {
  it('stays disabled without initializing Firebase credentials', async () => {
    const config = {
      get: jest.fn().mockReturnValue('false'),
      getOrThrow: jest.fn(),
    };
    const provider = new FcmPushNotificationProvider(config as never);
    await expect(
      provider.send({
        targets: ['device-target'],
        title: 'Title',
        body: 'Body',
      }),
    ).resolves.toEqual({
      sentCount: 0,
      failureCount: 0,
      invalidTargets: [],
      skipped: true,
    });
    expect(config.getOrThrow).not.toHaveBeenCalled();
  });
});
