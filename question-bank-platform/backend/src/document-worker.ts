import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { AppModule } from './app.module';
import {
  DOCUMENT_QUEUE,
  DocumentIngestionService,
} from './intelligent-services/knowledge/document-ingestion.service';
import { JsonLogger } from './logging/json.logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new JsonLogger(),
  });
  const ingestion = app.get(DocumentIngestionService);
  const config = app.get(ConfigService);
  const host = config.get<string>('REDIS_HOST');
  if (!host) {
    throw new Error(
      'REDIS_HOST is required for the production document worker',
    );
  }
  const worker = new Worker<{ documentId: string }>(
    DOCUMENT_QUEUE,
    (job) => ingestion.process(job.data.documentId),
    {
      connection: {
        host,
        port: config.get<number>('REDIS_PORT', 6379),
        password: config.get<string>('REDIS_PASSWORD') || undefined,
        db: config.get<number>('REDIS_DB', 0),
        tls: config.get<boolean>('REDIS_TLS', false) ? {} : undefined,
        maxRetriesPerRequest: null,
      },
      concurrency: config.get<number>('DOCUMENT_WORKER_CONCURRENCY', 2),
    },
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await worker.close();
    await app.close();
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
}

void bootstrap();
