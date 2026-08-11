import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client';
import { KnowledgeBaseScope } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { RerankingService } from './reranking.service';
import { VectorEmbeddingRepository } from './vector-embedding.repository';

export interface RetrievalScope {
  knowledgeBaseId: string;
  subjectId?: string;
  unitId?: string;
  lessonId?: string;
  sourceId?: string;
  language?: string;
  limit?: number;
  minimumScore?: number;
  userId?: string;
  allowAdminPrivate?: boolean;
}

export interface RetrievedKnowledge {
  chunkId: string;
  documentId: string;
  title: string;
  pageNumber: number | null;
  section: string | null;
  content: string;
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
  rerankScore: number | null;
  score: number;
}

type KeywordRow = Omit<
  RetrievedKnowledge,
  'vectorScore' | 'combinedScore' | 'rerankScore' | 'score'
>;

type Settings = {
  vectorTopK: number;
  keywordTopK: number;
  finalTopK: number;
  vectorWeight: number;
  keywordWeight: number;
  minimumScore: number;
  maximumContextTokens: number;
  useReranking: boolean;
};

@Injectable()
export class KnowledgeRetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly embeddings: EmbeddingService,
    private readonly vectors: VectorEmbeddingRepository,
    private readonly reranking: RerankingService,
  ) {}

  async search(
    query: string,
    scope: RetrievalScope,
  ): Promise<RetrievedKnowledge[]> {
    const normalized = this.normalize(query);
    if (!normalized) return [];
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id: scope.knowledgeBaseId, enabled: true },
      select: { scope: true, retrievalSettingsJson: true },
    });
    if (!knowledgeBase) return [];
    if (
      knowledgeBase.scope === KnowledgeBaseScope.ADMIN_PRIVATE &&
      !scope.allowAdminPrivate
    ) {
      return [];
    }
    const settings = this.settings(knowledgeBase.retrievalSettingsJson, scope);
    const keyword = await this.keywordSearch(normalized, scope, settings);
    let vectorRows: Awaited<ReturnType<VectorEmbeddingRepository['search']>> =
      [];
    if (this.vectorSearchEnabled()) {
      try {
        const embedded = await this.embeddings.embedQuery(normalized);
        vectorRows = await this.vectors.search(embedded.vector, {
          ...scope,
          modelId: embedded.modelId,
          limit: settings.vectorTopK,
        });
      } catch {
        vectorRows = [];
      }
    }
    const merged = new Map<string, RetrievedKnowledge>();
    const maxKeyword = Math.max(1, ...keyword.map((item) => item.keywordScore));
    for (const row of keyword) {
      const keywordScore = row.keywordScore / maxKeyword;
      merged.set(row.chunkId, {
        ...row,
        vectorScore: 0,
        keywordScore,
        combinedScore: keywordScore * settings.keywordWeight,
        rerankScore: null,
        score: keywordScore * settings.keywordWeight,
      });
    }
    for (const row of vectorRows) {
      const current = merged.get(row.chunkId);
      const vectorScore = Number(row.vectorScore);
      const keywordScore = current?.keywordScore ?? 0;
      const combinedScore =
        vectorScore * settings.vectorWeight +
        keywordScore * settings.keywordWeight;
      merged.set(row.chunkId, {
        chunkId: row.chunkId,
        documentId: row.documentId,
        title: row.title,
        pageNumber: row.pageNumber,
        section: row.sectionTitle,
        content: row.content,
        vectorScore,
        keywordScore,
        combinedScore,
        rerankScore: null,
        score: combinedScore,
      });
    }
    let candidates = [...merged.values()]
      .filter((item) => item.combinedScore >= settings.minimumScore)
      .sort((left, right) => right.combinedScore - left.combinedScore)
      .slice(0, Math.max(settings.finalTopK * 3, settings.finalTopK));
    if (settings.useReranking && candidates.length > 1) {
      const scores = await this.reranking.rerank(
        normalized,
        candidates.map((item) => ({
          chunkId: item.chunkId,
          excerpt: item.content,
          combinedScore: item.combinedScore,
        })),
        scope.userId,
      );
      candidates = candidates
        .map((item) => ({
          ...item,
          rerankScore: scores.get(item.chunkId) ?? null,
          score: scores.get(item.chunkId) ?? item.combinedScore,
        }))
        .sort((left, right) => right.score - left.score);
    }
    const selected: RetrievedKnowledge[] = [];
    let tokens = 0;
    for (const item of candidates) {
      const itemTokens = Math.max(1, Math.ceil(item.content.length / 4));
      if (tokens + itemTokens > settings.maximumContextTokens) continue;
      selected.push(item);
      tokens += itemTokens;
      if (selected.length >= settings.finalTopK) break;
    }
    return selected;
  }

  private async keywordSearch(
    query: string,
    scope: RetrievalScope,
    settings: Settings,
  ): Promise<KeywordRow[]> {
    const parameters: unknown[] = [scope.knowledgeBaseId, query];
    const conditions = [
      'c."knowledgeBaseId" = $1',
      'd."enabled" = true',
      "d.\"status\" IN ('READY', 'PARTIALLY_READY')",
      'c."searchVector" @@ websearch_to_tsquery(\'simple\', $2)',
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
    parameters.push(settings.keywordTopK);
    const limitParameter = `$${parameters.length}`;
    return this.prisma.$queryRawUnsafe<KeywordRow[]>(
      `SELECT
        c."id" AS "chunkId",
        d."id" AS "documentId",
        d."title",
        c."pageNumber",
        c."sectionTitle" AS "section",
        c."content",
        ts_rank_cd(
          c."searchVector",
          websearch_to_tsquery('simple', $2),
          32
        )::double precision AS "keywordScore"
      FROM "KnowledgeChunk" c
      JOIN "KnowledgeDocument" d ON d."id" = c."documentId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY "keywordScore" DESC
      LIMIT ${limitParameter}`,
      ...parameters,
    );
  }
  private settings(
    value: Prisma.JsonValue | null,
    scope: RetrievalScope,
  ): Settings {
    const object =
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : {};
    const number = (key: string, fallback: number, maximum: number) => {
      const candidate = object[key];
      return typeof candidate === 'number' && Number.isFinite(candidate)
        ? Math.min(maximum, Math.max(0, candidate))
        : fallback;
    };
    const finalTopK = Math.min(
      20,
      Math.max(1, scope.limit ?? number('finalTopK', 8, 20)),
    );
    return {
      vectorTopK: Math.max(1, number('vectorTopK', 20, 100)),
      keywordTopK: Math.max(1, number('keywordTopK', 20, 100)),
      finalTopK,
      vectorWeight: number('vectorWeight', 0.65, 1),
      keywordWeight: number('keywordWeight', 0.35, 1),
      minimumScore: scope.minimumScore ?? number('minimumScore', 0.1, 1),
      maximumContextTokens: Math.max(
        256,
        number('maximumContextTokens', 6000, 32000),
      ),
      useReranking: object.useReranking === true,
    };
  }

  private normalize(value: string): string {
    return value
      .normalize('NFKC')
      .split('')
      .map((character) => (character.charCodeAt(0) < 32 ? ' ' : character))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  }

  private vectorSearchEnabled(): boolean {
    const value = this.config.get<boolean | string>(
      'VECTOR_SEARCH_ENABLED',
      false,
    );
    return value === true || value === 'true';
  }
}
