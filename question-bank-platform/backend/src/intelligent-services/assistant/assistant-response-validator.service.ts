import { Injectable } from '@nestjs/common';
import type {
  AssistantResponse,
  AssistantSourceReference,
} from '../public-response';
import { assertPublicResponsePrivacy } from '../public-response';
import type { RetrievedKnowledge } from '../knowledge/knowledge-retrieval.service';
import type { NormalizedProviderResponse } from '../providers/provider-adapter';

@Injectable()
export class AssistantResponseValidator {
  normalize(
    requestId: string,
    response: NormalizedProviderResponse,
    retrieved: RetrievedKnowledge[] = [],
    remainingToday: number | null = null,
  ): AssistantResponse {
    const value = response.structured ?? this.parseJson(response.text);
    const summary = this.string(value.summary) ?? response.text.trim();
    const allowedSources = new Map(
      retrieved.map((item) => [
        this.sourceKey(item.documentId, item.pageNumber),
        {
          documentId: item.documentId,
          pageNumber: item.pageNumber,
          title: item.title,
        },
      ]),
    );
    const requestedSources = Array.isArray(value.sourceReferences)
      ? value.sourceReferences
      : [];
    const sourceReferences = requestedSources
      .map((source) => this.validSource(source, allowedSources))
      .filter((source): source is AssistantSourceReference => source !== null);
    const result: AssistantResponse = {
      requestId,
      status: 'COMPLETED',
      summary: summary.slice(0, 12_000),
      steps: this.strings(value.steps).slice(0, 20),
      keyConcept: this.string(value.keyConcept),
      commonMistake: this.string(value.commonMistake),
      sourceReferences: this.uniqueSources(sourceReferences),
      usage: { remainingToday },
    };
    assertPublicResponsePrivacy(result);
    return result;
  }

  insufficient(requestId: string): AssistantResponse {
    return {
      requestId,
      status: 'INSUFFICIENT_CONTEXT',
      summary: 'لا تتوفر مراجع كافية وموثوقة للإجابة عن هذا السؤال.',
      steps: [],
      keyConcept: null,
      commonMistake: null,
      sourceReferences: [],
      usage: { remainingToday: null },
    };
  }

  private parseJson(text: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(text);
      return typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private string(value: unknown): string | null {
    return typeof value === 'string' && value.trim()
      ? value.trim().slice(0, 12_000)
      : null;
  }

  private strings(value: unknown): string[] {
    return Array.isArray(value)
      ? value
          .map((item) => this.string(item))
          .filter((item): item is string => item !== null)
      : [];
  }

  private validSource(
    value: unknown,
    allowed: Map<string, AssistantSourceReference>,
  ): AssistantSourceReference | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const source = value as Record<string, unknown>;
    if (typeof source.documentId !== 'string') return null;
    const pageNumber =
      typeof source.pageNumber === 'number' ? source.pageNumber : null;
    return allowed.get(this.sourceKey(source.documentId, pageNumber)) ?? null;
  }

  private sourceKey(documentId: string, pageNumber: number | null) {
    return `${documentId}:${pageNumber ?? 'null'}`;
  }

  private uniqueSources(
    sources: AssistantSourceReference[],
  ): AssistantSourceReference[] {
    return [
      ...new Map(
        sources.map((source) => [
          this.sourceKey(source.documentId, source.pageNumber),
          source,
        ]),
      ).values(),
    ];
  }
}
