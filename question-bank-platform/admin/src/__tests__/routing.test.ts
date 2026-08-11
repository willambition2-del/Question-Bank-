import { describe, it, expect, vi } from 'vitest';
import api from '@/lib/axios';

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Task Routing Persistence Operations', () => {
  it('persists reordered candidates with updated priority order', async () => {
    const routeId = 'route-general-chat';
    const reorderedCandidates = [
      { modelId: 'model-claude-3', priority: 1 },
      { modelId: 'model-gpt-4o', priority: 2 },
    ];

    (api.patch as any).mockResolvedValueOnce({
      data: {
        id: routeId,
        taskType: 'GENERAL_CHAT',
        candidates: reorderedCandidates,
      },
    });

    const response = await api.patch(`/admin/intelligent-services/routes/${routeId}`, {
      candidates: reorderedCandidates,
    });

    expect(api.patch).toHaveBeenCalledWith(`/admin/intelligent-services/routes/${routeId}`, {
      candidates: reorderedCandidates,
    });
    expect(response.data.candidates[0].priority).toBe(1);
    expect(response.data.candidates[0].modelId).toBe('model-claude-3');
  });
});
