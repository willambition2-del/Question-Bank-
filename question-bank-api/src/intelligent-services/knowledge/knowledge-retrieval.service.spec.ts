import { KnowledgeBaseScope } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';
import { RerankingService } from './reranking.service';
import { VectorEmbeddingRepository } from './vector-embedding.repository';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('KnowledgeRetrievalService', () => {
  const findFirst = jest.fn();
  const queryRaw = jest.fn();
  const embedQuery = jest.fn();
  const vectorSearch = jest.fn();
  const rerank = jest.fn();
  let vectorEnabled = false;
  const service = new KnowledgeRetrievalService(
    {
      knowledgeBase: { findFirst },
      $queryRawUnsafe: queryRaw,
    } as unknown as PrismaService,
    {
      get: jest.fn((_key: string, fallback: unknown) =>
        _key === 'VECTOR_SEARCH_ENABLED' ? vectorEnabled : fallback,
      ),
    } as never,
    { embedQuery } as unknown as EmbeddingService,
    { search: vectorSearch } as unknown as VectorEmbeddingRepository,
    { rerank } as unknown as RerankingService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    vectorEnabled = false;
    findFirst.mockResolvedValue({
      scope: KnowledgeBaseScope.GLOBAL,
      retrievalSettingsJson: {},
    });
    queryRaw.mockResolvedValue([
      {
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        title: 'Reference',
        pageNumber: 24,
        section: 'Section',
        content: 'Stored content',
        keywordScore: 0.8,
      },
    ]);
  });

  it('uses parameterized scoped full-text retrieval', async () => {
    const result = await service.search('explain the stored topic', {
      knowledgeBaseId: 'kb-1',
      subjectId: 'subject-1',
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw.mock.calls[0]).toEqual(
      expect.arrayContaining(['kb-1', 'explain the stored topic', 'subject-1']),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        title: 'Reference',
        pageNumber: 24,
        keywordScore: 0.8,
      }),
    );
  });

  it('merges vector and keyword scores without exposing unrelated chunks', async () => {
    vectorEnabled = true;
    embedQuery.mockResolvedValue({ vector: [0.1, 0.2], modelId: 'model-1' });
    vectorSearch.mockResolvedValue([
      {
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        title: 'Reference',
        pageNumber: 24,
        sectionTitle: 'Section',
        content: 'Stored content',
        vectorScore: 0.9,
      },
    ]);

    const result = await service.search('topic', { knowledgeBaseId: 'kb-1' });

    expect(vectorSearch).toHaveBeenCalledWith(
      [0.1, 0.2],
      expect.objectContaining({
        knowledgeBaseId: 'kb-1',
        modelId: 'model-1',
      }),
    );
    expect(result[0]?.combinedScore).toBeCloseTo(0.865);
  });

  it('blocks private knowledge from public retrieval', async () => {
    findFirst.mockResolvedValue({
      scope: KnowledgeBaseScope.ADMIN_PRIVATE,
      retrievalSettingsJson: {},
    });

    await expect(
      service.search('topic', { knowledgeBaseId: 'kb-1' }),
    ).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns no context for an empty query', async () => {
    await expect(
      service.search(' ', { knowledgeBaseId: 'kb-1' }),
    ).resolves.toEqual([]);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
