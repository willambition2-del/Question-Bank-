import { KnowledgeChunkerService } from './knowledge-chunker.service';

describe('KnowledgeChunkerService', () => {
  const chunker = new KnowledgeChunkerService();

  it('creates bounded overlapping chunks while retaining page references', () => {
    const words = Array.from({ length: 260 }, (_, index) => `كلمة${index}`);
    const chunks = chunker.chunk([{ pageNumber: 7, text: words.join(' ') }], {
      maxTokens: 100,
      overlapTokens: 10,
    });
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.tokenCount <= 100)).toBe(true);
    expect(chunks.every((chunk) => chunk.pageNumber === 7)).toBe(true);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_, index) => index),
    );
    expect(chunks[0]?.contentChecksum).toHaveLength(64);
  });
});
