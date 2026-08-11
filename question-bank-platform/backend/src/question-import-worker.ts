import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { AppModule } from './app.module';
import { QuestionImportEngineService } from './content/question-imports/question-import-engine.service';

type QuestionImportJobData = {
  jobId: unknown;
  actorId: unknown;
};
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const engine = app.get(QuestionImportEngineService);
  const worker = new Worker<QuestionImportJobData>(
    'question-imports',
    async (job) => {
      if (job.name !== 'confirm') throw new Error('Unsupported import job');
      const { jobId, actorId } = job.data;
      if (typeof jobId !== 'string' || typeof actorId !== 'string')
        throw new Error('Invalid question import job payload');
      return engine.confirm(jobId, actorId);
    },
    {
      connection: {
        host: process.env.REDIS_HOST ?? 'redis',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB ?? 0),
      },
      concurrency: Number(process.env.QUESTION_IMPORT_WORKER_CONCURRENCY ?? 1),
    },
  );
  const stop = async () => {
    await worker.close();
    await app.close();
    process.exit(0);
  };
  const handleStop = () => {
    void stop().catch((error: unknown) => {
      console.error(
        error instanceof Error ? error.message : 'Worker shutdown failed',
      );
      process.exit(1);
    });
  };
  process.on('SIGTERM', handleStop);
  process.on('SIGINT', handleStop);
}
void main();
