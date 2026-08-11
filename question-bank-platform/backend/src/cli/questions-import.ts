import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestionImportEngineService } from '../content/question-imports/question-import-engine.service';
const value = (n: string) => {
  const i = process.argv.indexOf(n);
  return i < 0 ? undefined : process.argv[i + 1];
};
async function main() {
  const job = value('--job-id'),
    actor = value('--actor-id');
  if (!job || !actor)
    throw new Error('Explicit --job-id and --actor-id are required');
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    console.log(
      JSON.stringify(
        await app.get(QuestionImportEngineService).confirm(job, actor),
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
