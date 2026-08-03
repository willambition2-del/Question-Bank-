import { ConfigService } from '@nestjs/config';
import { GoogleTokenVerifier } from './google-token.verifier';

const token = (payload: Record<string, unknown>) =>
  `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

async function responseCode(action: Promise<unknown>) {
  try {
    await action;
    return null;
  } catch (error: unknown) {
    return (error as { getResponse: () => { code: string } }).getResponse()
      .code;
  }
}

describe('GoogleTokenVerifier', () => {
  const configured = () =>
    new GoogleTokenVerifier(
      new ConfigService({
        GOOGLE_AUTH_ENABLED: true,
        GOOGLE_CLIENT_ID: 'web-client-id.apps.googleusercontent.com',
      }),
    );

  it('returns only verified server payload fields', async () => {
    const verifier = configured();
    (verifier as unknown as { client: { verifyIdToken: jest.Mock } }).client = {
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'subject',
          email: 'STUDENT@EXAMPLE.COM ',
          email_verified: true,
          name: '  Student   Name  ',
        }),
      }),
    };
    await expect(verifier.verify('signed-token')).resolves.toEqual({
      subject: 'subject',
      email: 'student@example.com',
      emailVerified: true,
      name: 'Student Name',
    });
  });

  it('rejects an invalid token', async () => {
    const verifier = configured();
    (verifier as unknown as { client: { verifyIdToken: jest.Mock } }).client = {
      verifyIdToken: jest.fn().mockRejectedValue(new Error('invalid')),
    };
    await expect(responseCode(verifier.verify('invalid'))).resolves.toBe(
      'GOOGLE_TOKEN_INVALID',
    );
  });

  it('classifies an expired token without trusting it for authentication', async () => {
    const verifier = configured();
    (verifier as unknown as { client: { verifyIdToken: jest.Mock } }).client = {
      verifyIdToken: jest.fn().mockRejectedValue(new Error('expired')),
    };
    await expect(
      responseCode(verifier.verify(token({ exp: 1 }))),
    ).resolves.toBe('GOOGLE_TOKEN_EXPIRED');
  });

  it('classifies an audience mismatch', async () => {
    const verifier = configured();
    (verifier as unknown as { client: { verifyIdToken: jest.Mock } }).client = {
      verifyIdToken: jest.fn().mockRejectedValue(new Error('audience')),
    };
    await expect(
      responseCode(
        verifier.verify(token({ aud: 'another-client', exp: 9999999999 })),
      ),
    ).resolves.toBe('GOOGLE_TOKEN_AUDIENCE_INVALID');
  });

  it('rejects requests when Google authentication is disabled', async () => {
    const verifier = new GoogleTokenVerifier(
      new ConfigService({ GOOGLE_AUTH_ENABLED: false }),
    );
    await expect(responseCode(verifier.verify('anything'))).resolves.toBe(
      'SOCIAL_PROVIDER_DISABLED',
    );
  });
});
