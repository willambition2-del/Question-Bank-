import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { KnowledgeEmbeddingStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { VectorExtensionService } from './vector-extension.service';

export interface VectorSearchScope {
  knowledgeBaseId: string;
  modelId: string;
  subjectId?: string;
  unitId?: string;
  lessonId?: string;
  sourceId?: string;
  language?: string;
  limit: number;
}

export interface VectorSearchRow {
  chunkId: string;
  documentId: string;
  title: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  content: string;
  vectorScore: number;
}

@Injectable()
export class VectorEmbeddingRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly extension: VectorExtensionService,
  ) {}

  async isCurrent(
    chunkId: string,
    modelId: string,
    contentChecksum: string,
  ): Promise<boolean> {
    const value = await this.prisma.knowledgeChunkEmbedding.findUnique({
      where: { chunkId_modelId: { chunkId, modelId } },
      select: { contentChecksum: true, status: true },
    });
    return (
      value?.status === KnowledgeEmbeddingStatus.READY &&
      value.contentChecksum === contentChecksum
    );
  }

  async save(input: {
    chunkId: string;
    modelId: string;
    contentChecksum: string;
    vector: number[];
  }): Promise<void> {
    this.extension.assertReady();
    const expected = this.config.get<number>('VECTOR_DIMENSIONS', 1536);
    if (
      input.vector.length !== expected ||
      input.vector.some((value) => !Number.isFinite(value))
    ) {
      throw new Error('EMBEDDING_DIMENSIONS_INVALID');
    }
    const literal = `[${input.vector.join(',')}]`;
    await this.prisma.$transaction(async (tx) => {
      const embedding = await tx.knowledgeChunkEmbedding.upsert({
        where: {
          chunkId_modelId: {
            chunkId: input.chunkId,
            modelId: input.modelId,
          },
        },
        create: {
          id: randomUUID(),
          chunkId: input.chunkId,
          modelId: input.modelId,
          dimensions: input.vector.length,
          contentChecksum: input.contentChecksum,
          status: KnowledgeEmbeddingStatus.READY,
        },
        update: {
          dimensions: input.vector.length,
          contentChecksum: input.contentChecksum,
          status: KnowledgeEmbeddingStatus.READY,
          errorCode: null,
        },
        select: { id: true },
      });
      await tx.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunkVector" ("embeddingId", "embedding")
         VALUES ($1, $2::vector)
         ON CONFLICT ("embeddingId")
         DO UPDATE SET "embedding" = EXCLUDED."embedding"`,
        embedding.id,
        literal,
      );
    });
  }

  async markFailed(input: {
    chunkId: string;
    modelId: string;
    contentChecksum: string;
    errorCode: string;
  }): Promise<void> {
    await this.prisma.knowledgeChunkEmbedding.upsert({
      where: {
        chunkId_modelId: {
          chunkId: input.chunkId,
          modelId: input.modelId,
        },
      },
      create: {
        chunkId: input.chunkId,
        modelId: input.modelId,
        dimensions: this.config.get<number>('VECTOR_DIMENSIONS', 1536),
        contentChecksum: input.contentChecksum,
        status: KnowledgeEmbeddingStatus.FAILED,
        errorCode: input.errorCode.slice(0, 100),
      },
      update: {
        contentChecksum: input.contentChecksum,
        status: KnowledgeEmbeddingStatus.FAILED,
        errorCode: input.errorCode.slice(0, 100),
      },
    });
  }

  async search(
    queryVector: number[],
    scope: VectorSearchScope,
  ): Promise<VectorSearchRow[]> {
    this.extension.assertReady();
    const expected = this.config.get<number>('VECTOR_DIMENSIONS', 1536);
    if (queryVector.length !== expected) {
      throw new Error('EMBEDDING_DIMENSIONS_INVALID');
    }
    const parameters: unknown[] = [
      scope.knowledgeBaseId,
      scope.modelId,
      expected,
    ];
    const conditions = [
      'c."knowledgeBaseId" = $1',
      'e."modelId" = $2',
      'e."status" = \'READY\'',
      'e."dimensions" = $3',
      'd."enabled" = true',
      "d.\"status\" IN ('READY', 'PARTIALLY_READY')",
    ];
    const add = (column: string, value?: string) => {
      if (!value) return;
      parameters.push(value);
      conditions.push(`${column} = $${parameters.length}`);
    };
    add('d."subjectId"', scope.subjectId);
    add('d."unitId"', scope.unitId);
    add('d."lessonId"', scope.lessonId);
    add('d."sourceId"', scope.sourceId);
    add('d."language"', scope.language);
    parameters.push(`[${queryVector.join(',')}]`);
    const vectorParameter = `$${parameters.length}`;
    parameters.push(Math.min(100, Math.max(1, scope.limit)));
    const limitParameter = `$${parameters.length}`;
    return this.prisma.$queryRawUnsafe<VectorSearchRow[]>(
      `SELECT
        c."id" AS "chunkId",
        d."id" AS "documentId",
        d."title",
        c."pageNumber",
        c."sectionTitle",
        c."content",
        1 - (v."embedding" <=> ${vectorParameter}::vector) AS "vectorScore"
      FROM "KnowledgeChunkVector" v
      JOIN "KnowledgeChunkEmbedding" e ON e."id" = v."embeddingId"
      JOIN "KnowledgeChunk" c ON c."id" = e."chunkId"
      JOIN "KnowledgeDocument" d ON d."id" = c."documentId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY v."embedding" <=> ${vectorParameter}::vector
      LIMIT ${limitParameter}`,
      ...parameters,
    );
  }
}
