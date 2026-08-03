import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestionImportEngineService } from '../content/question-imports/question-import-engine.service';
async function main() {
  const i = process.argv.indexOf('--job-id'),
    id = i < 0 ? undefined : process.argv[i + 1];
  if (!id) throw new Error('--job-id is required');
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    console.log(
      JSON.stringify(
        await app.get(QuestionImportEngineService).report(id),
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
