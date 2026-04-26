import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

export async function verifyTurnstile(token: unknown) {
  if (!env.turnstileSecretKey) return;
  if (typeof token !== "string" || !token) {
    throw new ApiError("INVALID_INPUT", "请完成人机验证", 400);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.turnstileSecretKey,
      response: token
    })
  });

  const json = (await response.json()) as { success?: boolean };
  if (!json.success) {
    throw new ApiError("INVALID_INPUT", "人机验证失败", 400);
  }
}
