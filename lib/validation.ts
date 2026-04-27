import { allowedBackgrounds, allowedModerations, allowedOutputFormats, allowedQualities, allowedSizes, env } from "@/lib/env";
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
  if (typeof prompt !== "string") throw new ApiError("INVALID_INPUT", "提示词不能为空");
  const normalized = prompt.trim();
  if (!normalized) throw new ApiError("INVALID_INPUT", "提示词不能为空");
  if (normalized.length > env.maxPromptLength) {
    throw new ApiError("INVALID_INPUT", `提示词最多 ${env.maxPromptLength} 个字符`);
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

export function validateOutputFormat(format: unknown) {
  const rawValue = typeof format === "string" && format ? format : env.defaultImageFormat;
  const value = rawValue === "jpg" ? "jpeg" : rawValue;
  if (!allowedOutputFormats.has(value)) throw new ApiError("INVALID_INPUT", "输出格式不支持");
  return value;
}

export function validateOutputCompression(outputFormat: string, compression: unknown) {
  if (outputFormat !== "jpeg") return null;
  if (compression === undefined || compression === null || compression === "") return 75;
  const value = typeof compression === "number" ? compression : Number(compression);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new ApiError("INVALID_INPUT", "压缩率需为 0-100 的整数");
  }
  return value;
}

export function validateBackground(background: unknown) {
  const value = typeof background === "string" && background ? background : env.defaultImageBackground;
  if (!allowedBackgrounds.has(value)) throw new ApiError("INVALID_INPUT", "背景参数不支持");
  return value;
}

export function validateModeration(moderation: unknown) {
  const value = typeof moderation === "string" && moderation ? moderation : env.defaultImageModeration;
  if (!allowedModerations.has(value)) throw new ApiError("INVALID_INPUT", "审核强度不支持");
  return value;
}
