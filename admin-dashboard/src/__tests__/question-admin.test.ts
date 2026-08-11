import { describe, expect, it, vi } from "vitest";
import api from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

describe("Question administration contracts", () => {
  it("runs a dry run after an XLSX upload before confirmation", async () => {
    (api.post as any)
      .mockResolvedValueOnce({ data: { id: "import-1", status: "PENDING" } })
      .mockResolvedValueOnce({
        data: { id: "import-1", status: "DRY_RUN_COMPLETED" },
      });
    const body = new FormData();
    body.append("file", new File(["xlsx"], "questions.xlsx"));
    const uploaded = await api.post("/admin/question-imports/upload", body);
    await api.post(`/admin/question-imports/${uploaded.data.id}/dry-run`);
    expect(api.post).toHaveBeenLastCalledWith(
      "/admin/question-imports/import-1/dry-run",
    );
  });

  it("sends the exact owner approval phrase to the trusted import endpoint", async () => {
    (api.post as any).mockResolvedValueOnce({
      data: { approvalMode: "OWNER_APPROVED_FULL_IMPORT" },
    });
    const response = await api.post(
      "/admin/question-imports/import-1/owner-approved-import",
      {
        confirmation: "OWNER_APPROVED_FULL_IMPORT",
      },
    );
    expect(api.post).toHaveBeenCalledWith(
      "/admin/question-imports/import-1/owner-approved-import",
      {
        confirmation: "OWNER_APPROVED_FULL_IMPORT",
      },
    );
    expect(response.data.approvalMode).toBe("OWNER_APPROVED_FULL_IMPORT");
  });
  it("uses protected pause, cancel, and owner-approved resume controls", async () => {
    vi.clearAllMocks();
    (api.post as any).mockResolvedValue({ data: { status: "PAUSED" } });
    await api.post("/admin/question-imports/import-1/pause");
    await api.post("/admin/question-imports/import-1/cancel");
    await api.post("/admin/question-imports/import-1/owner-approved-resume", {
      confirmation: "OWNER_APPROVED_FULL_IMPORT",
    });
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      "/admin/question-imports/import-1/pause",
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      "/admin/question-imports/import-1/cancel",
    );
    expect(api.post).toHaveBeenNthCalledWith(
      3,
      "/admin/question-imports/import-1/owner-approved-resume",
      {
        confirmation: "OWNER_APPROVED_FULL_IMPORT",
      },
    );
  });
  it("uses the protected quality endpoint", async () => {
    (api.get as any).mockResolvedValueOnce({
      data: { total: 21, missingAnswer: 0 },
    });
    const response = await api.get("/admin/questions/quality");
    expect(response.data.total).toBe(21);
  });

  it("edits questions through the admin endpoint only", async () => {
    (api.patch as any).mockResolvedValueOnce({
      data: { reviewStatus: "DRAFT", isPublished: false },
    });
    const response = await api.patch("/admin/questions/question-1", {
      questionText: "updated",
    });
    expect(response.data).toMatchObject({
      reviewStatus: "DRAFT",
      isPublished: false,
    });
  });

  it("requests full exports from the dedicated admin endpoint", async () => {
    (api.post as any).mockResolvedValueOnce(new Blob(["export"]));
    await api.post(
      "/admin/questions/export?format=xlsx",
      {},
      { responseType: "blob" },
    );
    expect(api.post).toHaveBeenCalledWith(
      "/admin/questions/export?format=xlsx",
      {},
      { responseType: "blob" },
    );
  });
});
