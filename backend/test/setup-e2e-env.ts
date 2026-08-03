import 'dotenv/config';

const testDatabaseUrl = process.env.DATABASE_URL_TEST;

if (!testDatabaseUrl) {
  throw new Error('DATABASE_URL_TEST is required for E2E tests');
}

const testUrl = new URL(testDatabaseUrl);
const developmentDatabaseUrl =
  process.env.E2E_DEVELOPMENT_DATABASE_URL ?? process.env.DATABASE_URL;
const developmentUrl = developmentDatabaseUrl
  ? new URL(developmentDatabaseUrl)
  : null;

if (!testUrl.pathname.toLowerCase().endsWith('_test')) {
  throw new Error('DATABASE_URL_TEST must target a database ending in _test');
}

if (
  developmentUrl &&
  testUrl.host === developmentUrl.host &&
  testUrl.pathname === developmentUrl.pathname
) {
  throw new Error('E2E tests must not use the development database');
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.VECTOR_SEARCH_ENABLED = 'false';
