import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { KnowledgeDocumentStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DocumentStorageService } from './document-storage.service';
import { DocumentTextExtractor } from './document-text-extractor.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeChunkerService } from './knowledge-chunker.service';
import { OcrService } from './ocr.service';

export const DOCUMENT_QUEUE = 'knowledge-document-ingestion';

@Injectable()
export class DocumentIngestionService implements OnModuleDestroy {
  private readonly queue?: Queue<{ documentId: string }>;
  private readonly logger = new Logger(DocumentIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: DocumentStorageService,
    private readonly extractor: DocumentTextExtractor,
    private readonly chunker: KnowledgeChunkerService,
    private readonly embeddings: EmbeddingService,
    private readonly ocr: OcrService,
    private readonly config: ConfigService,
  ) {
    const host = this.config.get<string>('REDIS_HOST');
    if (host) {
      this.queue = new Queue(DOCUMENT_QUEUE, {
        connection: this.redisOptions(host),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  async enqueue(documentId: string): Promise<void> {
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: KnowledgeDocumentStatus.QUEUED,
        extractionError: null,
      },
    });
    if (this.queue) {
      await this.queue.add(
        'ingest',
        { documentId },
        {
          jobId: documentId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      setImmediate(() => void this.process(documentId));
    }
  }

  async queueStatus() {
    if (!this.queue) {
      return {
        configured: false,
        mode: 'inline' as const,
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
      };
    }
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
    );
    return {
      configured: true,
      mode: 'bullmq' as const,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
    };
  }

  async processNext(): Promise<boolean> {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { status: KnowledgeDocumentStatus.QUEUED },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!document) return false;
    await this.process(document.id);
    return true;
  }

  async process(documentId: string): Promise<void> {
    const completed = await this.redis.withLock(
      `intelligent:document:${documentId}`,
      10 * 60_000,
      async () => {
        const document = await this.prisma.knowledgeDocument.findUniqueOrThrow({
          where: { id: documentId },
        });
        try {
          await this.prisma.knowledgeDocument.update({
            where: { id: documentId },
            data: { status: KnowledgeDocumentStatus.EXTRACTING },
          });
          const buffer = await this.storage.read(document.storagePath);
          let extracted = await this.extractor.extract(
            this.type(document.mimeType, document.originalFileName),
            buffer,
          );
          if (extracted.pagesRequiringOcr.length) {
            await this.prisma.knowledgeDocument.update({
              where: { id: documentId },
              data: {
                status: KnowledgeDocumentStatus.OCR_REQUIRED,
                ocrPageCount: extracted.pagesRequiringOcr.length,
              },
            });
            await this.prisma.knowledgeDocument.update({
              where: { id: documentId },
              data: { status: KnowledgeDocumentStatus.OCR_PROCESSING },
            });
            const ocrPages = await this.ocr.extractPdfPages(
              buffer,
              extracted.pagesRequiringOcr,
            );
            const replacements = new Map(
              ocrPages.map((page) => [page.pageNumber, page.text]),
            );
            extracted = {
              ...extracted,
              pages: extracted.pages.map((page) => ({
                ...page,
                text: replacements.get(page.pageNumber) || page.text,
              })),
              pagesRequiringOcr: [],
            };
          }
          await this.prisma.knowledgeDocument.update({
            where: { id: documentId },
            data: { status: KnowledgeDocumentStatus.CHUNKING },
          });
          const settings = await this.settings(document.knowledgeBaseId);
          const chunks = this.chunker.chunk(extracted.pages, settings);
          if (!chunks.length) throw new Error('DOCUMENT_TEXT_EMPTY');
          await this.prisma.$transaction([
            this.prisma.knowledgeChunk.deleteMany({ where: { documentId } }),
            this.prisma.knowledgeChunk.createMany({
              data: chunks.map((chunk) => ({
                ...chunk,
                documentId,
                knowledgeBaseId: document.knowledgeBaseId,
                metadataJson: {
                  subjectId: document.subjectId,
                  unitId: document.unitId,
                  lessonId: document.lessonId,
                },
              })),
            }),
            this.prisma.knowledgeDocument.update({
              where: { id: documentId },
              data: {
                status: KnowledgeDocumentStatus.EMBEDDING,
                pageCount: extracted.pageCount,
                chunkCount: chunks.length,
                processedAt: new Date(),
                extractionError: null,
              },
            }),
          ]);
          await this.embeddings.embedDocument(documentId);
        } catch (error: unknown) {
          await this.prisma.knowledgeDocument.update({
            where: { id: documentId },
            data: {
              status: KnowledgeDocumentStatus.FAILED,
              extractionError: this.safeError(error),
            },
          });
          this.logger.warn({
            event: 'knowledge_document_failed',
            documentId,
            errorCode: this.safeError(error),
          });
        }
      },
    );
    if (completed === null) return;
  }

  private async settings(
    knowledgeBaseId: string,
  ): Promise<{ maxTokens?: number; overlapTokens?: number }> {
    const knowledgeBase = await this.prisma.knowledgeBase.findUniqueOrThrow({
      where: { id: knowledgeBaseId },
      select: { retrievalSettingsJson: true },
    });
    const value = knowledgeBase.retrievalSettingsJson;
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return {};
    return {
      maxTokens: this.number(value.chunkSize),
      overlapTokens: this.number(value.chunkOverlap),
    };
  }

  private type(mimeType: string, fileName: string) {
    if (mimeType === 'application/pdf') return 'PDF' as const;
    if (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
      return 'DOCX' as const;
    return /\.md|\.markdown$/i.test(fileName)
      ? ('MARKDOWN' as const)
      : ('TXT' as const);
  }

  private number(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private redisOptions(host: string): RedisOptions {
    return {
      host,
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      db: this.config.get<number>('REDIS_DB', 0),
      tls: this.config.get<boolean>('REDIS_TLS', false) ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  private safeError(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'code' in error.response
    ) {
      return String(error.response.code).slice(0, 100);
    }
    return error instanceof Error
      ? error.name.slice(0, 100)
      : 'DOCUMENT_PROCESSING_FAILED';
  }
}
