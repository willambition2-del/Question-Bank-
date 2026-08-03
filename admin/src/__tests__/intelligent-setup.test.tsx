import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IntelligentServicesSetupPage from "@/app/intelligent-services/setup/page";
import PlatformStatusPage from "@/app/platform-status/page";
import api from "@/lib/axios";

vi.mock("@/components/Sidebar", () => ({ Sidebar: () => <nav>sidebar</nav> }));
vi.mock("@/lib/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock("swr", () => ({
  default: vi.fn(() => ({
    data: {
      data: {
        status: "BLOCKED",
        blockers: ["WAITING_FOR_PROVIDER_CREDENTIALS"],
        providers: { enabled: 0, credentialed: 0, healthy: 0 },
        models: { enabled: 0 },
        routes: { enabled: 0 },
        knowledgeBases: { enabled: 0 },
        vector: { enabled: true, extensionInstalled: true, storageReady: true, dimensions: 1536 },
        queue: { configured: true, waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 },
        checkedAt: "2026-08-02T00:00:00.000Z",
      },
    },
    mutate: vi.fn(),
    isLoading: false,
    error: undefined,
  })),
}));

describe("intelligent services onboarding administration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits a provider secret through a password field and never renders it", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: "provider-1", displayNameInternal: "Staging provider" },
    });

    const { container } = render(<IntelligentServicesSetupPage />);
    const secret = container.querySelector('input[name="apiKey"]');
    expect(secret).toHaveAttribute("type", "password");

    fireEvent.change(screen.getByPlaceholderText("????? ??????? ??????"), {
      target: { value: "Staging provider" },
    });
    fireEvent.change(screen.getByPlaceholderText("provider_key"), {
      target: { value: "staging_provider" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://provider.example/v1"), {
      target: { value: "https://provider.example/v1" },
    });
    fireEvent.change(screen.getByPlaceholderText("API key"), {
      target: { value: "owner-private-key" },
    });
    fireEvent.click(screen.getByText("??? ???? ?????????"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/admin/intelligent-services/providers",
        expect.objectContaining({ apiKey: "owner-private-key", enabled: false }),
      ),
    );
    expect(screen.queryByText("owner-private-key")).not.toBeInTheDocument();
  });

  it("shows readiness blockers from the protected readiness endpoint", () => {
    render(<PlatformStatusPage />);
    expect(screen.getByText("WAITING_FOR_PROVIDER_CREDENTIALS")).toBeInTheDocument();
    expect(screen.getByText("BLOCKED")).toBeInTheDocument();
  });
});
