import { corsOrigins, validateEnvironment } from './environment';

const base = {
  DATABASE_URL: 'postgresql://localhost/question_bank',
  JWT_ACCESS_SECRET: 'access_secret_that_is_at_least_32_chars',
  JWT_REFRESH_SECRET: 'refresh_secret_that_is_at_least_32_chars',
};

describe('environment configuration', () => {
  it('fails closed when production Redis or CORS is missing', () => {
    expect(() =>
      validateEnvironment({ ...base, NODE_ENV: 'production' }),
    ).toThrow('REDIS_HOST is required');
  });

  it('rejects wildcard production CORS', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        REDIS_HOST: 'redis',
        CORS_ORIGINS: '*',
      }),
    ).toThrow('CORS_ORIGINS cannot contain *');
  });

  it('normalizes valid production settings and origins', () => {
    const values = validateEnvironment({
      ...base,
      NODE_ENV: 'production',
      REDIS_HOST: 'redis',
      CORS_ORIGINS: 'https://app.example.com, https://admin.example.com/',
      REDIS_TLS: 'true',
    });
    expect(values.REDIS_TLS).toBe(true);
    expect(corsOrigins(String(values.CORS_ORIGINS))).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });
  it('requires a Google client ID when the provider is enabled', () => {
    expect(() =>
      validateEnvironment({ ...base, GOOGLE_AUTH_ENABLED: 'true' }),
    ).toThrow('GOOGLE_CLIENT_ID is required');
  });

  it('normalizes enabled Google authentication configuration', () => {
    const values = validateEnvironment({
      ...base,
      GOOGLE_AUTH_ENABLED: 'true',
      GOOGLE_CLIENT_ID: 'web-client.apps.googleusercontent.com',
    });
    expect(values.GOOGLE_AUTH_ENABLED).toBe(true);
    expect(values.GOOGLE_CLIENT_ID).toBe(
      'web-client.apps.googleusercontent.com',
    );
  });

  it('normalizes vector pipeline settings and rejects zero dimensions', () => {
    const values = validateEnvironment({
      ...base,
      VECTOR_DIMENSIONS: '768',
      EMBEDDING_BATCH_SIZE: '32',
    });
    expect(values.VECTOR_DIMENSIONS).toBe(768);
    expect(values.EMBEDDING_BATCH_SIZE).toBe(32);
    expect(() =>
      validateEnvironment({ ...base, VECTOR_DIMENSIONS: '0' }),
    ).toThrow('Invalid positive numeric configuration value');
  });
});
