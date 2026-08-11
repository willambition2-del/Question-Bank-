"use server";

import { cookies } from "next/headers";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string({ error: "البريد الإلكتروني مطلوب" }).email("البريد الإلكتروني غير صالح").trim(),
  password: z.string({ error: "كلمة المرور مطلوبة" }).min(1, "كلمة المرور مطلوبة"),
});

const authResponseSchema = z.object({
  user: z.object({
    role: z.string(),
  }),
  tokens: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
  }),
});

const errorResponseSchema = z.object({
  message: z.string().optional(),
});

export async function loginAction(_prevState: unknown, formData: FormData) {
  const parsedCredentials = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsedCredentials.success) {
    return {
      error: parsedCredentials.error.issues[0]?.message ?? "بيانات الدخول غير صالحة",
    };
  }

  try {
    const response = await fetch(`${backendUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedCredentials.data),
      cache: "no-store",
    });
    const responseText = await response.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch (e) {
      console.error("Backend returned non-JSON:", responseText.substring(0, 500));
      return { error: `Server error: ${response.status} - Invalid JSON response` };
    }

    if (!response.ok) {
      const errorBody = errorResponseSchema.safeParse(responseBody);
      return {
        error: errorBody.success
          ? errorBody.data.message ?? "فشل تسجيل الدخول"
          : "فشل تسجيل الدخول",
      };
    }

    const authResult = authResponseSchema.safeParse(responseBody);
    if (!authResult.success) {
      return { error: "استجابة تسجيل الدخول من الخادم غير صالحة" };
    }

    if (authResult.data.user.role !== "SUPER_ADMIN") {
      return { error: "غير مصرح لك بالدخول (SUPER_ADMIN فقط)" };
    }

    const cookieStore = await cookies();
    const secure = process.env.NODE_ENV === "production";
    cookieStore.set("admin_access_token", authResult.data.tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    cookieStore.set("admin_refresh_token", authResult.data.tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return { success: true };
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
    };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_access_token")?.value;

  if (token) {
    try {
      await fetch(`${backendUrl()}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch {
      // Local cookies are still cleared if the backend is unavailable.
    }
  }

  cookieStore.delete("admin_access_token");
  cookieStore.delete("admin_refresh_token");
}
function backendUrl(): string {
  const configured = process.env.BACKEND_INTERNAL_URL || process.env.API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("BACKEND_INTERNAL_URL is required in production");
  }
  return "http://localhost:3000/api/v1";
}