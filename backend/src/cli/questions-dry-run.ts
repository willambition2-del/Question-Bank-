import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestionImportEngineService } from '../content/question-imports/question-import-engine.service';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const source = option('--source');
  if (!source)
    throw new Error(
      'Usage: npm run questions:dry-run -- --source <sqlite-path> [--actor-id <uuid>]',
    );
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.QUESTION_IMPORT_STORAGE_PATH
  ) {
    throw new Error('Local source paths are disabled in production');
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const report = await app
      .get(QuestionImportEngineService)
      .dryRunSqlite(source, option('--actor-id'));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
