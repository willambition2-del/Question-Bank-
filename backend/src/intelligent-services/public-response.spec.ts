import { assertPublicResponsePrivacy } from './public-response';

describe('public assistant response privacy', () => {
  it('accepts the normalized platform DTO', () => {
    expect(() =>
      assertPublicResponsePrivacy({
        requestId: 'request-1',
        status: 'COMPLETED',
        summary: 'شرح تعليمي',
        sourceReferences: [],
      }),
    ).not.toThrow();
  });

  it('rejects provider, model, routing and cost metadata', () => {
    for (const field of [
      'providerId',
      'modelId',
      'remoteModelId',
      'routingPolicy',
      'apiKey',
      'estimatedCost',
    ]) {
      expect(() =>
        assertPublicResponsePrivacy({ [field]: 'secret' }),
      ).toThrow();
    }
  });
});
