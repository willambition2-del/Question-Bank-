import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ExtractedPage } from './document-text-extractor.service';

export interface KnowledgeChunkInput {
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  chunkIndex: number;
  tokenCount: number;
  contentChecksum: string;
}

@Injectable()
export class KnowledgeChunkerService {
  chunk(
    pages: ExtractedPage[],
    options: { maxTokens?: number; overlapTokens?: number } = {},
  ): KnowledgeChunkInput[] {
    const maxTokens = Math.min(1500, Math.max(100, options.maxTokens ?? 500));
    const overlap = Math.min(
      Math.floor(maxTokens / 4),
      Math.max(0, options.overlapTokens ?? 50),
    );
    const result: KnowledgeChunkInput[] = [];
    for (const page of pages) {
      const paragraphs = page.text
        .replace(/\r/g, '')
        .split(/\n{2,}/)
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      let words: string[] = [];
      for (const paragraph of paragraphs) {
        const addition = paragraph.split(/\s+/);
        if (words.length && words.length + addition.length > maxTokens) {
          this.push(result, words, page.pageNumber);
          words = words.slice(Math.max(0, words.length - overlap));
        }
        words.push(...addition);
        while (words.length > maxTokens) {
          this.push(result, words.slice(0, maxTokens), page.pageNumber);
          words = words.slice(maxTokens - overlap);
        }
      }
      if (words.length) this.push(result, words, page.pageNumber);
    }
    return result.map((item, chunkIndex) => ({ ...item, chunkIndex }));
  }

  private push(
    target: Omit<KnowledgeChunkInput, 'chunkIndex'>[],
    words: string[],
    pageNumber: number | null,
  ): void {
    const content = words.join(' ').trim();
    if (!content) return;
    target.push({
      content,
      pageNumber,
      sectionTitle: this.heading(content),
      tokenCount: words.length,
      contentChecksum: createHash('sha256').update(content).digest('hex'),
    });
  }

  private heading(content: string): string | null {
    const firstSentence = content.split(/[.!؟\n]/)[0]?.trim() ?? '';
    return firstSentence.length >= 3 && firstSentence.length <= 100
      ? firstSentence
      : null;
  }
}
