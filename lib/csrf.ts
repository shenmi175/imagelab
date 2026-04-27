import { cookies } from "next/headers";
import { hmac, randomToken, timingSafeEqual } from "@/lib/crypto";
import { ApiError } from "@/lib/http";

const CSRF_COOKIE = "image_site_csrf";

function sign(token: string) {
  return `${token}.${hmac(token)}`;
}

function verifySigned(signed: string | undefined) {
  if (!signed) return false;
  const [token, signature] = signed.split(".");
  if (!token || !signature) return false;
  return timingSafeEqual(signature, hmac(token));
}

export async function issueCsrfToken() {
  const token = randomToken(24);
  const signed = sign(token);
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE, signed, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
  return token;
}

export async function verifyCsrf(request: Request) {
  const cookieStore = await cookies();
  const signed = cookieStore.get(CSRF_COOKIE)?.value;
  const token = request.headers.get("x-csrf-token");

  if (!token || !signed || !verifySigned(signed)) {
    throw new ApiError("CSRF_FAILED", "安全校验失败", 403);
  }

  const [cookieToken] = signed.split(".");
  if (!timingSafeEqual(token, cookieToken)) {
    throw new ApiError("CSRF_FAILED", "安全校验失败", 403);
  }
}
