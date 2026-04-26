import { allowedQualities, allowedSizes, env } from "@/lib/env";
import { ApiError } from "@/lib/http";

export function normalizeEmail(email: unknown) {
  if (typeof email !== "string") throw new ApiError("INVALID_INPUT", "邮箱格式不正确");
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ApiError("INVALID_INPUT", "邮箱格式不正确");
  }
  return normalized;
}

export function validatePassword(password: unknown) {
  if (typeof password !== "string" || password.length < 8) {
    throw new ApiError("INVALID_INPUT", "密码至少需要 8 个字符");
  }
  return password;
}

export function validatePrompt(prompt: unknown) {
  if (typeof prompt !== "string") throw new ApiError("INVALID_INPUT", "Prompt 不能为空");
  const normalized = prompt.trim();
  if (!normalized) throw new ApiError("INVALID_INPUT", "Prompt 不能为空");
  if (normalized.length > env.maxPromptLength) {
    throw new ApiError("INVALID_INPUT", `Prompt 最多 ${env.maxPromptLength} 个字符`);
  }
  return normalized;
}

export function validateSize(size: unknown) {
  const value = typeof size === "string" && size ? size : env.defaultImageSize;
  if (!allowedSizes.has(value)) throw new ApiError("INVALID_INPUT", "尺寸不支持");
  return value;
}

export function validateQuality(quality: unknown) {
  const value = typeof quality === "string" && quality ? quality : env.defaultImageQuality;
  if (!allowedQualities.has(value)) throw new ApiError("INVALID_INPUT", "质量不支持");
  return value;
}
