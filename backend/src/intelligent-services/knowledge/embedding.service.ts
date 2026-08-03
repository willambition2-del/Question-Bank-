import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  KnowledgeDocumentStatus,
  ServiceTaskType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligentServicesGateway } from '../intelligent-services.gateway';
import { ModelRoutingEngine } from '../routing/model-routing.engine';
import { VectorEmbeddingRepository } from './vector-embedding.repository';

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly routing: ModelRoutingEngine,
    private readonly gateway: IntelligentServicesGateway,
    private readonly vectors: VectorEmbeddingRepository,
  ) {}

  async embedQuery(
    query: string,
  ): Promise<{ vector: number[]; modelId: string }> {
    const response = await this.gateway.createEmbeddings({
      requestId: randomUUID(),
      inputs: [query],
    });
    const vector = response.vectors[0];
    if (!vector) throw new Error('EMBEDDING_RESPONSE_EMPTY');
    return { vector, modelId: response.internal.modelId };
  }

  async embedDocument(documentId: string): Promise<void> {
    if (!this.vectorSearchEnabled()) {
      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: KnowledgeDocumentStatus.READY,
          embeddedChunkCount: 0,
          failedChunkCount: 0,
          embeddingModelVersion: null,
          lastEmbeddedAt: null,
          processedAt: new Date(),
          extractionError: null,
        },
      });
      return;
    }
    const document = await this.prisma.knowledgeDocument.findUniqueOrThrow({
      where: { id: documentId },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
          select: {
            id: true,
            content: true,
            contentChecksum: true,
          },
        },
      },
    });
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: KnowledgeDocumentStatus.EMBEDDING },
    });
    const estimatedTokens = document.chunks.reduce(
      (sum, chunk) => sum + Math.ceil(chunk.content.length / 4),
      0,
    );
    const selection = await this.routing.select(
      ServiceTaskType.EMBEDDING_GENERATION,
      estimatedTokens,
    );
    const plannedModelId = selection.candidates[0]?.model.id;
    if (!plannedModelId) throw new Error('EMBEDDING_MODEL_NOT_CONFIGURED');
    const pending: typeof document.chunks = [];
    for (const chunk of document.chunks) {
      if (
        !(await this.vectors.isCurrent(
          chunk.id,
          plannedModelId,
          chunk.contentChecksum,
        ))
      ) {
        pending.push(chunk);
      }
    }
    const batchSize = Math.min(
      64,
      Math.max(1, this.config.get<number>('EMBEDDING_BATCH_SIZE', 16)),
    );
    let embedded = document.chunks.length - pending.length;
    let failed = 0;
    let finalModelId = plannedModelId;
    for (let index = 0; index < pending.length; index += batchSize) {
      const batch = pending.slice(index, index + batchSize);
      try {
        const response = await this.gateway.createEmbeddings({
          requestId: randomUUID(),
          inputs: batch.map((chunk) => chunk.content),
        });
        finalModelId = response.internal.modelId;
        if (response.vectors.length !== batch.length) {
          throw new Error('EMBEDDING_BATCH_SIZE_MISMATCH');
        }
        for (const [offset, chunk] of batch.entries()) {
          await this.vectors.save({
            chunkId: chunk.id,
            modelId: finalModelId,
            contentChecksum: chunk.contentChecksum,
            vector: response.vectors[offset],
          });
          embedded += 1;
        }
      } catch (error: unknown) {
        failed += batch.length;
        const code =
          error instanceof Error
            ? error.name.slice(0, 100)
            : 'EMBEDDING_BATCH_FAILED';
        await Promise.all(
          batch.map((chunk) =>
            this.vectors.markFailed({
              chunkId: chunk.id,
              modelId: finalModelId,
              contentChecksum: chunk.contentChecksum,
              errorCode: code,
            }),
          ),
        );
      }
    }
    const status =
      failed === 0
        ? KnowledgeDocumentStatus.READY
        : embedded > 0
          ? KnowledgeDocumentStatus.PARTIALLY_READY
          : KnowledgeDocumentStatus.FAILED;
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status,
        embeddedChunkCount: embedded,
        failedChunkCount: failed,
        embeddingModelVersion: finalModelId,
        lastEmbeddedAt: new Date(),
        processedAt:
          status === KnowledgeDocumentStatus.FAILED ? null : new Date(),
        extractionError:
          status === KnowledgeDocumentStatus.FAILED
            ? 'DOCUMENT_EMBEDDING_FAILED'
            : null,
      },
    });
  }

  private vectorSearchEnabled(): boolean {
    const value = this.config.get<boolean | string>(
      'VECTOR_SEARCH_ENABLED',
      false,
    );
    return value === true || value === 'true';
  }
}
