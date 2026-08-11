const ENVIRONMENTS = new Set(['development', 'test', 'production']);

export function validateEnvironment(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const environment = stringValue(values.NODE_ENV) || 'development';
  if (!ENVIRONMENTS.has(environment)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const normalized: Record<string, unknown> = {
    ...values,
    NODE_ENV: environment,
    PORT: numberValue(values.PORT, 3000),
    REDIS_PORT: numberValue(values.REDIS_PORT, 6379),
    REDIS_DB: numberValue(values.REDIS_DB, 0),
    REDIS_CONNECT_TIMEOUT_MS: numberValue(
      values.REDIS_CONNECT_TIMEOUT_MS,
      5000,
    ),
    REDIS_TLS: booleanValue(values.REDIS_TLS, false),
    FCM_ENABLED: booleanValue(values.FCM_ENABLED, false),
    GOOGLE_AUTH_ENABLED: booleanValue(values.GOOGLE_AUTH_ENABLED, false),
    INTELLIGENT_SERVICES_ENABLED: booleanValue(
      values.INTELLIGENT_SERVICES_ENABLED,
      false,
    ),
    VECTOR_SEARCH_ENABLED: booleanValue(values.VECTOR_SEARCH_ENABLED, false),
    VECTOR_DIMENSIONS: positiveNumberValue(values.VECTOR_DIMENSIONS, 1536),
    EMBEDDING_BATCH_SIZE: positiveNumberValue(values.EMBEDDING_BATCH_SIZE, 16),
    OCR_ENABLED: booleanValue(values.OCR_ENABLED, true),
    OCR_RENDER_SCALE: positiveNumberValue(values.OCR_RENDER_SCALE, 2),
    OCR_MAX_PAGES: positiveNumberValue(values.OCR_MAX_PAGES, 100),
    OCR_PAGE_TIMEOUT_MS: positiveNumberValue(
      values.OCR_PAGE_TIMEOUT_MS,
      60_000,
    ),
    OCR_MIN_CHARACTERS_PER_PAGE: positiveNumberValue(
      values.OCR_MIN_CHARACTERS_PER_PAGE,
      40,
    ),
    IMAGE_MAX_SIZE_MB: positiveNumberValue(values.IMAGE_MAX_SIZE_MB, 8),
    IMAGE_MAX_PIXELS: positiveNumberValue(values.IMAGE_MAX_PIXELS, 25_000_000),
    IMAGE_MAX_DIMENSION: positiveNumberValue(values.IMAGE_MAX_DIMENSION, 4096),
    ASSISTANT_CACHE_TTL_SECONDS: positiveNumberValue(
      values.ASSISTANT_CACHE_TTL_SECONDS,
      3600,
    ),
    STORAGE_DRIVER: stringValue(values.STORAGE_DRIVER) || 'local',
    S3_FORCE_PATH_STYLE: booleanValue(values.S3_FORCE_PATH_STYLE, false),
    DOCUMENT_MAX_SIZE_MB: numberValue(values.DOCUMENT_MAX_SIZE_MB, 20),
    DOCUMENT_MAX_PAGES: numberValue(values.DOCUMENT_MAX_PAGES, 300),
    DOCUMENT_WORKER_CONCURRENCY: numberValue(
      values.DOCUMENT_WORKER_CONCURRENCY,
      2,
    ),
  };
  requireValue(normalized, 'DATABASE_URL');
  requireValue(normalized, 'JWT_ACCESS_SECRET');
  requireValue(normalized, 'JWT_REFRESH_SECRET');
  if (booleanValue(normalized.GOOGLE_AUTH_ENABLED, false)) {
    requireValue(normalized, 'GOOGLE_CLIENT_ID');
  }
  if (environment === 'production') {
    requireValue(normalized, 'REDIS_HOST');
    requireValue(normalized, 'CORS_ORIGINS');
    assertSecret(normalized.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
    assertSecret(normalized.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
    const origins = stringValue(normalized.CORS_ORIGINS)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (origins.some((origin) => origin === '*')) {
      throw new Error('CORS_ORIGINS cannot contain * in production');
    }
    if (booleanValue(normalized.FCM_ENABLED, false)) {
      requireValue(normalized, 'FIREBASE_PROJECT_ID');
    }
    if (booleanValue(normalized.INTELLIGENT_SERVICES_ENABLED, false)) {
      requireValue(normalized, 'PROVIDER_CREDENTIALS_MASTER_KEY');
      requireValue(normalized, 'DOCUMENT_STORAGE_PATH');
      assertEncryptionKey(normalized.PROVIDER_CREDENTIALS_MASTER_KEY);
      if (normalized.STORAGE_DRIVER === 's3') {
        requireValue(normalized, 'S3_BUCKET');
        requireValue(normalized, 'S3_REGION');
      }
    }
  }
  return normalized;
}

export function corsOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function requireValue(values: Record<string, unknown>, key: string) {
  if (!stringValue(values[key])) throw new Error(`${key} is required`);
}

function assertSecret(value: unknown, name: string) {
  const secret = stringValue(value);
  if (secret.length < 32 || secret === 'CHANGE_ME') {
    throw new Error(
      `${name} must be a non-default secret of at least 32 chars`,
    );
  }
}

function assertEncryptionKey(value: unknown) {
  const encoded = stringValue(value);
  try {
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || key.toString('base64') !== encoded) {
      throw new Error();
    }
  } catch {
    throw new Error(
      'PROVIDER_CREDENTIALS_MASTER_KEY must be a canonical base64-encoded 32-byte key',
    );
  }
}
function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown, fallback: number) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `Invalid numeric configuration value: ${describeValue(value)}`,
    );
  }
  return parsed;
}

function positiveNumberValue(value: unknown, fallback: number) {
  const parsed = numberValue(value, fallback);
  if (parsed < 1) {
    throw new Error(
      `Invalid positive numeric configuration value: ${describeValue(value)}`,
    );
  }
  return parsed;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(
    `Invalid boolean configuration value: ${describeValue(value)}`,
  );
}

function describeValue(value: unknown) {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : typeof value;
}
