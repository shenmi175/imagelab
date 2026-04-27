import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { hmac } from "@/lib/crypto";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "USER_DISABLED"
  | "INVALID_INPUT"
  | "CSRF_FAILED"
  | "RATE_LIMITED"
  | "DAILY_QUOTA_EXCEEDED"
  | "USER_ACTIVE_JOB_LIMIT"
  | "QUEUE_FULL"
  | "JOB_NOT_FOUND"
  | "IMAGE_NOT_READY"
  | "IMAGE_EXPIRED"
  | "FEEDBACK_NOT_FOUND"
  | "GENERATION_FAILED"
  | "SUB2API_UNAVAILABLE";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export function jsonOk<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers });
}

export function jsonOkWithHeaders<T>(data: T, headers: Headers, status = 200) {
  const response = NextResponse.json(data, { status });
  headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") response.headers.set(key, value);
  });

  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = typeof getSetCookie === "function" ? getSetCookie.call(headers) : [];
  if (cookies.length) {
    for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  } else {
    const cookie = headers.get("set-cookie");
    if (cookie) response.headers.append("set-cookie", cookie);
  }

  return response;
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "GENERATION_FAILED", message: "服务器错误" }, { status: 500 });
}

export async function requestIpHash() {
  const headerBag = await headers();
  const forwarded = headerBag.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerBag.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "unknown";
  return hmac(ip);
}

export async function requestUserAgent() {
  const headerBag = await headers();
  return headerBag.get("user-agent")?.slice(0, 500) ?? null;
}

export async function assertSameOrigin() {
  const headerBag = await headers();
  const method = headerBag.get("x-http-method-override") ?? "";
  void method;

  const origin = headerBag.get("origin");
  if (!origin) return;

  const host = headerBag.get("host");
  if (!host) throw new ApiError("CSRF_FAILED", "请求来源校验失败", 403);

  const expected = new URL(env.appUrl);
  const allowedHosts = new Set([host, expected.host]);
  const actual = new URL(origin);
  if (!allowedHosts.has(actual.host)) {
    throw new ApiError("CSRF_FAILED", "请求来源校验失败", 403);
  }
}
