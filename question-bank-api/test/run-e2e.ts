import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const testDatabaseUrl = process.env.DATABASE_URL_TEST;
if (!testDatabaseUrl) {
  throw new Error('DATABASE_URL_TEST is required for E2E tests');
}

const testUrl = new URL(testDatabaseUrl);
const developmentUrl = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL)
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

const environment = {
  ...process.env,
  E2E_DEVELOPMENT_DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL: testDatabaseUrl,
  NODE_ENV: 'test',
  VECTOR_SEARCH_ENABLED: 'false',
  NODE_OPTIONS: [process.env.NODE_OPTIONS, '--experimental-vm-modules']
    .filter(Boolean)
    .join(' '),
};

const run = (script: string, args: string[]): void => {
  const result = spawnSync(process.execPath, [script, ...args], {
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
run('node_modules/jest/bin/jest.js', [
  '--config',
  './test/jest-e2e.json',
  '--runInBand',
  ...process.argv.slice(2),
]);
