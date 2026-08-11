import { AssistantResponseValidator } from './assistant-response-validator.service';

describe('AssistantResponseValidator', () => {
  const validator = new AssistantResponseValidator();
  const retrieved = [
    {
      chunkId: 'chunk-1',
      documentId: 'document-1',
      title: 'Trusted book',
      pageNumber: 12,
      content: 'Trusted excerpt',
      score: 1,
    },
  ];

  it('keeps only citations that came from retrieved chunks', () => {
    const result = validator.normalize(
      'request-1',
      {
        text: '',
        structured: {
          summary: 'Answer',
          steps: ['Step one'],
          keyConcept: 'Concept',
          commonMistake: null,
          sourceReferences: [
            { documentId: 'document-1', pageNumber: 12 },
            { documentId: 'invented-document', pageNumber: 99 },
          ],
        },
        inputTokens: 10,
        outputTokens: 20,
      },
      retrieved,
    );

    expect(result.sourceReferences).toEqual([
      {
        documentId: 'document-1',
        pageNumber: 12,
        title: 'Trusted book',
      },
    ]);
    expect(result).not.toHaveProperty('internal');
  });

  it('returns a stable response without calling a provider when context is absent', () => {
    expect(validator.insufficient('request-2')).toEqual(
      expect.objectContaining({
        requestId: 'request-2',
        status: 'INSUFFICIENT_CONTEXT',
        sourceReferences: [],
      }),
    );
  });
});
