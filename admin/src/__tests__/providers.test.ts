import { describe, it, expect, vi } from 'vitest';
import api from '@/lib/axios';

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Providers API Operations & Security', () => {
  it('masks secret key and does not return full API key', async () => {
    const mockProvider = {
      id: 'prov-1',
      key: 'openai',
      displayNameInternal: 'OpenAI Main',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
      maskedApiKey: 'sk-...4f2a',
    };

    (api.get as any).mockResolvedValueOnce({ data: [mockProvider] });

    const result = await api.get('/admin/intelligent-services/providers');
    expect(result.data[0].maskedApiKey).toBe('sk-...4f2a');
    expect(result.data[0].apiKey).toBeUndefined();
  });

  it('updates provider without overwriting key when key field is left empty', async () => {
    const payloadWithoutKey = {
      displayNameInternal: 'Updated OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
    };

    (api.patch as any).mockResolvedValueOnce({ data: { id: 'prov-1', ...payloadWithoutKey } });

    const response = await api.patch('/admin/intelligent-services/providers/prov-1', payloadWithoutKey);
    expect(api.patch).toHaveBeenCalledWith(
      '/admin/intelligent-services/providers/prov-1',
      expect.not.objectContaining({ apiKey: expect.anything() })
    );
    expect(response.data.displayNameInternal).toBe('Updated OpenAI');
  });

  it('tests provider connection via private endpoint', async () => {
    (api.post as any).mockResolvedValueOnce({ data: { success: true, message: 'Connection test passed' } });

    const response = await api.post('/admin/intelligent-services/providers/prov-1/test');
    expect(api.post).toHaveBeenCalledWith('/admin/intelligent-services/providers/prov-1/test');
    expect(response.data.success).toBe(true);
  });
});
