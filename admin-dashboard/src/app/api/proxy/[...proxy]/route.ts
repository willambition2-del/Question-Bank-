import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ proxy: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context.params, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context.params, "POST");
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context.params, "PUT");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context.params, "PATCH");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context.params, "DELETE");
}

async function handleProxy(
  request: NextRequest,
  paramsPromise: Promise<{ proxy: string[] }>,
  method: string,
) {
  if (method !== "GET" && !isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Forbidden", message: "Invalid request origin" },
      { status: 403 },
    );
  }

  const params = await paramsPromise;
  const path = params.proxy.map(encodeURIComponent).join("/");
  const query = request.nextUrl.searchParams.toString();
  const targetUrl = `${backendUrl()}/${path}${query ? `?${query}` : ""}`;
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    let body: BodyInit | undefined;
    if (method !== "GET" && method !== "HEAD") {
      if (contentType?.includes("multipart/form-data")) {
        body = await request.formData();
        headers.delete("Content-Type");
      } else {
        const text = await request.text();
        if (text) body = text;
      }
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
    });
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const responseBody: unknown = isJson
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return NextResponse.json(
        isJson ? responseBody : { message: String(responseBody) },
        { status: response.status },
      );
    }

    return isJson
      ? NextResponse.json(responseBody, { status: response.status })
      : new NextResponse(String(responseBody), { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Proxy Failed", message: "Backend request failed" },
      { status: 502 },
    );
  }
}

function backendUrl(): string {
  const configured = process.env.BACKEND_INTERNAL_URL || process.env.API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("BACKEND_INTERNAL_URL is required in production");
  }
  return "http://localhost:3000/api/v1";
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  try {
    const expectedOrigin = configuredAppUrl
      ? new URL(configuredAppUrl).origin
      : request.nextUrl.origin;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}