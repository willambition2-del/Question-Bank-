import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ServiceTaskType } from '../../generated/prisma/enums';
import { IntelligentServicesGateway } from '../intelligent-services.gateway';

export interface RerankCandidate {
  chunkId: string;
  excerpt: string;
  combinedScore: number;
}

@Injectable()
export class RerankingService {
  constructor(private readonly gateway: IntelligentServicesGateway) {}

  async rerank(
    query: string,
    candidates: RerankCandidate[],
    userId?: string,
  ): Promise<Map<string, number>> {
    if (!userId || candidates.length < 2) return new Map();
    try {
      const response = await this.gateway.execute({
        requestId: randomUUID(),
        userId,
        taskType: ServiceTaskType.RERANKING,
        messages: [
          {
            role: 'system',
            content:
              'Rank only the supplied chunk IDs for relevance. Return JSON with orderedIds and do not add IDs.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              query,
              candidates: candidates.map((item) => ({
                id: item.chunkId,
                excerpt: item.excerpt.slice(0, 1200),
              })),
            }),
          },
        ],
        inputTokens: Math.max(
          1,
          Math.ceil(
            candidates.reduce(
              (sum, item) => sum + item.excerpt.length,
              query.length,
            ) / 4,
          ),
        ),
        responseSchema: {
          type: 'object',
          required: ['orderedIds'],
          properties: {
            orderedIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      });
      const ordered = response.structured?.orderedIds;
      if (!Array.isArray(ordered)) return new Map();
      const allowed = new Set(candidates.map((item) => item.chunkId));
      const validated = ordered
        .filter((id): id is string => typeof id === 'string' && allowed.has(id))
        .filter((id, index, values) => values.indexOf(id) === index);
      if (!validated.length) return new Map();
      return new Map(
        validated.map((id, index) => [
          id,
          (validated.length - index) / validated.length,
        ]),
      );
    } catch {
      return new Map();
    }
  }
}
