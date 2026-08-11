import { describe, it, expect, vi, beforeEach } from "vitest";
import { cookies } from "next/headers";
import { loginAction, logoutAction } from "@/app/actions/auth";

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: {
    get: vi.fn((name: string) =>
      name === "admin_access_token" ? { value: "mock-token" } : undefined,
    ),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(cookieStore),
}));

describe("Auth BFF Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects login when identifier is missing", async () => {
    const formData = new FormData();
    formData.append("password", "secret");

    await expect(loginAction(null, formData)).resolves.toEqual({
      error: "اسم المستخدم مطلوب",
    });
  });

  it("rejects non-SUPER_ADMIN users", async () => {
    const formData = new FormData();
    formData.append("identifier", "student");
    formData.append("password", "password123");
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { role: "STUDENT" },
        tokens: { accessToken: "token-student", refreshToken: "ref-student" },
      }),
    } as Response);

    await expect(loginAction(null, formData)).resolves.toEqual({
      error: "غير مصرح لك بالدخول (SUPER_ADMIN فقط)",
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("succeeds for SUPER_ADMIN users and sets strict HttpOnly cookies", async () => {
    const formData = new FormData();
    formData.append("identifier", "admin");
    formData.append("password", "admin123");
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { role: "SUPER_ADMIN" },
        tokens: { accessToken: "token-admin", refreshToken: "ref-admin" },
      }),
    } as Response);

    await expect(loginAction(null, formData)).resolves.toEqual({ success: true });
    expect(cookieStore.set).toHaveBeenCalledWith(
      "admin_access_token",
      "token-admin",
      expect.objectContaining({ httpOnly: true, sameSite: "strict" }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "admin_refresh_token",
      "ref-admin",
      expect.objectContaining({ httpOnly: true, sameSite: "strict" }),
    );
    expect(cookies).toHaveBeenCalledOnce();
  });

  it("clears session cookies on logout", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true } as Response);

    await logoutAction();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(cookieStore.delete).toHaveBeenCalledWith("admin_access_token");
    expect(cookieStore.delete).toHaveBeenCalledWith("admin_refresh_token");
  });
});